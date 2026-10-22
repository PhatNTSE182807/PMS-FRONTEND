/* Mirrors PMS.Application.Models.Profile (UsersController /Users/profile/*). */

export interface VehicleDTO {
  vehicleId: string
  licensePlate: string
  vehicleTypeId: number
  vehicleType: string
  brand: string
  model: string
  color: string
  /** Citizen ID (CCCD) of the registered owner on the vehicle papers. */
  citizenId?: string | null
  isDefault: boolean
  isActive: boolean
  /**
   * Registration status from the latest paper check: null (papers not submitted), Draft, NeedsReview
   * (waiting for Staff), Approved or Rejected. Only an approved vehicle can be booked.
   */
  verificationStatus?: 'Draft' | 'NeedsReview' | 'Approved' | 'Rejected' | null
  /** Staff note on the latest decision (the reason when rejected). */
  verificationNote?: string | null
  createdAt: string
  updatedAt?: string | null
}

export interface UserProfileDTO {
  userId: string
  fullName: string
  phoneNumber: string
  email: string
  avatarUrl?: string | null
  /** Citizen ID (CCCD); null for Google accounts that have not added it yet. */
  citizenId?: string | null
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
  /** Left unchanged when empty. */
  citizenId?: string
}

export interface CreateVehicleCommand {
  licensePlate: string
  vehicleTypeId: number
  brand: string
  model: string
  color: string
  /** Citizen ID (CCCD) of the registered owner; the backend uses the account's own when empty. */
  citizenId?: string
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
