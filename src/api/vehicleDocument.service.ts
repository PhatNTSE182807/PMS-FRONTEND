import { isMockService, SERVICE_PATHS } from '@/config/env'
import { vehicleDocumentMock } from '@/mocks/vehicleDocument.mock'
import type { RejectedVehicleDTO, VehicleDocumentSide, VehicleDocumentType, VehicleVerificationDTO } from '@/types/vehicleDocument.dto'
import { axiosClient, http, toApiError } from './axiosClient'

const base = SERVICE_PATHS.profile
const mocked = () => isMockService('profile')
const documentsUrl = (vehicleId: string) => `${base}/vehicles/${vehicleId}/documents`

/** Upload of a vehicle's papers (registration certificate + Citizen ID) for Staff review. Same backend service as the profile. */
export const vehicleDocumentService = {
  /** The vehicle's latest check, or null when no papers were uploaded yet. */
  getLatest(vehicleId: string): Promise<VehicleVerificationDTO | null> {
    return mocked()
      ? vehicleDocumentMock.getLatest(vehicleId)
      : http.get<VehicleVerificationDTO | null>(documentsUrl(vehicleId))
  },

  /** Uploads (or replaces) one paper side; `onProgress` receives 0..100. */
  upload(
    vehicleId: string,
    type: VehicleDocumentType,
    side: VehicleDocumentSide,
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<VehicleVerificationDTO> {
    if (mocked()) return vehicleDocumentMock.upload(vehicleId, type, side, file, onProgress)
    const form = new FormData()
    form.append('file', file)
    return http.post<VehicleVerificationDTO>(`${documentsUrl(vehicleId)}/${type}/${side}`, form, {
      // Photos can be several MB on a phone connection
      timeout: 120_000,
      onUploadProgress: (event) => onProgress?.(event.total ? Math.round((event.loaded / event.total) * 100) : 0),
    })
  },

  /** Submits the uploaded papers to the Staff review queue. */
  submit(vehicleId: string): Promise<VehicleVerificationDTO> {
    return mocked()
      ? vehicleDocumentMock.submit(vehicleId)
      : http.post<VehicleVerificationDTO>(`${documentsUrl(vehicleId)}/submit`)
  },

  /** Registrations Staff rejected in the last 30 days (vehicle removed, plate not registered again). */
  getRecentlyRejected(): Promise<RejectedVehicleDTO[]> {
    return mocked() ? vehicleDocumentMock.getRecentlyRejected() : http.get<RejectedVehicleDTO[]>(`${base}/rejected-vehicles`)
  },

  /** The bytes of one uploaded file (the endpoint needs the bearer token, so it cannot be a plain link). */
  async getFile(vehicleId: string, documentId: string): Promise<Blob> {
    if (mocked()) return vehicleDocumentMock.getFile(vehicleId, documentId)
    try {
      const response = await axiosClient.get<Blob>(`${documentsUrl(vehicleId)}/files/${documentId}`, { responseType: 'blob' })
      return response.data
    } catch (error) {
      throw toApiError(error)
    }
  },
}
