import { profileMock } from '@/mocks/profile.mock'
import { demoSubmittedChecks, type DemoSubmittedCheck } from '@/mocks/vehicleDocument.mock'
import type {
  ReviewVehicleVerificationRequest,
  VehicleDocumentFileDTO,
  VehicleDocumentSide,
  VehicleDocumentType,
  VehicleVerificationReviewDTO,
  VerificationFieldDTO,
  VerificationStatus,
} from '@/types/vehicleDocument.dto'
import { delay, mockFail, mockResponse } from './mockApi'

/**
 * Demo "backend" of the Staff review queue. It holds a few seeded checks (with drawn paper photos)
 * and also shows the checks a customer submitted earlier in the same browser session, so the whole
 * flow (upload → OCR → NeedsReview → Staff decision) can be shown without a server.
 */

const RETENTION_DAYS = 30
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

/** Escapes text placed inside the generated SVG. */
const xml = (text: string) => text.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!)

/**
 * Draws a stand-in photo of one side of a paper: a tinted card with its printed lines, slightly
 * rotated like a phone photo. `blur` softens it to show an "unreadable" upload.
 */
function paperPhoto(type: VehicleDocumentType, side: VehicleDocumentSide, lines: string[], blur = false): Blob {
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
<text x="600" y="75" font-size="14" font-weight="700" fill="#5b6770" font-family="sans-serif" text-anchor="end">${side === 'Front' ? 'MẶT TRƯỚC' : 'MẶT SAU'}</text>
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
      fileName: `${type === 'CitizenId' ? 'cccd' : 'cavet'}-${side.toLowerCase()}.jpg`,
      contentType: blob.type,
      sizeBytes: blob.size,
      uploadedAt,
      isAvailable: true,
    },
  }
}

function f(
  document: VehicleDocumentType,
  field: string,
  label: string,
  expected: string | null,
  read: string | null,
  result: VerificationFieldDTO['result'],
  confidence: number,
  note?: string,
): VerificationFieldDTO {
  return { document, field, label, expected, read, result, confidence, note: note ?? null }
}

