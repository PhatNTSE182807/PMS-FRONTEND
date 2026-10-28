import { isMockService, SERVICE_PATHS } from '@/config/env'
import type { SessionUser } from '@/lib/session'
import { authMock } from '@/mocks/auth.mock'
import { customersMock, toCustomerPage } from '@/mocks/customers.mock'
import { staffMock } from '@/mocks/users.mock'
import type { EntityRef, PaginatedResponse } from '@/types/common.dto'
import type {
  AccountRole,
  CreateEmployeeResponseDTO,
  CreateManagedStaffCommand,
  EmployeeAccountResponseDTO,
  ManagedStaffQuery,
  UpdateEmployeeCommand,
  CustomerAccountDTO,
  CustomerListQuery,
  CreateUserCommand,
  ForgotPasswordCommand,
  GoogleLoginCommand,
  InternalUserResponseDTO,
  LoginCommand,
  LoginResponseDTO,
  RegisterCommand,
  RegisterResponseDTO,
  RequestLoginOtpCommand,
  ResendTwoFactorCommand,
  ResendTwoFactorResponseDTO,
  ResetPasswordCommand,
  ResetPasswordResultDTO,
  StaffListQuery,
  TwoFactorLoginCommand,
  UpdateUserCommand,
  UserDTO,
  UserRole,
  UserStatus,
  VerifyLoginOtpCommand,
} from '@/types/identity.dto'
import { http } from './axiosClient'

/**
 * Identity service: authentication and account management.
 * Today: PMS.API `UsersController` and `AdminController`. Later: the Identity microservice behind the gateway.
 */
