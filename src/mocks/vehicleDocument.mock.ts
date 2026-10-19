import { profileMock } from '@/mocks/profile.mock'
import type { VehicleDTO } from '@/types/profile.dto'
import type {
  FieldResult,
  VehicleDocumentFileDTO,
  VehicleDocumentSide,
  VehicleDocumentType,
  VehicleVerificationDTO,
  VerificationFieldDTO,
} from '@/types/vehicleDocument.dto'
import { DOCUMENT_MAX_BYTES, DOCUMENT_SLOTS } from '@/types/vehicleDocument.dto'
import { delay, mockFail, mockId, mockResponse } from './mockApi'

/**
 * Demo "backend" for vehicle papers. OCR is simulated deterministically from the file names, so every
 * outcome can be shown without a server:
 * - default: the papers match the vehicle and the profile → AutoVerified
 * - a file name containing "mismatch" → the plate on the cà vẹt differs → NeedsReview
 * - a file name containing "blur" → nothing readable on that paper → NeedsReview, or Rejected when both are
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

/** Colour family the demo "reads" on the cà vẹt, printed in Vietnamese like the real paper. */
function vietnameseColour(colour: string): string {
  const c = colour.toLowerCase()
  if (c.includes('white')) return 'TRẮNG'
  if (c.includes('black')) return 'ĐEN'
  if (c.includes('red')) return 'ĐỎ'
  if (c.includes('blue') || c.includes('green')) return 'XANH'
  if (c.includes('silver') || c.includes('grey') || c.includes('gray')) return 'BẠC'
  return colour.toUpperCase()
}

function field(
  document: VehicleDocumentType,
  name: string,
  label: string,
  expected: string | null | undefined,
  read: string | null,
  result: FieldResult,
  confidence: number,
  note?: string,
): VerificationFieldDTO {
  return { document, field: name, label, expected, read, result, confidence: read ? confidence : 0, note }
}

