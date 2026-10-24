/* Mirrors PMS.Application.Models.VehicleDocuments (VehicleDocumentsController /Users/profile/vehicles/{id}/documents). */

/** Vehicle registration certificate or Citizen ID card. */
export type VehicleDocumentType = 'RegistrationCertificate' | 'CitizenId'
export type VehicleDocumentSide = 'Front' | 'Back'

/**
 * Draft: files being uploaded. NeedsReview: submitted, Staff compare the papers by eye.
 * Approved / Rejected: Staff decision. Pending, Processing and AutoVerified only appear on old checks
 * made while papers were read by OCR (read them as NeedsReview / Approved).
 */
export type VerificationStatus = 'Draft' | 'Pending' | 'Processing' | 'AutoVerified' | 'NeedsReview' | 'Approved' | 'Rejected'

export interface VehicleDocumentFileDTO {
  documentId: string
  documentType: VehicleDocumentType
  side: VehicleDocumentSide
  fileName?: string | null
  contentType: string
  sizeBytes: number
  uploadedAt: string
  /** False once the photo was deleted (30 days after the decision). */
  isAvailable: boolean
}

export interface VehicleVerificationDTO {
  verificationId: string
  vehicleId: string
  licensePlate?: string | null
  status: VerificationStatus
  statusReason?: string | null
  documents: VehicleDocumentFileDTO[]
  /** "CitizenId/Back"-style entries still needed before submitting. */
  missingDocuments: string[]
  createdAt: string
  submittedAt?: string | null
  decidedAt?: string | null
  reviewNote?: string | null
  filesDeleteAt?: string | null
  filesDeletedAt?: string | null
}

/**
 * Every file a registration needs: one photo of the registration certificate (cà vẹt) and one of the
 * Citizen ID card (CCCD). Each is sent as the "Front" side; backs are not asked for.
 */
export const DOCUMENT_SLOTS: { type: VehicleDocumentType; side: VehicleDocumentSide; label: string }[] = [
  { type: 'RegistrationCertificate', side: 'Front', label: 'Registration certificate' },
  { type: 'CitizenId', side: 'Front', label: 'Citizen ID card' },
]

/**
 * Readable name of one uploaded file, e.g. "Citizen ID card". Older registrations may still hold a
 * back photo, which keeps its side in the name.
 */
export const documentLabel = (type: VehicleDocumentType, side: VehicleDocumentSide) =>
  `${type === 'CitizenId' ? 'Citizen ID card' : 'Registration certificate'}${side === 'Back' ? ' · Back' : ''}`

/** Accepted by the API: JPEG, PNG or PDF up to 10 MB. */
export const DOCUMENT_ACCEPT = 'image/jpeg,image/png,application/pdf'
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024

/** Waiting for a Staff decision (legacy OCR statuses included). */
export const isWaitingForStaff = (status: VerificationStatus | null | undefined) =>
  status === 'NeedsReview' || status === 'Pending' || status === 'Processing'

/** Approved by Staff (or by OCR before it was removed): the vehicle can be booked. */
export const isApproved = (status: VerificationStatus | null | undefined) => status === 'Approved' || status === 'AutoVerified'

/* Staff review (VehicleVerificationsController /vehicle-verifications, roles Staff, Manager, Admin). */

/** A registration in the Staff review queue, with the account and vehicle data to compare the papers with. */
export interface VehicleVerificationReviewDTO extends VehicleVerificationDTO {
  customerName?: string | null
  customerCitizenId?: string | null
  /** "YYYY-MM-DD" from the customer's profile. */
  customerDateOfBirth?: string | null
  vehicleType?: string | null
  brand?: string | null
  model?: string | null
  color?: string | null
  /** Citizen ID of the registered owner typed on the vehicle form (may differ from the customer's). */
  ownerCitizenId?: string | null
}

/** Staff decision on a waiting registration; `note` is required when rejecting (shown to the customer). */
export interface ReviewVehicleVerificationRequest {
  approve: boolean
  note?: string | null
}

/** A registration Staff rejected: the vehicle left the fleet; `reviewNote` says why (GET /Users/profile/rejected-vehicles). */
export interface RejectedVehicleDTO {
  verificationId: string
  vehicleId: string
  licensePlate: string
  brand?: string | null
  model?: string | null
  reviewNote?: string | null
  decidedAt?: string | null
}
