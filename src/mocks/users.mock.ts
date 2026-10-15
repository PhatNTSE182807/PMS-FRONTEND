import { generatePassword } from '@/lib/password'
import { removeDiacritics, toSearchable } from '@/lib/text'
import type { PaginatedResponse } from '@/types/common.dto'
import type {
  CreateUserCommand,
  ResetPasswordResultDTO,
  StaffListQuery,
  UpdateUserCommand,
  UserDTO,
  UserStatus,
  WorkShift,
} from '@/types/identity.dto'
import { mockFail, mockId, mockResponse } from './mockApi'
import { findMockLot, MOCK_PARKING_LOTS } from './parkingLots.mock'
import { createRandom, pick, randomInt, shuffle } from './random'

const FAMILY_NAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý']
// Vietnamese middle and given names are gendered ("Thị" is only used for women).
const NAMES = {
  male: {
    middle: ['Văn', 'Minh', 'Hoàng', 'Quốc', 'Gia', 'Bảo', 'Đức', 'Hải', 'Anh', 'Thanh'],
    given: ['An', 'Bình', 'Dũng', 'Hiếu', 'Hùng', 'Khánh', 'Long', 'Nam', 'Phát', 'Phúc', 'Quang', 'Sơn', 'Trung', 'Tuấn', 'Việt', 'Khoa'],
  },
  female: {
    middle: ['Thị', 'Ngọc', 'Thu', 'Phương', 'Thanh', 'Bảo', 'Minh'],
    given: ['Châu', 'Giang', 'Hà', 'Lan', 'Linh', 'Mai', 'Nhung', 'Quỳnh', 'Tâm', 'Thảo', 'Trang', 'Uyên', 'Vy', 'Yến'],
  },
}
const PHONE_PREFIXES = ['090', '093', '097', '098', '086', '091', '094', '088', '070', '079', '077', '032', '033', '035', '039', '056', '058']
const SHIFTS: WorkShift[] = ['MORNING', 'AFTERNOON', 'NIGHT']

const MANAGER_COUNT = 7
const STAFF_COUNT = 31
const DAY_MS = 24 * 60 * 60 * 1000

function seedUsers(): UserDTO[] {
  const random = createRandom(20261014)
  const emails = new Set<string>()
  const now = Date.now()

  const people = Array.from({ length: MANAGER_COUNT + STAFF_COUNT }, (_, index) => {
    const names = random() < 0.5 ? NAMES.male : NAMES.female
    const family = pick(random, FAMILY_NAMES)
    const middle = pick(random, names.middle)
    const given = pick(random, names.given)
    const fullName = `${family} ${middle} ${given}`

    const local = removeDiacritics(`${given}.${family}${middle}`).toLowerCase()
    let email = `${local}@xxivparking.vn`
    for (let n = 2; emails.has(email); n++) email = `${local}${n}@xxivparking.vn`
    emails.add(email)

    const isManager = index < MANAGER_COUNT
    // The first managers each own one lot, so every lot has an active manager on duty.
    const ownedLot = isManager ? MOCK_PARKING_LOTS[index] : undefined
    const lotCount = isManager ? randomInt(random, 1, 3) : 1
    const lots = [...new Set([ownedLot, ...shuffle(random, MOCK_PARKING_LOTS)].filter((lot) => lot !== undefined))]
      .slice(0, lotCount)
      .map(({ id, name }) => ({ id, name }))

    const statusRoll = random()
    const status: UserStatus = ownedLot ? 'ACTIVE' : statusRoll < 0.78 ? 'ACTIVE' : statusRoll < 0.94 ? 'INACTIVE' : 'SUSPENDED'

    return {
      fullName,
      email,
      phoneNumber: `${pick(random, PHONE_PREFIXES)}${String(randomInt(random, 0, 9_999_999)).padStart(7, '0')}`,
      role: isManager ? ('MANAGER' as const) : ('STAFF' as const),
      assignedParkingLots: lots,
      shift: isManager ? undefined : pick(random, SHIFTS),
      status,
      createdAt: new Date(now - randomInt(random, 3, 540) * DAY_MS - randomInt(random, 0, DAY_MS)).toISOString(),
    }
  })

  // Employee codes follow hiring order.
  return people
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((person, index) => ({
      id: `usr-${String(index + 1).padStart(4, '0')}`,
      employeeCode: `NV${String(index + 1).padStart(4, '0')}`,
      ...person,
    }))
}

