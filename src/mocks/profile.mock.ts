import { isValidPassword, PASSWORD_RULE_MESSAGE } from '@/lib/password'
import { session } from '@/lib/session'
import type {
  ChangePasswordCommand,
  CreateVehicleCommand,
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

function currentProfile(): UserProfileDTO {
  const user = session.getUser()
  return {
    userId: user?.userId ?? 'u-demo',
    fullName: user?.fullName ?? 'Demo User',
    email: user?.email ?? 'demo@xxivparking.vn',
    phoneNumber: user?.phoneNumber ?? '0988123456',
    avatarUrl: user?.avatarUrl ?? null,
    citizenId: DEMO_CITIZEN_ID,
    isActive: true,
    status: 'Active',
    hasPassword: true,
    role: user?.role === 'ADMIN' ? 'Admin' : 'User',
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
      // The email is not changed from the profile form, so it is left out of the overrides
      const { citizenId, email: _email, ...details } = command
      profileOverrides = { ...profileOverrides, ...details, ...(citizenId?.trim() ? { citizenId: citizenId.trim() } : {}) }
      return currentProfile()
    }),

  getVehicles: () => mockResponse(() => vehicles),

  getVehicleTypes: () => mockResponse(() => vehicleTypes),

  addVehicle: (command: CreateVehicleCommand) =>
    mockResponse(() => {
      const profile = currentProfile()
      if (!profile.citizenId?.trim()) mockFail(400, 'Please save your Citizen ID (CCCD) in your profile before registering a vehicle.')
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
