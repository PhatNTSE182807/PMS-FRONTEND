/* Mirrors PMS.Application.Models.Profile (UsersController /Users/profile/*). */

export interface VehicleDTO {
  vehicleId: string
  licensePlate: string
  vehicleTypeId: number
  vehicleType: string
  brand: string
  model: string
  color: string
  isDefault: boolean
  isActive: boolean
  createdAt: string
  updatedAt?: string | null
}

export interface UserProfileDTO {
  userId: string
  fullName: string
  phoneNumber: string
  email: string
  avatarUrl?: string | null
  isActive: boolean
  status: string
  hasPassword: boolean
  role: string
  createdAt?: string | null
  updatedAt?: string | null
  vehicles: VehicleDTO[]
}

export interface VehicleTypeDTO {
  id: number
  code: string
  name: string
  description?: string | null
  sortOrder: number
}

export interface UpdateProfileCommand {
  fullName: string
  email: string
  phoneNumber: string
  avatarUrl: string
}

export interface CreateVehicleCommand {
  licensePlate: string
  vehicleTypeId: number
  brand: string
  model: string
  color: string
  isDefault: boolean
}

export interface UpdateVehicleCommand extends CreateVehicleCommand {
  isActive: boolean
}

export interface ChangePasswordCommand {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}
