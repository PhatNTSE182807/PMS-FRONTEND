import { isValidPassword, PASSWORD_RULE_MESSAGE } from '@/lib/password'
import { session } from '@/lib/session'
import type {
  ChangePasswordCommand,
  CreateVehicleCommand,
  ProfileFieldAvailabilityDTO,
  UpdateProfileCommand,
  UpdateVehicleCommand,
  UserProfileDTO,
  VehicleDTO,
  VehicleTypeDTO,
} from '@/types/profile.dto'
import { mockFail, mockId, mockResponse } from './mockApi'

/** The only vehicle types the system accepts: 4-seat cars, 7-seat cars and motorbikes (same codes as the API). */
const vehicleTypes: VehicleTypeDTO[] = [
  { id: 1, code: 'CAR_4', name: '4-Seat Car', description: 'Sedan / hatchback up to 5 seats', sortOrder: 1 },
  { id: 2, code: 'CAR_7', name: '7-Seat Car', description: 'SUV / MPV up to 7 seats', sortOrder: 2 },
  { id: 3, code: 'MOTORBIKE', name: 'Motorbike', description: 'Two-wheeled motorcycles', sortOrder: 3 },
]

const now = new Date().toISOString()
/** The demo driver's own Citizen ID (CCCD). */
const DEMO_CITIZEN_ID = '079099001234'

let vehicles: VehicleDTO[] = [
  {
    vehicleId: 'v-0001',
    licensePlate: '30E-123.45',
    vehicleTypeId: 1,
    vehicleType: vehicleTypes[0].name,
    brand: 'Toyota',
    model: 'Camry',
    color: 'White',
    citizenId: DEMO_CITIZEN_ID,
    isDefault: true,
    isActive: true,
    verificationStatus: 'Approved',
    createdAt: now,
  },
  {
    vehicleId: 'v-0002',
    licensePlate: '29A-678.90',
    vehicleTypeId: 2,
    vehicleType: vehicleTypes[1].name,
    brand: 'Honda',
    model: 'CR-V',
    color: 'Red',
    citizenId: DEMO_CITIZEN_ID,
    isDefault: false,
    isActive: true,
    verificationStatus: 'Approved',
    createdAt: now,
  },
]

let profileOverrides: Partial<UserProfileDTO> = {}

import { findUserByLogin } from './users.mock'

function currentProfile(): UserProfileDTO {
  const user = session.getUser()
  const found = user ? (findUserByLogin(user.userId) || findUserByLogin(user.email) || findUserByLogin(user.username)) : undefined
  const fullName = found?.fullName || (user?.fullName && user.fullName !== user.username ? user.fullName : found?.fullName || user?.fullName || 'Demo User')
  const employeeCode = found?.employeeCode || user?.employeeCode || (user?.role === 'STAFF' ? 'EMP-0418' : user?.role === 'MANAGER' ? 'EMP-0091' : undefined)

  return {
    userId: user?.userId ?? 'u-demo',
    fullName,
    employeeCode,
    email: found?.email ?? user?.email ?? 'demo@xxivparking.vn',
    phoneNumber: found?.phoneNumber ?? user?.phoneNumber ?? '0988123456',
    avatarUrl: user?.avatarUrl ?? null,
    citizenId: DEMO_CITIZEN_ID,
    isActive: true,
    status: 'Active',
    hasPassword: true,
    role: user?.role === 'ADMIN' ? 'Admin' : user?.role === 'MANAGER' ? 'Manager' : user?.role === 'STAFF' ? 'Staff' : 'User',
    createdAt: now,
    ...profileOverrides,
    vehicles,
  }
}

function findVehicle(vehicleId: string): VehicleDTO {
  const vehicle = vehicles.find((v) => v.vehicleId === vehicleId)
  if (!vehicle) mockFail(404, 'Vehicle not found.')
  return vehicle
}

function toVehicle(command: CreateVehicleCommand, existing?: VehicleDTO): VehicleDTO {
  return {
    vehicleId: existing?.vehicleId ?? mockId('v'),
    licensePlate: command.licensePlate.trim().toUpperCase(),
    vehicleTypeId: command.vehicleTypeId,
    vehicleType: vehicleTypes.find((t) => t.id === command.vehicleTypeId)?.name ?? 'Car',
    brand: command.brand,
    model: command.model,
    color: command.color,
    // Same rule as the backend: the owner's Citizen ID, else the account's own
    citizenId: command.citizenId?.trim() || existing?.citizenId || currentProfile().citizenId,
    isDefault: command.isDefault,
    isActive: true,
    // A new vehicle has no papers yet; an edit keeps the registration status
    verificationStatus: existing?.verificationStatus ?? null,
    verificationNote: existing?.verificationNote ?? null,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: existing ? new Date().toISOString() : null,
  }
}

/**
 * Called by the papers mock when Staff reject a registration: like the API, the vehicle leaves the
 * fleet and another one becomes primary. Returns the removed vehicle (for the rejection notice).
 */
export function removeDemoVehicle(vehicleId: string): VehicleDTO | undefined {
  const removed = vehicles.find((v) => v.vehicleId === vehicleId)
  vehicles = vehicles.filter((v) => v.vehicleId !== vehicleId)
  if (removed?.isDefault && vehicles.length > 0) applyDefault(vehicles[vehicles.length - 1].vehicleId)
  return removed
}

/** Plates of the demo fleet right now (a re-registered plate hides its rejection notice). */
export const demoVehiclePlates = () => vehicles.map((v) => v.licensePlate)

function applyDefault(vehicleId: string) {
  vehicles = vehicles.map((v) => ({ ...v, isDefault: v.vehicleId === vehicleId }))
}

