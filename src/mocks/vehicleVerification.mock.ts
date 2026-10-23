import { profileMock } from '@/mocks/profile.mock'
import { demoSubmittedChecks, type DemoSubmittedCheck } from '@/mocks/vehicleDocument.mock'
import type {
  ReviewVehicleVerificationRequest,
  VehicleDocumentFileDTO,
  VehicleDocumentSide,
  VehicleDocumentType,
  VehicleVerificationReviewDTO,
  VerificationStatus,
} from '@/types/vehicleDocument.dto'
import { isApproved, isWaitingForStaff } from '@/types/vehicleDocument.dto'
import { delay, mockFail, mockResponse } from './mockApi'

/**
 * Demo "backend" of the Staff review queue. It holds a few seeded registrations (with drawn paper
 * photos) and also shows the ones a customer submitted earlier in the same browser session, so the
 * whole flow (register → upload papers → Staff decision) can be shown without a server.
 */

const RETENTION_DAYS = 30
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

/** Escapes text placed inside the generated SVG. */
const xml = (text: string) => text.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!)

/**
 * Draws a stand-in photo of one side of a paper: a tinted card with its printed lines (in Vietnamese,
 * like the real paper), slightly rotated like a phone photo. `blur` softens it to show a poor upload.
 */
function paperPhoto(type: VehicleDocumentType, lines: string[], blur = false): Blob {
  const certificate = type === 'RegistrationCertificate'
  const tint = certificate ? '#e8dcc4' : '#cfe3ea'
  const title = certificate ? 'GIẤY CHỨNG NHẬN ĐĂNG KÝ XE' : 'CĂN CƯỚC CÔNG DÂN'
  const text = lines
    .map((line, i) => `<text x="40" y="${150 + i * 38}" font-size="22" fill="#1f2a30">${xml(line)}</text>`)
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
<defs><filter id="b"><feGaussianBlur stdDeviation="${blur ? 5 : 0.3}"/></filter></defs>
<rect width="640" height="420" fill="#3a4148"/>
<g transform="rotate(-2 320 210)" filter="url(#b)">
<rect x="20" y="25" width="600" height="370" rx="18" fill="${tint}" stroke="#8a7d63" stroke-width="2"/>
<text x="40" y="75" font-size="16" font-weight="700" fill="#a12b2b" font-family="sans-serif">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</text>
<text x="40" y="108" font-size="22" font-weight="800" fill="#13324a" font-family="sans-serif">${title}</text>
<g font-family="monospace">${text}</g>
</g></svg>`
  return new Blob([svg], { type: 'image/svg+xml' })
}

interface SeedFile {
  dto: VehicleDocumentFileDTO
  blob: Blob
}

interface SeedCheck {
  dto: VehicleVerificationReviewDTO
  files: SeedFile[]
}

function file(id: string, type: VehicleDocumentType, side: VehicleDocumentSide, blob: Blob, uploadedAt: string): SeedFile {
  return {
    blob,
    dto: {
      documentId: id,
      documentType: type,
      side,
      fileName: `${type === 'CitizenId' ? 'citizen-id' : 'registration'}-${side.toLowerCase()}.jpg`,
      contentType: blob.type,
      sizeBytes: blob.size,
      uploadedAt,
      isAvailable: true,
    },
  }
}

/** Builds one seeded registration with its three photos. */
function seed(
  id: string,
  options: {
    plate: string
    customer: string
    citizenId: string
    dateOfBirth: string
    ownerCitizenId?: string
    vehicleType: string
    brand: string
    model: string
    color: string
    submittedMinutesAgo: number
    status: VerificationStatus
    certificateLines: string[]
    cardLines: string[]
    blurCard?: boolean
    reviewNote?: string
  },
): SeedCheck {
  const submittedAt = minutesAgo(options.submittedMinutesAgo)
  const uploadedAt = minutesAgo(options.submittedMinutesAgo + 2)
  const decided = !isWaitingForStaff(options.status)
  const decidedAt = decided ? minutesAgo(Math.max(1, options.submittedMinutesAgo - 30)) : null
  const files = [
    file(`${id}-cf`, 'RegistrationCertificate', 'Front', paperPhoto('RegistrationCertificate', options.certificateLines), uploadedAt),
    file(`${id}-if`, 'CitizenId', 'Front', paperPhoto('CitizenId', options.cardLines, options.blurCard), uploadedAt),
  ]
  return {
    files,
    dto: {
      verificationId: id,
      vehicleId: `veh-${id}`,
      licensePlate: options.plate,
      status: options.status,
      statusReason: decided ? null : 'Waiting for Staff to compare your papers with this vehicle.',
      documents: files.map((x) => x.dto),
      missingDocuments: [],
      createdAt: uploadedAt,
      submittedAt,
      decidedAt,
      reviewNote: options.reviewNote ?? null,
      filesDeleteAt: decidedAt ? new Date(new Date(decidedAt).getTime() + RETENTION_DAYS * 86_400_000).toISOString() : null,
      customerName: options.customer,
      customerCitizenId: options.citizenId,
      customerDateOfBirth: options.dateOfBirth,
      vehicleType: options.vehicleType,
      brand: options.brand,
      model: options.model,
      color: options.color,
      ownerCitizenId: options.ownerCitizenId ?? options.citizenId,
    },
  }
}

const seeded: SeedCheck[] = [
  seed('ver-demo-01', {
    plate: '51H-123.46',
    customer: 'Lê Thị Hoa',
    citizenId: '079301004512',
    dateOfBirth: '1990-02-14',
    vehicleType: 'Car',
    brand: 'Toyota',
    model: 'Vios',
    color: 'White',
    submittedMinutesAgo: 42,
    status: 'NeedsReview',
    // The plate on the paper differs from the form by one digit
    certificateLines: ['Biển số: 51H-123.45', 'Nhãn hiệu: TOYOTA   Số loại: VIOS', 'Màu sơn: TRẮNG', 'Chủ xe: LÊ THỊ HOA'],
    cardLines: ['Số: 079301004512', 'Họ và tên: LÊ THỊ HOA', 'Ngày sinh: 14/02/1990'],
  }),
  seed('ver-demo-02', {
    plate: '59X2-456.78',
    customer: 'Phạm Quốc Bảo',
    citizenId: '079098007733',
    dateOfBirth: '1998-09-03',
    ownerCitizenId: '079065001122',
    vehicleType: 'Motorbike',
    brand: 'Honda',
    model: 'Air Blade',
    color: 'Black',
    submittedMinutesAgo: 25,
    status: 'NeedsReview',
    // Registered to a family member
    certificateLines: ['Biển số: 59X2-456.78', 'Nhãn hiệu: HONDA   Số loại: AIR BLADE', 'Màu sơn: ĐEN', 'Chủ xe: PHẠM VĂN TÙNG'],
    cardLines: ['Số: 079098007733', 'Họ và tên: PHẠM QUỐC BẢO', 'Ngày sinh: 03/09/1998'],
  }),
  seed('ver-demo-03', {
    plate: '30G-888.12',
    customer: 'Trần Minh Khoa',
    citizenId: '001099012345',
    dateOfBirth: '1999-11-21',
    vehicleType: 'Car',
    brand: 'Mazda',
    model: 'CX-5',
    color: 'Red',
    submittedMinutesAgo: 9,
    status: 'NeedsReview',
    blurCard: true,
    certificateLines: ['Biển số: 30G-888.12', 'Nhãn hiệu: MAZDA   Số loại: CX-5', 'Màu sơn: ĐỎ', 'Chủ xe: TRẦN MINH KHOA'],
    cardLines: ['Số: 001099012345', 'Họ và tên: TRẦN MINH KHOA', 'Ngày sinh: 21/11/1999'],
  }),
  seed('ver-demo-04', {
    plate: '51K-777.01',
    customer: 'Ngô Thanh Tâm',
    citizenId: '079200004455',
    dateOfBirth: '2000-06-30',
    vehicleType: 'Car',
    brand: 'Kia',
    model: 'Morning',
    color: 'Silver',
    submittedMinutesAgo: 180,
    status: 'Approved',
    reviewNote: 'Plate, owner and Citizen ID match the papers.',
    certificateLines: ['Biển số: 51K-777.01', 'Nhãn hiệu: KIA   Số loại: MORNING', 'Màu sơn: BẠC', 'Chủ xe: NGÔ THANH TÂM'],
    cardLines: ['Số: 079200004455', 'Họ và tên: NGÔ THANH TÂM', 'Ngày sinh: 30/06/2000'],
  }),
]

type Check = { dto: VehicleVerificationReviewDTO; blob: (documentId: string) => Blob | undefined; decide: (approve: boolean, note: string | null) => void }

/** Every registration the mock knows about: the seeded ones and those submitted in this browser session. */
async function allChecks(): Promise<Check[]> {
  const live: DemoSubmittedCheck[] = demoSubmittedChecks()
  const [profile, vehicles] = live.length ? await Promise.all([profileMock.getProfile(), profileMock.getVehicles()]) : [null, []]
  const fromSession = live.map((check) => {
    const vehicle = vehicles.find((v) => v.vehicleId === check.verification.vehicleId)
    const dto: VehicleVerificationReviewDTO = {
      ...check.verification,
      licensePlate: check.verification.licensePlate ?? vehicle?.licensePlate,
      customerName: profile?.fullName,
      customerCitizenId: profile?.citizenId,
      vehicleType: vehicle?.vehicleType,
      brand: vehicle?.brand,
      model: vehicle?.model,
      color: vehicle?.color,
      ownerCitizenId: vehicle?.citizenId,
    }
    return { dto, blob: check.file, decide: check.decide }
  })
  const fromSeed = seeded.map((check) => ({
    dto: check.dto,
    blob: (documentId: string) => check.files.find((x) => x.dto.documentId === documentId)?.blob,
    decide: (approve: boolean, note: string | null) => {
      const now = new Date()
      check.dto = {
        ...check.dto,
        status: approve ? 'Approved' : 'Rejected',
        reviewNote: note,
        decidedAt: now.toISOString(),
        filesDeleteAt: new Date(now.getTime() + RETENTION_DAYS * 86_400_000).toISOString(),
      }
    },
  }))
  return [...fromSeed, ...fromSession]
}

async function find(verificationId: string) {
  const check = (await allChecks()).find((c) => c.dto.verificationId === verificationId)
  if (!check) mockFail(404, 'Verification not found.')
  return check
}

/** Same grouping as the API: legacy OCR statuses count as waiting or approved. */
function inTab(dto: VehicleVerificationReviewDTO, status: VerificationStatus) {
  if (status === 'NeedsReview') return isWaitingForStaff(dto.status)
  if (status === 'Approved') return isApproved(dto.status)
  return dto.status === status
}

export const vehicleVerificationMock = {
  /** Same order as the API: waiting registrations oldest first, decisions newest first. */
  async getQueue(status: VerificationStatus): Promise<VehicleVerificationReviewDTO[]> {
    const checks = await allChecks()
    return mockResponse(() => {
      const list = checks.map((c) => c.dto).filter((dto) => inTab(dto, status))
      return status === 'NeedsReview'
        ? list.sort((a, b) => (a.submittedAt ?? a.createdAt).localeCompare(b.submittedAt ?? b.createdAt))
        : list.sort((a, b) => (b.decidedAt ?? b.createdAt).localeCompare(a.decidedAt ?? a.createdAt))
    })
  },

  async get(verificationId: string): Promise<VehicleVerificationReviewDTO> {
    const check = await find(verificationId)
    return mockResponse(() => check.dto, 250)
  },

  async getFile(verificationId: string, documentId: string): Promise<Blob> {
    const check = await find(verificationId)
    await delay(200)
    const blob = check.blob(documentId)
    if (!blob) mockFail(404, 'Document not found.')
    return blob
  },

  /** Follows the API rules: only waiting registrations, and a rejection needs a note. */
  async review(verificationId: string, request: ReviewVehicleVerificationRequest): Promise<VehicleVerificationReviewDTO> {
    const check = await find(verificationId)
    const note = request.note?.trim() || null
    if (!isWaitingForStaff(check.dto.status)) mockFail(400, 'Only registrations waiting for review can be approved or rejected.')
    if (!request.approve && !note) mockFail(400, 'Give the customer a reason when rejecting.')
    check.decide(request.approve, note)
    return this.get(verificationId)
  },
}
