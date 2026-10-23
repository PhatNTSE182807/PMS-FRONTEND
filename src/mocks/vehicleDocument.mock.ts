import { demoVehiclePlates, removeDemoVehicle, setDemoVehicleRegistration } from '@/mocks/profile.mock'
import type {
  RejectedVehicleDTO,
  VehicleDocumentFileDTO,
  VehicleDocumentSide,
  VehicleDocumentType,
  VehicleVerificationDTO,
} from '@/types/vehicleDocument.dto'
import { DOCUMENT_MAX_BYTES, DOCUMENT_SLOTS, isApproved, isWaitingForStaff } from '@/types/vehicleDocument.dto'
import { delay, mockFail, mockId, mockResponse } from './mockApi'

/**
 * Demo "backend" for vehicle papers, following the API rules: upload the registration certificate
 * (front) and Citizen ID card (front and back), submit, and the check waits for Staff (NeedsReview)
 * until the Staff review mock approves or rejects it.
 */
interface StoredFile {
  dto: VehicleDocumentFileDTO
  blob: Blob
}

interface StoredVerification {
  dto: VehicleVerificationDTO
  files: Map<string, StoredFile>
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
const RETENTION_DAYS = 30
/** Registrations Staff rejected in this demo session (their vehicles were removed), newest first. */
let rejected: RejectedVehicleDTO[] = []
const verifications = new Map<string, StoredVerification>()

const slotKey = (type: VehicleDocumentType, side: VehicleDocumentSide) => `${type}/${side}`

function snapshot(stored: StoredVerification): VehicleVerificationDTO {
  const documents = DOCUMENT_SLOTS.map((s) => stored.files.get(slotKey(s.type, s.side))?.dto).filter(
    (d): d is VehicleDocumentFileDTO => Boolean(d),
  )
  const missingDocuments =
    stored.dto.status === 'Draft'
      ? DOCUMENT_SLOTS.filter((s) => !stored.files.has(slotKey(s.type, s.side))).map((s) => slotKey(s.type, s.side))
      : []
  return { ...stored.dto, documents, missingDocuments }
}

function draftFor(vehicleId: string): StoredVerification {
  const current = verifications.get(vehicleId)
  if (isWaitingForStaff(current?.dto.status))
    mockFail(400, 'Your papers are waiting for Staff review. Wait for the decision before uploading again.')
  if (isApproved(current?.dto.status)) mockFail(400, 'This vehicle is already approved.')
  if (current?.dto.status === 'Draft') return current

  const fresh: StoredVerification = {
    dto: {
      verificationId: mockId('ver'),
      vehicleId,
      status: 'Draft',
      documents: [],
      missingDocuments: [],
      createdAt: new Date().toISOString(),
    },
    files: new Map(),
  }
  verifications.set(vehicleId, fresh)
  setDemoVehicleRegistration(vehicleId, 'Draft')
  return fresh
}

/** A check submitted in this demo session, as the Staff review mock sees it. */
export interface DemoSubmittedCheck {
  verification: VehicleVerificationDTO
  file: (documentId: string) => Blob | undefined
  /** Records a Staff decision; the customer's page shows it on its next refresh. */
  decide: (approve: boolean, note: string | null) => void
}

/** Lets the Staff review mock list the checks customers submitted in this browser session and decide them. */
export function demoSubmittedChecks(): DemoSubmittedCheck[] {
  return [...verifications.values()]
    .filter((stored) => stored.dto.status !== 'Draft')
    .map((stored) => ({
      verification: snapshot(stored),
      file: (documentId) => [...stored.files.values()].find((f) => f.dto.documentId === documentId)?.blob,
      decide: (approve, note) => {
        const now = new Date()
        stored.dto = {
          ...stored.dto,
          status: approve ? 'Approved' : 'Rejected',
          statusReason: approve
            ? 'Papers checked by Staff. The vehicle can be booked and is recognised at the gates.'
            : 'Staff rejected these papers, so the vehicle was removed from your account. Register it again with new photos.',
          reviewNote: note,
          decidedAt: now.toISOString(),
          filesDeleteAt: new Date(now.getTime() + RETENTION_DAYS * 86_400_000).toISOString(),
        }
        if (approve) {
          setDemoVehicleRegistration(stored.dto.vehicleId, 'Approved', note)
          return
        }
        // Like the API: a rejected vehicle is not registered, so it leaves the fleet
        const vehicle = removeDemoVehicle(stored.dto.vehicleId)
        rejected = [
          {
            verificationId: stored.dto.verificationId,
            vehicleId: stored.dto.vehicleId,
            licensePlate: vehicle?.licensePlate ?? stored.dto.licensePlate ?? '',
            brand: vehicle?.brand,
            model: vehicle?.model,
            reviewNote: note,
            decidedAt: now.toISOString(),
          },
          ...rejected,
        ]
      },
    }))
}

export const vehicleDocumentMock = {
  getLatest: (vehicleId: string) =>
    mockResponse(() => {
      const stored = verifications.get(vehicleId)
      return stored ? snapshot(stored) : null
    }, 200),

  /** Simulates upload progress in steps, then stores the file in memory. */
  async upload(
    vehicleId: string,
    type: VehicleDocumentType,
    side: VehicleDocumentSide,
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<VehicleVerificationDTO> {
    if (!DOCUMENT_SLOTS.some((s) => s.type === type && s.side === side))
      mockFail(400, 'One photo of each paper is enough: the registration certificate and the Citizen ID card.')
    if (!ACCEPTED_TYPES.includes(file.type)) mockFail(400, 'Only JPEG, PNG or PDF files are accepted.')
    if (file.size > DOCUMENT_MAX_BYTES) mockFail(400, 'The file is larger than 10 MB.')
    for (const percent of [15, 40, 70, 100]) {
      await delay(120)
      onProgress?.(percent)
    }
    return mockResponse(() => {
      const stored = draftFor(vehicleId)
      stored.files.set(slotKey(type, side), {
        blob: file,
        dto: {
          documentId: mockId('doc'),
          documentType: type,
          side,
          fileName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
          uploadedAt: new Date().toISOString(),
          isAvailable: true,
        },
      })
      return snapshot(stored)
    }, 100)
  },

  /** Sends the papers straight to the Staff queue, like the API. */
  submit: (vehicleId: string) =>
    mockResponse(() => {
      const stored = verifications.get(vehicleId)
      if (stored?.dto.status !== 'Draft') mockFail(400, 'Upload the registration certificate and Citizen ID photos first.')
      const missing = snapshot(stored).missingDocuments
      if (missing.length > 0) mockFail(400, `Upload every paper first; missing: ${missing.join(', ')}.`)

      stored.dto = {
        ...stored.dto,
        status: 'NeedsReview',
        statusReason: 'Waiting for Staff to compare your papers with this vehicle.',
        submittedAt: new Date().toISOString(),
      }
      setDemoVehicleRegistration(vehicleId, 'NeedsReview')
      return snapshot(stored)
    }),

  /** Rejections whose plate was not registered again, like GET /Users/profile/rejected-vehicles. */
  getRecentlyRejected: () =>
    mockResponse(() => {
      const plates = new Set(demoVehiclePlates())
      return rejected.filter((r) => !plates.has(r.licensePlate))
    }, 200),

  getFile: async (vehicleId: string, documentId: string): Promise<Blob> => {
    await delay(150)
    const file = [...(verifications.get(vehicleId)?.files.values() ?? [])].find((f) => f.dto.documentId === documentId)
    if (!file) mockFail(404, 'Document not found.')
    return file.blob
  },
}
