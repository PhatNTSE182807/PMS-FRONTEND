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

const vehicleTypes: VehicleTypeDTO[] = [
  { id: 1, code: 'CAR', name: 'Sedan / Hatchback (Car)', sortOrder: 1 },
  { id: 2, code: 'SUV', name: 'SUV / Crossover / 7-Seater', sortOrder: 2 },
  { id: 3, code: 'MOTORBIKE', name: 'Motorbike / Scooter', sortOrder: 3 },
  { id: 4, code: 'EV', name: 'Electric Vehicle (EV)', sortOrder: 4 },
]

const now = new Date().toISOString()

let vehicles: VehicleDTO[] = [
  {
    vehicleId: 'v-0001',
    licensePlate: '30E-123.45',
    vehicleTypeId: 1,
    vehicleType: vehicleTypes[0].name,
    brand: 'Toyota',
    model: 'Camry',
    color: 'White',
    isDefault: true,
    isActive: true,
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
    isDefault: false,
    isActive: true,
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
    isDefault: command.isDefault,
    isActive: true,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: existing ? new Date().toISOString() : null,
  }
}

function applyDefault(vehicleId: string) {
  vehicles = vehicles.map((v) => ({ ...v, isDefault: v.vehicleId === vehicleId }))
}

export const profileMock = {
  getProfile: () => mockResponse(currentProfile),

  updateProfile: (command: UpdateProfileCommand) =>
    mockResponse(() => {
      profileOverrides = { ...profileOverrides, ...command }
      return currentProfile()
    }),

  getVehicles: () => mockResponse(() => vehicles),

  getVehicleTypes: () => mockResponse(() => vehicleTypes),

  addVehicle: (command: CreateVehicleCommand) =>
    mockResponse(() => {
      const plate = command.licensePlate.trim().toUpperCase()
      if (vehicles.some((v) => v.licensePlate === plate)) mockFail(400, `Vehicle ${plate} is already registered.`)
      const vehicle = toVehicle(command)
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
      if (command.newPassword !== command.confirmPassword) mockFail(400, 'Passwords do not match.')
      return true
    }),
}
