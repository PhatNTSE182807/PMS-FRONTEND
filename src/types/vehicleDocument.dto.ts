/* Mirrors PMS.Application.Models.VehicleDocuments (VehicleDocumentsController /Users/profile/vehicles/{id}/documents). */

/** Registration certificate (cà vẹt) or Citizen ID card (CCCD). */
export type VehicleDocumentType = 'RegistrationCertificate' | 'CitizenId'
export type VehicleDocumentSide = 'Front' | 'Back'

/**
 * Draft: files being uploaded. Pending/Processing: the OCR job is running. AutoVerified: every field matched
 * with high confidence. NeedsReview: Staff decide. Approved/Rejected: final.
 */
export type VerificationStatus = 'Draft' | 'Pending' | 'Processing' | 'AutoVerified' | 'NeedsReview' | 'Approved' | 'Rejected'

export type FieldResult = 'Match' | 'Mismatch' | 'Unreadable'

/** One compared field: what was typed (or is in the profile) against what OCR read on the paper. */
export interface VerificationFieldDTO {
  document: VehicleDocumentType
  /** plate, brand, model, color, ownerName, citizenId, fullName or dateOfBirth */
  field: string
  label: string
  expected?: string | null
  read?: string | null
  result: FieldResult
  /** 0..1 */
  confidence: number
  note?: string | null
}

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
  confidence?: number | null
  fields: VerificationFieldDTO[]
  documents: VehicleDocumentFileDTO[]
  /** "RegistrationCertificate/Back"-style entries still needed before submitting. */
  missingDocuments: string[]
  createdAt: string
  submittedAt?: string | null
  processedAt?: string | null
  decidedAt?: string | null
  reviewNote?: string | null
  filesDeleteAt?: string | null
  filesDeletedAt?: string | null
}

export const DOCUMENT_SLOTS: { type: VehicleDocumentType; side: VehicleDocumentSide }[] = [
  { type: 'RegistrationCertificate', side: 'Front' },
  { type: 'RegistrationCertificate', side: 'Back' },
  { type: 'CitizenId', side: 'Front' },
  { type: 'CitizenId', side: 'Back' },
]

/** Accepted by the API: JPEG, PNG or PDF up to 10 MB. */
export const DOCUMENT_ACCEPT = 'image/jpeg,image/png,application/pdf'
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024

/* Staff review (VehicleVerificationsController /vehicle-verifications, roles Staff, Manager, Admin). */

/** A check in the Staff review queue, with the account and vehicle data it was compared against. */
export interface VehicleVerificationReviewDTO extends VehicleVerificationDTO {
  customerName?: string | null
  customerCitizenId?: string | null
  vehicleType?: string | null
  brand?: string | null
  model?: string | null
  color?: string | null
  /** Citizen ID of the registered owner typed on the vehicle form (may differ from the customer's). */
  ownerCitizenId?: string | null
}

/** Staff decision on a NeedsReview check; `note` is required when rejecting (shown to the customer). */
export interface ReviewVehicleVerificationRequest {
  approve: boolean
  note?: string | null
}
