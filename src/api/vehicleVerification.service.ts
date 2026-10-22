import { isMockService } from '@/config/env'
import { vehicleVerificationMock } from '@/mocks/vehicleVerification.mock'
import type {
  ReviewVehicleVerificationRequest,
  VehicleVerificationReviewDTO,
  VerificationStatus,
} from '@/types/vehicleDocument.dto'
import { axiosClient, http, toApiError } from './axiosClient'

const base = '/vehicle-verifications'
// Served by the same PMS.API service as the customer's paper upload, so it follows the profile mock switch
const mocked = () => isMockService('profile')

/** Staff review of new vehicle registrations: compare the papers, then approve or reject (SRS FR-VER-03/04). */
export const vehicleVerificationService = {
  /** Registrations with the given status: NeedsReview (default, oldest first), Approved or Rejected (newest first). */
  getQueue(status: VerificationStatus = 'NeedsReview'): Promise<VehicleVerificationReviewDTO[]> {
    return mocked()
      ? vehicleVerificationMock.getQueue(status)
      : http.get<VehicleVerificationReviewDTO[]>(base, { params: { status } })
  },

  get(verificationId: string): Promise<VehicleVerificationReviewDTO> {
    return mocked()
      ? vehicleVerificationMock.get(verificationId)
      : http.get<VehicleVerificationReviewDTO>(`${base}/${verificationId}`)
  },

  /** The bytes of one uploaded photo (the endpoint needs the bearer token, so it cannot be a plain link). */
  async getFile(verificationId: string, documentId: string): Promise<Blob> {
    if (mocked()) return vehicleVerificationMock.getFile(verificationId, documentId)
    try {
      const response = await axiosClient.get<Blob>(`${base}/${verificationId}/files/${documentId}`, { responseType: 'blob' })
      return response.data
    } catch (error) {
      throw toApiError(error)
    }
  },

  /** Approves or rejects a waiting registration; the API refuses a rejection without a note. */
  review(verificationId: string, request: ReviewVehicleVerificationRequest): Promise<VehicleVerificationReviewDTO> {
    return mocked()
      ? vehicleVerificationMock.review(verificationId, request)
      : http.post<VehicleVerificationReviewDTO>(`${base}/${verificationId}/review`, request)
  },
}