export const identityService = {
  login(command: LoginCommand): Promise<LoginResponseDTO> {
    if (isMockService('auth')) return authMock.login(command)
    return http.post<LoginResponseDTO>(`${SERVICE_PATHS.auth}/authenticate`, command)
  },

  /** Emails a one-time code; an email that never signed in gets a customer account. */
  requestLoginOtp(command: RequestLoginOtpCommand): Promise<string> {
    if (isMockService('auth')) return authMock.requestLoginOtp(command)
    return http.post<string>(`${SERVICE_PATHS.auth}/login-otp/request`, command)
  },

  verifyLoginOtp(command: VerifyLoginOtpCommand): Promise<LoginResponseDTO> {
    if (isMockService('auth')) return authMock.verifyLoginOtp(command)
    return http.post<LoginResponseDTO>(`${SERVICE_PATHS.auth}/login-otp/verify`, command)
  },

  /** Emails a reset link (or a "set a password" link for Google-only accounts). Same answer for unknown emails. */
  forgotPassword(command: ForgotPasswordCommand): Promise<string> {
    if (isMockService('auth')) return authMock.forgotPassword(command)
    return http.post<string>(`${SERVICE_PATHS.auth}/forgot-password`, command)
  },

  /** Sets the new password with the token from the link; the link stops working afterwards. */
  resetPassword(command: ResetPasswordCommand): Promise<string> {
    if (isMockService('auth')) return authMock.resetPassword(command)
    return http.post<string>(`${SERVICE_PATHS.auth}/reset-password`, command)
  },

  /** Customers only: Manager/Staff/Admin accounts keep their password login. */
  loginWithGoogle(command: GoogleLoginCommand): Promise<LoginResponseDTO> {
    return http.post<LoginResponseDTO>(`${SERVICE_PATHS.auth}/login-google`, command)
  },

  /** Second step of a Manager/Staff password login. */
  verifyTwoFactor(command: TwoFactorLoginCommand): Promise<LoginResponseDTO> {
    return http.post<LoginResponseDTO>(`${SERVICE_PATHS.auth}/two-factor`, command)
  },

  /** Sends a fresh code and returns a new challenge token (the old one stops working). */
  resendTwoFactor(command: ResendTwoFactorCommand): Promise<ResendTwoFactorResponseDTO> {
    return http.post<ResendTwoFactorResponseDTO>(`${SERVICE_PATHS.auth}/two-factor/resend`, command)
  },

  register(command: RegisterCommand): Promise<RegisterResponseDTO> {
    if (isMockService('auth')) return authMock.register(command)
    return http.post<RegisterResponseDTO>(`${SERVICE_PATHS.auth}/register`, command)
  },

  /* Customer accounts (Admin, view only) ----------------------------- */

  /**
   * GET /Users (Admin only) filtered to the "User" role. The endpoint has no paging yet,
   * so search and paging happen here until the backend supports them.
   */
  async getCustomers(query: CustomerListQuery): Promise<PaginatedResponse<CustomerAccountDTO>> {
    if (isMockService('auth')) return customersMock.list(query)
    const accounts = await http.get<CustomerAccountDTO[]>(SERVICE_PATHS.auth, { params: { role: 'User' } })
    return toCustomerPage(accounts, query)
  },

  /* Staff accounts (Admin only) ------------------------------------- */

  /**
   * GET /admin/users returns Manager and Staff accounts. Role, status and search are filtered
   * by the backend; it has no paging or lot assignment yet, so paging happens here.
   */
  async getStaff(query: StaffListQuery): Promise<PaginatedResponse<UserDTO>> {
    if (isMockService('staff')) return staffMock.list(query)
    // The backend has no suspended state.
    if (query.status === 'SUSPENDED') return toPage([], query)

    const [accounts, managedLots] = await Promise.all([
      http.get<InternalUserResponseDTO[]>(`${SERVICE_PATHS.staff}/users`, {
        params: {
          role: query.role ? backendRole(query.role) : undefined,
          isActive: query.status ? query.status === 'ACTIVE' : undefined,
          searchTerm: query.search?.trim() || undefined,
        },
      }),
      lotsByManager(),
    ])
    const users = accounts
      .map((account) => toUserDTO(account, managedLots))
      .filter((user) => !query.parkingLotId || user.assignedParkingLots.some((lot) => lot.id === query.parkingLotId))
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
    return toPage(users, query)
  },

  /**
   * POST /admin/managers. Admins create Managers only; Staff are created by the Manager of
   * their lot (POST /manager/staff). The account can sign in with the password set here.
   */
  async createStaff(command: CreateUserCommand): Promise<UserDTO> {
    if (isMockService('staff')) return staffMock.create(command)
    if (command.role !== 'MANAGER') throw new Error('Staff accounts are created by the Manager of their parking lot.')
    const created = await http.post<CreateEmployeeResponseDTO>(`${SERVICE_PATHS.staff}/managers`, {
      userName: userNameFromEmail(command.email),
      fullName: command.fullName,
      email: command.email,
      password: command.password,
      phoneNumber: command.phoneNumber,
    })
    // One Manager per lot: the new Manager takes over the chosen lots
    const assignedParkingLots = await assignManager(created.id, command.assignedParkingLotIds)
    return {
      id: created.id,
      employeeCode: created.employeeCode ?? '',
      fullName: command.fullName,
      email: command.email,
      phoneNumber: command.phoneNumber,
      role: command.role,
      assignedParkingLots,
      shift: command.shift,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    }
  },

  /**
   * PUT /admin/managers/{id} then PUT /admin/managers/{id}/lots. Admins edit Managers only:
   * Staff accounts belong to the Manager of their lot (SRS FR-AUTH-07).
   */
  async updateStaff(id: string, command: UpdateUserCommand): Promise<UserDTO> {
    if (isMockService('staff')) return staffMock.update(id, command)
    if (command.role !== 'MANAGER') throw new Error('Staff accounts are edited by the Manager of their parking lot.')
    const current = await http.get<EmployeeAccountResponseDTO>(`${SERVICE_PATHS.staff}/managers/${id}`)
    await http.put<EmployeeAccountResponseDTO>(`${SERVICE_PATHS.staff}/managers/${id}`, {
      fullName: command.fullName,
      email: current.email,
      phoneNumber: command.phoneNumber,
    })
    const updated = await http.put<EmployeeAccountResponseDTO>(`${SERVICE_PATHS.staff}/managers/${id}/lots`, {
      parkingLotIds: command.assignedParkingLotIds.map(Number),
    })
    return employeeToUserDTO(updated)
  },

  /** PATCH /admin/users/{id}/status. The backend only knows active and inactive. */
  async setStaffStatus(id: string, status: UserStatus): Promise<UserDTO> {
    if (isMockService('staff')) return staffMock.setStatus(id, status)
    await http.patch<boolean>(`${SERVICE_PATHS.staff}/users/${id}/status`, { isActive: status === 'ACTIVE' })
    const accounts = await http.get<InternalUserResponseDTO[]>(`${SERVICE_PATHS.staff}/users`)
    const account = accounts.find((a) => a.id === id)
    if (!account) throw new Error('The account no longer exists.')
    return toUserDTO(account, await lotsByManager())
  },

  resetStaffPassword(id: string): Promise<ResetPasswordResultDTO> {
    if (isMockService('staff')) return staffMock.resetPassword(id)
    return Promise.reject(new Error('Resetting a staff password is not supported by the backend yet.'))
  },

  /* A Manager's own Staff (Manager only, /manager) -------------------- */

  /** GET /manager/staff: Staff working at the lots the signed-in Manager manages. */
  async getManagedStaff(query: ManagedStaffQuery): Promise<UserDTO[]> {
    if (isMockService('team')) return staffMock.teamList(query)
    // The backend has no suspended state.
    if (query.status === 'SUSPENDED') return []
    const accounts = await http.get<EmployeeAccountResponseDTO[]>(`${SERVICE_PATHS.team}/staff`, {
      params: {
        parkingLotId: query.parkingLotId ? Number(query.parkingLotId) : undefined,
        isActive: query.status ? query.status === 'ACTIVE' : undefined,
        searchTerm: query.search?.trim() || undefined,
      },
    })
    return accounts.map(employeeToUserDTO)
  },

  /** POST /manager/staff: the account is active at once and signs in with the password set here. */
  async createManagedStaff(command: CreateManagedStaffCommand): Promise<UserDTO> {
    if (isMockService('team')) return staffMock.teamCreate(command)
    const created = await http.post<EmployeeAccountResponseDTO>(`${SERVICE_PATHS.team}/staff`, {
      ...command,
      parkingLotId: Number(command.parkingLotId),
    })
    return employeeToUserDTO(created)
  },

  async updateManagedStaff(id: string, command: UpdateEmployeeCommand): Promise<UserDTO> {
    if (isMockService('team')) return staffMock.teamUpdate(id, command)
    return employeeToUserDTO(await http.put<EmployeeAccountResponseDTO>(`${SERVICE_PATHS.team}/staff/${id}`, command))
  },

  /** PUT /manager/staff/{id}/lot: moves the Staff member to another lot of the same Manager. */
  async assignManagedStaffLot(id: string, parkingLotId: string): Promise<UserDTO> {
    if (isMockService('team')) return staffMock.teamAssignLot(id, parkingLotId)
    const updated = await http.put<EmployeeAccountResponseDTO>(`${SERVICE_PATHS.team}/staff/${id}/lot`, {
      parkingLotId: Number(parkingLotId),
    })
    return employeeToUserDTO(updated)
  },

  async setManagedStaffStatus(id: string, status: UserStatus): Promise<UserDTO> {
    if (isMockService('team')) return staffMock.setStatus(id, status)
    const updated = await http.patch<EmployeeAccountResponseDTO>(`${SERVICE_PATHS.team}/staff/${id}/status`, {
      isActive: status === 'ACTIVE',
    })
    return employeeToUserDTO(updated)
  },

  /** DELETE /manager/staff/{id}: locks the account and marks it Terminated; nothing is erased (BR-21). */
  deleteManagedStaff(id: string): Promise<boolean> {
    if (isMockService('team')) return staffMock.teamDelete(id)
    return http.delete<boolean>(`${SERVICE_PATHS.team}/staff/${id}`)
  },
}

