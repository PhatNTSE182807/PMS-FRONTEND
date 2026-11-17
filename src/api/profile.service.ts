import { isMockService, SERVICE_PATHS } from '@/config/env'
import { profileMock } from '@/mocks/profile.mock'
import type {
  ChangePasswordCommand,
  CreateVehicleCommand,
  PlateAvailabilityDTO,
  ProfileFieldAvailabilityDTO,
  UpdateProfileCommand,
  UserProfileDTO,
  VehicleDTO,
  VehicleTypeDTO,
} from '@/types/profile.dto'
import type { AccountDeletionRequestDTO } from '@/types/identity.dto'
import { mockResponse } from '@/mocks/mockApi'
import { http } from './axiosClient'

const base = SERVICE_PATHS.profile
const mocked = () => isMockService('profile')

/** Demo mode keeps the deletion request in memory. */
let demoDeletionRequest: AccountDeletionRequestDTO | null = null

/** Self-service profile and vehicles of the signed-in user (Identity service). */
export const profileService = {
  getProfile(): Promise<UserProfileDTO> {
    return mocked() ? profileMock.getProfile() : http.get<UserProfileDTO>(base)
  },

  updateProfile(command: UpdateProfileCommand): Promise<UserProfileDTO> {
    return mocked() ? profileMock.updateProfile(command) : http.put<UserProfileDTO>(base, command)
  },

  checkProfileUniqueness(phone?: string, citizenId?: string): Promise<ProfileFieldAvailabilityDTO> {
    return mocked()
      ? profileMock.checkProfileUniqueness(phone, citizenId)
      : http.get<ProfileFieldAvailabilityDTO>(`${base}/check-unique`, {
          params: {
            ...(phone ? { phone } : {}),
            ...(citizenId ? { citizenId } : {}),
          },
        })
  },

  uploadAvatar(file: File): Promise<UserProfileDTO> {
    if (mocked()) return profileMock.uploadAvatar(file)
    const form = new FormData()
    form.append('file', file)
    return http.post<UserProfileDTO>(`${base}/avatar`, form)
  },

  getVehicles(): Promise<VehicleDTO[]> {
    return mocked() ? profileMock.getVehicles() : http.get<VehicleDTO[]>(`${base}/vehicles`)
  },

  checkPlateAvailability(plate: string, excludeVehicleId?: string): Promise<PlateAvailabilityDTO> {
    return mocked()
      ? profileMock.checkPlateAvailability(plate, excludeVehicleId)
      : http.get<PlateAvailabilityDTO>(`${base}/vehicles/check-plate`, {
          params: { plate, ...(excludeVehicleId ? { excludeVehicleId } : {}) },
        })
  },

  getVehicleTypes(): Promise<VehicleTypeDTO[]> {
    return mocked() ? profileMock.getVehicleTypes() : http.get<VehicleTypeDTO[]>(`${base}/vehicle-types`)
  },

  addVehicle(command: CreateVehicleCommand): Promise<VehicleDTO> {
    return mocked() ? profileMock.addVehicle(command) : http.post<VehicleDTO>(`${base}/vehicles`, command)
  },

  deleteVehicle(vehicleId: string): Promise<boolean> {
    return mocked() ? profileMock.deleteVehicle(vehicleId) : http.delete<boolean>(`${base}/vehicles/${vehicleId}`)
  },

  setDefaultVehicle(vehicleId: string): Promise<VehicleDTO> {
    return mocked()
      ? profileMock.setDefaultVehicle(vehicleId)
      : http.patch<VehicleDTO>(`${base}/vehicles/${vehicleId}/default`)
  },

  changePassword(command: ChangePasswordCommand): Promise<boolean> {
    return mocked() ? profileMock.changePassword(command) : http.put<boolean>(`${base}/change-password`, command)
  },

  /** GET /Users/profile/deletion-request: the pending account deletion request, or null. */
  getDeletionRequest(): Promise<AccountDeletionRequestDTO | null> {
    if (mocked()) return mockResponse(() => demoDeletionRequest)
    return http.get<AccountDeletionRequestDTO | null>(`${base}/deletion-request`)
  },

  /** POST /Users/profile/deletion-request: asks the Admins to delete the account; they lock it once it can be closed. */
  requestDeletion(reason?: string): Promise<AccountDeletionRequestDTO> {
    if (mocked())
      return mockResponse(() => {
        demoDeletionRequest ??= { id: 1, reason: reason?.trim() || null, status: 'Pending', requestedAt: new Date().toISOString(), closedAt: null }
        return demoDeletionRequest
      })
    return http.post<AccountDeletionRequestDTO>(`${base}/deletion-request`, { reason: reason?.trim() || null })
  },

  /** DELETE /Users/profile/deletion-request: withdraws the pending request. */
  async cancelDeletion(): Promise<void> {
    if (mocked()) {
      await mockResponse(() => (demoDeletionRequest = null))
      return
    }
    await http.delete(`${base}/deletion-request`)
  },
}