let users: UserDTO[] = seedUsers()

function findUser(id: string): UserDTO {
  const user = users.find((u) => u.id === id)
  if (!user) mockFail(404, 'Account not found.')
  return user
}

function resolveLots(ids: string[]) {
  return ids.map((id) => {
    const lot = findMockLot(id)
    if (!lot) mockFail(400, `Parking lot ${id} does not exist.`)
    return { id: lot.id, name: lot.name }
  })
}

function validateAssignment(role: UserDTO['role'], lotIds: string[], shift?: WorkShift) {
  if (lotIds.length === 0) mockFail(400, 'Assign at least one parking lot.')
  if (role === 'STAFF' && lotIds.length !== 1) mockFail(400, 'Staff can only be assigned to one parking lot.')
  if (role === 'STAFF' && !shift) mockFail(400, 'Staff must have a shift.')
}

function matchesSearch(user: UserDTO, term: string): boolean {
  const digits = term.replace(/\D/g, '')
  return (
    toSearchable(user.fullName).includes(term) ||
    user.email.toLowerCase().includes(term) ||
    user.employeeCode.toLowerCase().includes(term) ||
    (digits.length >= 3 && user.phoneNumber.includes(digits))
  )
}

export const staffMock = {
  list(query: StaffListQuery): Promise<PaginatedResponse<UserDTO>> {
    return mockResponse(() => {
      const term = toSearchable(query.search ?? '')
      const filtered = users
        .filter((u) => !term || matchesSearch(u, term))
        .filter((u) => !query.role || u.role === query.role)
        .filter((u) => !query.status || u.status === query.status)
        .filter((u) => !query.parkingLotId || u.assignedParkingLots.some((lot) => lot.id === query.parkingLotId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

      const pageSize = Math.max(1, query.pageSize)
      const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
      const pageNumber = Math.min(Math.max(1, query.pageNumber), totalPages)
      return {
        items: filtered.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
        pageNumber,
        pageSize,
        totalCount: filtered.length,
        totalPages,
      }
    })
  },

  create(command: CreateUserCommand): Promise<UserDTO> {
    return mockResponse(() => {
      const email = command.email.trim().toLowerCase()
      if (users.some((u) => u.email.toLowerCase() === email)) mockFail(409, 'This email is already in use.')
      validateAssignment(command.role, command.assignedParkingLotIds, command.shift)

      const nextNumber = users.reduce((max, u) => Math.max(max, Number(u.employeeCode.slice(2))), 0) + 1
      const user: UserDTO = {
        id: mockId('usr'),
        employeeCode: `NV${String(nextNumber).padStart(4, '0')}`,
        fullName: command.fullName.trim(),
        email,
        phoneNumber: command.phoneNumber.trim(),
        role: command.role,
        assignedParkingLots: resolveLots(command.assignedParkingLotIds),
        shift: command.role === 'STAFF' ? command.shift : undefined,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      }
      users = [user, ...users]
      return user
    })
  },

  update(id: string, command: UpdateUserCommand): Promise<UserDTO> {
    return mockResponse(() => {
      validateAssignment(command.role, command.assignedParkingLotIds, command.shift)
      const updated: UserDTO = {
        ...findUser(id),
        fullName: command.fullName.trim(),
        phoneNumber: command.phoneNumber.trim(),
        role: command.role,
        assignedParkingLots: resolveLots(command.assignedParkingLotIds),
        shift: command.role === 'STAFF' ? command.shift : undefined,
      }
      users = users.map((u) => (u.id === id ? updated : u))
      return updated
    })
  },

  setStatus(id: string, status: UserStatus): Promise<UserDTO> {
    return mockResponse(() => {
      const updated = { ...findUser(id), status }
      users = users.map((u) => (u.id === id ? updated : u))
      return updated
    })
  },

  resetPassword(id: string): Promise<ResetPasswordResultDTO> {
    return mockResponse(() => {
      findUser(id)
      return { temporaryPassword: generatePassword() }
    })
  },

  /** Active manager assigned to a lot (used by the capacity mock for "manager on duty"). */
  managerOf(lotId: string): string | undefined {
    return users.find((u) => u.role === 'MANAGER' && u.status === 'ACTIVE' && u.assignedParkingLots.some((l) => l.id === lotId))
      ?.fullName
  },
}