function backendRole(role: UserRole): string {
  return role === 'MANAGER' ? 'Manager' : 'Staff'
}

function toUserDTO(account: InternalUserResponseDTO, managedLots: Map<string, EntityRef[]>): UserDTO {
  return {
    id: account.id,
    employeeCode: account.employeeCode ?? '',
    fullName: account.fullName || account.userName,
    email: account.email,
    phoneNumber: account.phoneNumber ?? '',
    role: normalizeRole(account.role) === 'MANAGER' ? 'MANAGER' : 'STAFF',
    // A lot names its Manager; Staff lot assignments and shifts are not stored by the backend yet.
    assignedParkingLots: managedLots.get(account.id) ?? [],
    status: account.isActive ? 'ACTIVE' : 'INACTIVE',
    createdAt: account.createdAt ?? '',
  }
}

/** PUT /admin/managers/{id}/lots: the Manager takes over these lots (one Manager per lot) and releases any others. */
async function assignManager(userId: string, lotIds: string[]): Promise<EntityRef[]> {
  if (lotIds.length === 0) return []
  const updated = await http.put<EmployeeAccountResponseDTO>(`${SERVICE_PATHS.staff}/managers/${userId}/lots`, {
    parkingLotIds: lotIds.map(Number),
  })
  return employeeToUserDTO(updated).assignedParkingLots
}