/** Builds one seeded check with its four photos. */
function seed(
  id: string,
  options: {
    plate: string
    customer: string
    citizenId: string
    ownerCitizenId?: string
    vehicleType: string
    brand: string
    model: string
    color: string
    submittedMinutesAgo: number
    status: VerificationStatus
    statusReason: string | null
    fields: VerificationFieldDTO[]
    certificateLines: string[]
    cardLines: string[]
    blurCertificate?: boolean
    blurCard?: boolean
    reviewNote?: string
  },
): SeedCheck {
  const submittedAt = minutesAgo(options.submittedMinutesAgo)
  const uploadedAt = minutesAgo(options.submittedMinutesAgo + 2)
  const decided = options.status === 'Approved' || options.status === 'Rejected' || options.status === 'AutoVerified'
  const decidedAt = decided ? minutesAgo(Math.max(1, options.submittedMinutesAgo - 30)) : null
  const files = [
    file(`${id}-cf`, 'RegistrationCertificate', 'Front', paperPhoto('RegistrationCertificate', 'Front', options.certificateLines, options.blurCertificate), uploadedAt),
    file(`${id}-cb`, 'RegistrationCertificate', 'Back', paperPhoto('RegistrationCertificate', 'Back', ['Ngày đăng ký: 12/03/2021', 'Cơ quan: PC08 TP. Hồ Chí Minh'], options.blurCertificate), uploadedAt),
    file(`${id}-if`, 'CitizenId', 'Front', paperPhoto('CitizenId', 'Front', options.cardLines, options.blurCard), uploadedAt),
    file(`${id}-ib`, 'CitizenId', 'Back', paperPhoto('CitizenId', 'Back', ['Đặc điểm nhận dạng: nốt ruồi', 'Ngày cấp: 05/08/2022'], options.blurCard), uploadedAt),
  ]
  return {
    files,
    dto: {
      verificationId: id,
      vehicleId: `veh-${id}`,
      licensePlate: options.plate,
      status: options.status,
      statusReason: options.statusReason,
      confidence: Math.min(...options.fields.map((x) => x.confidence)),
      fields: options.fields,
      documents: files.map((x) => x.dto),
      missingDocuments: [],
      createdAt: uploadedAt,
      submittedAt,
      processedAt: minutesAgo(options.submittedMinutesAgo - 1),
      decidedAt,
      reviewNote: options.reviewNote ?? null,
      filesDeleteAt: decidedAt ? new Date(new Date(decidedAt).getTime() + RETENTION_DAYS * 86_400_000).toISOString() : null,
      customerName: options.customer,
      customerCitizenId: options.citizenId,
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
    vehicleType: 'Car',
    brand: 'Toyota',
    model: 'Vios',
    color: 'White',
    submittedMinutesAgo: 42,
    status: 'NeedsReview',
    statusReason: 'Sent to Staff review; does not match: Plate number.',
    certificateLines: ['Biển số: 51H-123.45', 'Nhãn hiệu: TOYOTA   Số loại: VIOS', 'Màu sơn: TRẮNG', 'Chủ xe: LÊ THỊ HOA'],
    cardLines: ['Số: 079301004512', 'Họ và tên: LÊ THỊ HOA', 'Ngày sinh: 14/02/1990'],
    fields: [
      f('RegistrationCertificate', 'plate', 'Plate number', '51H-123.46', '51H-123.45', 'Mismatch', 0.93),
      f('RegistrationCertificate', 'brand', 'Brand', 'Toyota', 'TOYOTA', 'Match', 0.95),
      f('RegistrationCertificate', 'model', 'Model', 'Vios', 'VIOS', 'Match', 0.94),
      f('RegistrationCertificate', 'color', 'Colour', 'White', 'TRẮNG', 'Match', 0.9),
      f('RegistrationCertificate', 'ownerName', 'Owner name', 'Lê Thị Hoa', 'LÊ THỊ HOA', 'Match', 0.92),
      f('CitizenId', 'citizenId', 'Citizen ID number', '079301004512', '079301004512', 'Match', 0.97),
      f('CitizenId', 'fullName', 'Full name', 'Lê Thị Hoa', 'LÊ THỊ HOA', 'Match', 0.94),
    ],
  }),
  seed('ver-demo-02', {
    plate: '59X2-456.78',
    customer: 'Phạm Quốc Bảo',
    citizenId: '079098007733',
    ownerCitizenId: '079065001122',
    vehicleType: 'Motorbike',
    brand: 'Honda',
    model: 'Air Blade',
    color: 'Black',
    submittedMinutesAgo: 25,
    status: 'NeedsReview',
    statusReason: 'Sent to Staff review; does not match: Owner name.',
    certificateLines: ['Biển số: 59X2-456.78', 'Nhãn hiệu: HONDA   Số loại: AIR BLADE', 'Màu sơn: ĐEN', 'Chủ xe: PHẠM VĂN TÙNG'],
    cardLines: ['Số: 079098007733', 'Họ và tên: PHẠM QUỐC BẢO', 'Ngày sinh: 03/09/1998'],
    fields: [
      f('RegistrationCertificate', 'plate', 'Plate number', '59X2-456.78', '59X2-456.78', 'Match', 0.96),
      f('RegistrationCertificate', 'brand', 'Brand', 'Honda', 'HONDA', 'Match', 0.95),
      f('RegistrationCertificate', 'model', 'Model', 'Air Blade', 'AIR BLADE', 'Match', 0.91),
      f('RegistrationCertificate', 'color', 'Colour', 'Black', 'ĐEN', 'Match', 0.9),
      f('RegistrationCertificate', 'ownerName', 'Owner name', null, 'PHẠM VĂN TÙNG', 'Mismatch', 0.92,
        "The vehicle is registered to another person's Citizen ID; Staff will check the owner."),
      f('CitizenId', 'citizenId', 'Citizen ID number', '079098007733', '079098007733', 'Match', 0.96),
      f('CitizenId', 'fullName', 'Full name', 'Phạm Quốc Bảo', 'PHẠM QUỐC BẢO', 'Match', 0.93),
    ],
  }),
  seed('ver-demo-03', {
    plate: '30G-888.12',
    customer: 'Trần Minh Khoa',
    citizenId: '001099012345',
    vehicleType: 'Car',
    brand: 'Mazda',
    model: 'CX-5',
    color: 'Red',
    submittedMinutesAgo: 9,
    status: 'NeedsReview',
    statusReason: 'Sent to Staff review; could not be read: Citizen ID number, Full name.',
    blurCard: true,
    certificateLines: ['Biển số: 30G-888.12', 'Nhãn hiệu: MAZDA   Số loại: CX-5', 'Màu sơn: ĐỎ', 'Chủ xe: TRẦN MINH KHOA'],
    cardLines: ['Số: 001099012345', 'Họ và tên: TRẦN MINH KHOA', 'Ngày sinh: 21/11/1999'],
    fields: [
      f('RegistrationCertificate', 'plate', 'Plate number', '30G-888.12', '30G-888.12', 'Match', 0.95),
      f('RegistrationCertificate', 'brand', 'Brand', 'Mazda', 'MAZDA', 'Match', 0.94),
      f('RegistrationCertificate', 'model', 'Model', 'CX-5', 'CX-5', 'Match', 0.9),
      f('RegistrationCertificate', 'color', 'Colour', 'Red', 'ĐỎ', 'Match', 0.89),
      f('RegistrationCertificate', 'ownerName', 'Owner name', 'Trần Minh Khoa', 'TRẦN MINH KHOA', 'Match', 0.92),
      f('CitizenId', 'citizenId', 'Citizen ID number', '001099012345', null, 'Unreadable', 0, 'Too blurry to read reliably.'),
      f('CitizenId', 'fullName', 'Full name', 'Trần Minh Khoa', null, 'Unreadable', 0, 'Too blurry to read reliably.'),
    ],
  }),
  seed('ver-demo-04', {
    plate: '51K-777.01',
    customer: 'Ngô Thanh Tâm',
    citizenId: '079200004455',
    vehicleType: 'Car',
    brand: 'Kia',
    model: 'Morning',
    color: 'Silver',
    submittedMinutesAgo: 180,
    status: 'Approved',
    statusReason: 'Sent to Staff review; does not match: Colour.',
    reviewNote: 'Colour on the paper is "BẠC"; same vehicle. Approved.',
    certificateLines: ['Biển số: 51K-777.01', 'Nhãn hiệu: KIA   Số loại: MORNING', 'Màu sơn: BẠC', 'Chủ xe: NGÔ THANH TÂM'],
    cardLines: ['Số: 079200004455', 'Họ và tên: NGÔ THANH TÂM', 'Ngày sinh: 30/06/2000'],
    fields: [
      f('RegistrationCertificate', 'plate', 'Plate number', '51K-777.01', '51K-777.01', 'Match', 0.96),
      f('RegistrationCertificate', 'color', 'Colour', 'Silver', 'BAC', 'Mismatch', 0.71),
      f('CitizenId', 'citizenId', 'Citizen ID number', '079200004455', '079200004455', 'Match', 0.97),
    ],
  }),
]