/** The simulated OCR + comparison, following the backend rules (VehicleDocumentVerifier). */
async function runOcr(stored: StoredVerification, vehicle: VehicleDTO | undefined) {
  const profile = await profileMock.getProfile()
  const names = [...stored.files.values()].map((f) => (f.dto.fileName ?? '').toLowerCase())
  const blurry = (type: VehicleDocumentType) =>
    [...stored.files.values()].some((f) => f.dto.documentType === type && (f.dto.fileName ?? '').toLowerCase().includes('blur'))
  const mismatch = names.some((n) => n.includes('mismatch'))
  const certificateBlurry = blurry('RegistrationCertificate')
  const cardBlurry = blurry('CitizenId')
  const ownName = profile.fullName.toUpperCase()
  const ownedBySomeoneElse = Boolean(vehicle?.citizenId && vehicle.citizenId !== profile.citizenId)

  const cert = (name: string, label: string, expected: string | undefined, read: string, matches = true) =>
    certificateBlurry
      ? field('RegistrationCertificate', name, label, expected, null, 'Unreadable', 0, 'Too blurry to read reliably.')
      : field('RegistrationCertificate', name, label, expected, read, matches ? 'Match' : 'Mismatch', 0.93)

  const plate = vehicle?.licensePlate ?? ''
  const fields: VerificationFieldDTO[] = [
    cert('plate', 'Plate number', plate, mismatch ? plate.replace(/\d$/, (d) => String((Number(d) + 1) % 10)) : plate, !mismatch),
    cert('brand', 'Brand', vehicle?.brand, (vehicle?.brand ?? '').toUpperCase()),
    cert('model', 'Model', vehicle?.model, (vehicle?.model ?? '').toUpperCase()),
    cert('color', 'Colour', vehicle?.color, vietnameseColour(vehicle?.color ?? '')),
    ownedBySomeoneElse && !certificateBlurry
      ? field('RegistrationCertificate', 'ownerName', 'Owner name', null, 'TRẦN VĂN BÌNH', 'Mismatch', 0.92,
          "The vehicle is registered to another person's Citizen ID; Staff will check the owner.")
      : cert('ownerName', 'Owner name', profile.fullName, ownName),
    cardBlurry
      ? field('CitizenId', 'citizenId', 'Citizen ID number', profile.citizenId, null, 'Unreadable', 0, 'Too blurry to read reliably.')
      : field('CitizenId', 'citizenId', 'Citizen ID number', profile.citizenId, profile.citizenId ?? '', 'Match', 0.96),
    cardBlurry
      ? field('CitizenId', 'fullName', 'Full name', profile.fullName, null, 'Unreadable', 0, 'Too blurry to read reliably.')
      : field('CitizenId', 'fullName', 'Full name', profile.fullName, ownName, 'Match', 0.94),
  ]

  const now = new Date()
  const problems = fields.filter((f) => f.result !== 'Match' || f.confidence < 0.85)
  let status: VehicleVerificationDTO['status'] = 'AutoVerified'
  let statusReason: string | null = null
  if (certificateBlurry && cardBlurry) {
    status = 'Rejected'
    statusReason = 'The photos could not be read. Upload sharp, well-lit photos of the whole registration certificate and Citizen ID card.'
  } else if (problems.length > 0) {
    status = 'NeedsReview'
    const list = (result: FieldResult) => problems.filter((p) => p.result === result).map((p) => p.label)
    statusReason = `Sent to Staff review; ${[
      list('Mismatch').length ? `does not match: ${list('Mismatch').join(', ')}` : '',
      list('Unreadable').length ? `could not be read: ${list('Unreadable').join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('; ')}.`
  }

  const decided = status === 'AutoVerified' || status === 'Rejected'
  stored.dto = {
    ...stored.dto,
    status,
    statusReason,
    fields,
    confidence: Math.min(...fields.map((f) => f.confidence)),
    processedAt: now.toISOString(),
    decidedAt: decided ? now.toISOString() : null,
    filesDeleteAt: decided ? new Date(now.getTime() + RETENTION_DAYS * 86_400_000).toISOString() : null,
  }
}

function draftFor(vehicleId: string): StoredVerification {
  const current = verifications.get(vehicleId)
  if (current?.dto.status === 'Pending' || current?.dto.status === 'Processing')
    mockFail(400, 'Your papers are being checked. Wait for the result before uploading again.')
  if (current?.dto.status === 'Draft') return current

  const fresh: StoredVerification = {
    dto: {
      verificationId: mockId('ver'),
      vehicleId,
      status: 'Draft',
      fields: [],
      documents: [],
      missingDocuments: [],
      createdAt: new Date().toISOString(),
    },
    files: new Map(),
  }
  verifications.set(vehicleId, fresh)
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
          reviewNote: note,
          decidedAt: now.toISOString(),
          filesDeleteAt: new Date(now.getTime() + RETENTION_DAYS * 86_400_000).toISOString(),
        }
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

  /** Queues the "OCR": Processing after a moment, the result a couple of seconds later (like the Hangfire job). */
  submit: (vehicleId: string) =>
    mockResponse(() => {
      const stored = verifications.get(vehicleId)
      if (stored?.dto.status !== 'Draft') mockFail(400, 'Upload the registration certificate and Citizen ID photos first.')
      const missing = snapshot(stored).missingDocuments
      if (missing.length > 0) mockFail(400, `Upload every side first; missing: ${missing.join(', ')}.`)

      stored.dto = { ...stored.dto, status: 'Pending', submittedAt: new Date().toISOString() }
      void (async () => {
        await delay(700)
        stored.dto = { ...stored.dto, status: 'Processing' }
        const vehicles = await profileMock.getVehicles()
        await delay(1600)
        await runOcr(stored, vehicles.find((v) => v.vehicleId === vehicleId))
      })()
      return snapshot(stored)
    }),

  getFile: async (vehicleId: string, documentId: string): Promise<Blob> => {
    await delay(150)
    const file = [...(verifications.get(vehicleId)?.files.values() ?? [])].find((f) => f.dto.documentId === documentId)
    if (!file) mockFail(404, 'Document not found.')
    return file.blob
  },
}
