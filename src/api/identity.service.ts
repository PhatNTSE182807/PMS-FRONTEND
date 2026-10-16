import { isMockService, SERVICE_PATHS } from '@/config/env'
import type { SessionUser } from '@/lib/session'
import { authMock } from '@/mocks/auth.mock'
import { customersMock, toCustomerPage } from '@/mocks/customers.mock'
import { staffMock } from '@/mocks/users.mock'
import type { PaginatedResponse } from '@/types/common.dto'
import type {
  AccountRole,
  ActivateAccountCommand,
  CreateEmployeeResponseDTO,
  CustomerAccountDTO,
  CustomerListQuery,
  CreateUserCommand,
  GoogleLoginCommand,
  InternalUserResponseDTO,
  LoginCommand,
  LoginResponseDTO,
  RegisterCommand,
  RegisterResponseDTO,
  RequestLoginOtpCommand,
  ResendTwoFactorCommand,
  ResendTwoFactorResponseDTO,
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

  /** A new Manager/Staff account sets its password with the token from the activation email. */
  activateAccount(command: ActivateAccountCommand): Promise<boolean> {
    return http.post<boolean>(`${SERVICE_PATHS.auth}/activate`, command)
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

    const accounts = await http.get<InternalUserResponseDTO[]>(`${SERVICE_PATHS.staff}/users`, {
      params: {
        role: query.role ? backendRole(query.role) : undefined,
        isActive: query.status ? query.status === 'ACTIVE' : undefined,
        searchTerm: query.search?.trim() || undefined,
      },
    })
    const users = accounts.map(toUserDTO).sort((a, b) => a.fullName.localeCompare(b.fullName))
    return toPage(users, query)
  },

  /**
   * POST /admin/managers or /admin/staff. The account starts inactive: the backend emails an
   * activation token and the user sets a password on /activate before the first login.
   */
  async createStaff(command: CreateUserCommand): Promise<UserDTO> {
    if (isMockService('staff')) return staffMock.create(command)
    const path = command.role === 'MANAGER' ? 'managers' : 'staff'
    const created = await http.post<CreateEmployeeResponseDTO>(`${SERVICE_PATHS.staff}/${path}`, {
      userName: userNameFromEmail(command.email),
      fullName: command.fullName,
      email: command.email,
      password: command.password,
      phoneNumber: command.phoneNumber,
      assignedParkingLot: command.assignedParkingLotIds[0],
    })
    return {
      id: created.id,
      employeeCode: created.employeeCode ?? '',
      fullName: command.fullName,
      email: command.email,
      phoneNumber: command.phoneNumber,
      role: command.role,
      assignedParkingLots: [],
      shift: command.shift,
      status: 'INACTIVE',
      createdAt: new Date().toISOString(),
    }
  },

  updateStaff(id: string, command: UpdateUserCommand): Promise<UserDTO> {
    if (isMockService('staff')) return staffMock.update(id, command)
    return Promise.reject(new Error('Editing staff details is not supported by the backend yet.'))
  },

  /** PATCH /admin/users/{id}/status. The backend only knows active and inactive. */
  async setStaffStatus(id: string, status: UserStatus): Promise<UserDTO> {
    if (isMockService('staff')) return staffMock.setStatus(id, status)
    await http.patch<boolean>(`${SERVICE_PATHS.staff}/users/${id}/status`, { isActive: status === 'ACTIVE' })
    const accounts = await http.get<InternalUserResponseDTO[]>(`${SERVICE_PATHS.staff}/users`)
    const account = accounts.find((a) => a.id === id)
    if (!account) throw new Error('The account no longer exists.')
    return toUserDTO(account)
  },

  resetStaffPassword(id: string): Promise<ResetPasswordResultDTO> {
    if (isMockService('staff')) return staffMock.resetPassword(id)
    return Promise.reject(new Error('Resetting a staff password is not supported by the backend yet.'))
  },
}

function backendRole(role: UserRole): string {
  return role === 'MANAGER' ? 'Manager' : 'Staff'
}

function toUserDTO(account: InternalUserResponseDTO): UserDTO {
  return {
    id: account.id,
    employeeCode: account.employeeCode ?? '',
    fullName: account.fullName || account.userName,
    email: account.email,
    phoneNumber: account.phoneNumber ?? '',
    role: normalizeRole(account.role) === 'MANAGER' ? 'MANAGER' : 'STAFF',
    // Lot assignment and shifts are not stored by the backend yet.
    assignedParkingLots: [],
    status: account.isActive ? 'ACTIVE' : 'INACTIVE',
    createdAt: '',
  }
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
