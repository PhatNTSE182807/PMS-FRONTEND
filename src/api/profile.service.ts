import { isMockService, SERVICE_PATHS } from '@/config/env'
import { profileMock } from '@/mocks/profile.mock'
import type {
  ChangePasswordCommand,
  CreateVehicleCommand,
  UpdateProfileCommand,
  UpdateVehicleCommand,
  UserProfileDTO,
  VehicleDTO,
  VehicleTypeDTO,
} from '@/types/profile.dto'
import { http } from './axiosClient'

const base = SERVICE_PATHS.profile
const mocked = () => isMockService('profile')

/** Self-service profile and vehicles of the signed-in user (Identity service). */
export const profileService = {
  getProfile(): Promise<UserProfileDTO> {
    return mocked() ? profileMock.getProfile() : http.get<UserProfileDTO>(base)
  },

  updateProfile(command: UpdateProfileCommand): Promise<UserProfileDTO> {
    return mocked() ? profileMock.updateProfile(command) : http.put<UserProfileDTO>(base, command)
  },

  getVehicles(): Promise<VehicleDTO[]> {
    return mocked() ? profileMock.getVehicles() : http.get<VehicleDTO[]>(`${base}/vehicles`)
  },

  getVehicleTypes(): Promise<VehicleTypeDTO[]> {
    return mocked() ? profileMock.getVehicleTypes() : http.get<VehicleTypeDTO[]>(`${base}/vehicle-types`)
  },

  addVehicle(command: CreateVehicleCommand): Promise<VehicleDTO> {
    return mocked() ? profileMock.addVehicle(command) : http.post<VehicleDTO>(`${base}/vehicles`, command)
  },

  updateVehicle(vehicleId: string, command: UpdateVehicleCommand): Promise<VehicleDTO> {
    return mocked()
      ? profileMock.updateVehicle(vehicleId, command)
      : http.put<VehicleDTO>(`${base}/vehicles/${vehicleId}`, command)
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
}