/** Every check the mock knows about: the seeded ones and those submitted in this browser session. */
async function allChecks(): Promise<{ dto: VehicleVerificationReviewDTO; blob: (documentId: string) => Blob | undefined; decide: (approve: boolean, note: string | null) => void }[]> {
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

export const vehicleVerificationMock = {
  /** Same order as the API: oldest submission first. */
  async getQueue(status: VerificationStatus): Promise<VehicleVerificationReviewDTO[]> {
    const checks = await allChecks()
    return mockResponse(() =>
      checks
        .map((c) => c.dto)
        .filter((dto) => dto.status === status)
        .sort((a, b) => (a.submittedAt ?? a.createdAt).localeCompare(b.submittedAt ?? b.createdAt)),
    )
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

  /** Follows the API rules: only NeedsReview checks, and a rejection needs a note. */
  async review(verificationId: string, request: ReviewVehicleVerificationRequest): Promise<VehicleVerificationReviewDTO> {
    const check = await find(verificationId)
    const note = request.note?.trim() || null
    if (check.dto.status !== 'NeedsReview') mockFail(400, 'This check is not waiting for review.')
    if (!request.approve && !note) mockFail(400, 'A note is required to reject the papers.')
    check.decide(request.approve, note)
    return this.get(verificationId)
  },
}