/** EmployeeAccountResponseModel (Admin manager list, Manager staff list) -> the client's UserDTO. */
function employeeToUserDTO(account: EmployeeAccountResponseDTO): UserDTO {
  return {
    id: account.id,
    employeeCode: account.employeeCode ?? '',
    fullName: account.fullName || account.userName,
    email: account.email,
    phoneNumber: account.phoneNumber ?? '',
    role: normalizeRole(account.role) === 'MANAGER' ? 'MANAGER' : 'STAFF',
    assignedParkingLots: account.parkingLots.map(({ id, name }) => ({ id: String(id), name })),
    status: account.isActive ? 'ACTIVE' : 'INACTIVE',
    createdAt: account.createdAt ?? '',
  }
}

/** Manager user id -> the lots they manage (from each lot's managerUserId). */
async function lotsByManager(): Promise<Map<string, EntityRef[]>> {
  const lots = await http.get<{ id: number; name: string; managerUserId: string | null }[]>(`${SERVICE_PATHS.parking}/lots`)
  const byManager = new Map<string, EntityRef[]>()
  for (const lot of lots) {
    if (!lot.managerUserId) continue
    byManager.set(lot.managerUserId, [...(byManager.get(lot.managerUserId) ?? []), { id: String(lot.id), name: lot.name }])
  }
  return byManager
}

/** The backend requires a username; staff are created from an email, so derive it from there. */
function userNameFromEmail(email: string): string {
  return email.trim().split('@')[0].replace(/[^A-Za-z0-9._-]/g, '') || `user${Date.now()}`
}

function toPage<T>(items: T[], { pageNumber, pageSize }: { pageNumber: number; pageSize: number }): PaginatedResponse<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const page = Math.min(Math.max(1, pageNumber), totalPages)
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    pageNumber: page,
    pageSize,
    totalCount: items.length,
    totalPages,
  }
}

const ROLE_MAP: Record<string, AccountRole> = {
  admin: 'ADMIN',
  administrator: 'ADMIN',
  manager: 'MANAGER',
  staff: 'STAFF',
  user: 'USER',
}

/** Backend roles are PascalCase strings ("Admin"); the client uses UPPER_SNAKE. */
export function normalizeRole(role: string | null | undefined): AccountRole {
  return ROLE_MAP[(role ?? '').trim().toLowerCase()] ?? 'USER'
}

export function toSessionUser(dto: LoginResponseDTO): SessionUser {
  return {
    userId: dto.userId,
    username: dto.username,
    // LoginResponseModel has no full name yet; the profile call fills it in later.
    fullName: dto.username,
    email: dto.email,
    phoneNumber: dto.phoneNumber,
    role: normalizeRole(dto.role),
  }
}