/** Called by the papers mock when a check is submitted or decided, like the API's status on the vehicle list. */
export function setDemoVehicleRegistration(vehicleId: string, status: VehicleDTO['verificationStatus'], note: string | null = null) {
  vehicles = vehicles.map((v) => (v.vehicleId === vehicleId ? { ...v, verificationStatus: status, verificationNote: note } : v))
}

export const profileMock = {
  getProfile: () => mockResponse(currentProfile),

  updateProfile: (command: UpdateProfileCommand) =>
    mockResponse(() => {
      const current = currentProfile()
      const normalizedPhone = command.phoneNumber?.trim()
      const normalizedCitizenId = command.citizenId?.trim()

      if (normalizedPhone && normalizedPhone !== current.phoneNumber && normalizedPhone === '0909090909') {
        mockFail(400, 'Phone number is already registered to another account.')
      }
      if (normalizedCitizenId && normalizedCitizenId !== current.citizenId && normalizedCitizenId === '012345678901') {
        mockFail(400, 'Citizen ID is already registered to another account.')
      }

      // The email is not changed from the profile form, so it is left out of the overrides
      const { citizenId, email: _email, ...details } = command
      profileOverrides = { ...profileOverrides, ...details, ...(citizenId?.trim() ? { citizenId: citizenId.trim() } : {}) }
      return currentProfile()
    }),

  checkProfileUniqueness: (phone?: string, citizenId?: string) =>
    mockResponse<ProfileFieldAvailabilityDTO>(() => {
      const current = currentProfile()
      const normalizedPhone = phone?.trim()
      const normalizedCitizenId = citizenId?.trim()

      const takenPhone = '0909090909'
      const takenCitizenId = '012345678901'

      const isPhoneTaken = Boolean(
        normalizedPhone &&
        normalizedPhone !== current.phoneNumber &&
        normalizedPhone === takenPhone
      )

      const isCitizenIdTaken = Boolean(
        normalizedCitizenId &&
        normalizedCitizenId !== current.citizenId &&
        normalizedCitizenId === takenCitizenId
      )

      return {
        isPhoneAvailable: !isPhoneTaken,
        phoneReason: isPhoneTaken ? 'Phone number is already registered to another account.' : null,
        isCitizenIdAvailable: !isCitizenIdTaken,
        citizenIdReason: isCitizenIdTaken ? 'Citizen ID is already registered to another account.' : null,
      }
    }),

  uploadAvatar: (file: File) =>
    mockResponse(() => {
      if (!file) mockFail(400, 'No file was uploaded.')
      if (file.size > 2 * 1024 * 1024) mockFail(400, 'Avatar image must be smaller than 2 MB.')
      const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      if (!allowed.includes(file.type)) mockFail(400, 'Only JPEG, PNG, GIF and WebP images are allowed.')
      const avatarUrl = URL.createObjectURL(file)
      profileOverrides = { ...profileOverrides, avatarUrl }
      session.updateUser({ avatarUrl })
      return currentProfile()
    }),

  getVehicles: () => mockResponse(() => vehicles),

  checkPlateAvailability: (plate: string, excludeVehicleId?: string) =>
    mockResponse(() => {
      const normalized = plate.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
      const existing = vehicles.find(
        (v) =>
          (!excludeVehicleId || v.vehicleId !== excludeVehicleId) &&
          v.licensePlate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === normalized &&
          v.isActive,
      )
      if (existing) {
        return {
          licensePlate: plate.trim().toUpperCase(),
          isAvailable: false,
          reason: 'This license plate is already registered by another account.',
        }
      }
      return {
        licensePlate: plate.trim().toUpperCase(),
        isAvailable: true,
      }
    }),

  getVehicleTypes: () => mockResponse(() => vehicleTypes),

  addVehicle: (command: CreateVehicleCommand) =>
    mockResponse(() => {
      const profile = currentProfile()
      if (!profile.citizenId?.trim()) mockFail(400, 'Your Citizen ID must be saved in your profile before registering a vehicle.')
      const plate = command.licensePlate.trim().toUpperCase()
      if (vehicles.some((v) => v.licensePlate === plate)) mockFail(400, `Vehicle ${plate} is already registered.`)
      const vehicle = toVehicle({ ...command, citizenId: profile.citizenId })
      vehicles = [...vehicles, vehicle]
      if (command.isDefault || vehicles.length === 1) applyDefault(vehicle.vehicleId)
      return findVehicle(vehicle.vehicleId)
    }),

  updateVehicle: (vehicleId: string, command: UpdateVehicleCommand) =>
    mockResponse(() => {
      const updated = toVehicle(command, findVehicle(vehicleId))
      vehicles = vehicles.map((v) => (v.vehicleId === vehicleId ? updated : v))
      if (command.isDefault) applyDefault(vehicleId)
      return findVehicle(vehicleId)
    }),

  deleteVehicle: (vehicleId: string) =>
    mockResponse(() => {
      findVehicle(vehicleId)
      vehicles = vehicles.filter((v) => v.vehicleId !== vehicleId)
      return true
    }),

  setDefaultVehicle: (vehicleId: string) =>
    mockResponse(() => {
      findVehicle(vehicleId)
      applyDefault(vehicleId)
      return findVehicle(vehicleId)
    }),

  changePassword: (command: ChangePasswordCommand) =>
    mockResponse(() => {
      // Same checks as the API (ChangePasswordModelValidator), so demo mode behaves like the backend.
      if (!isValidPassword(command.newPassword)) mockFail(400, PASSWORD_RULE_MESSAGE)
      if (command.newPassword !== command.confirmPassword) mockFail(400, 'Passwords do not match.')
      return true
    }),
}
