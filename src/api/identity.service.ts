import { isMockService, SERVICE_PATHS } from '@/config/env'
import type { SessionUser } from '@/lib/session'
import { authMock } from '@/mocks/auth.mock'
import { customersMock, toCustomerPage } from '@/mocks/customers.mock'
import { staffMock } from '@/mocks/users.mock'
import type { PaginatedResponse } from '@/types/common.dto'
import type {
  AccountRole,
  CustomerAccountDTO,
  CustomerListQuery,
  CreateUserCommand,
  LoginCommand,
  LoginResponseDTO,
  RegisterCommand,
  RegisterResponseDTO,
  RequestLoginOtpCommand,
  ResetPasswordResultDTO,
  StaffListQuery,
  UpdateUserCommand,
  UserDTO,
  UserStatus,
  VerifyLoginOtpCommand,
} from '@/types/identity.dto'
import { http } from './axiosClient'

/**
 * Identity service: authentication and account management.
 * Today: PMS.API `UsersController`. Later: the Identity microservice behind the gateway.
 */
export const identityService = {
  login(command: LoginCommand): Promise<LoginResponseDTO> {
    if (isMockService('auth')) return authMock.login(command)
    return http.post<LoginResponseDTO>(`${SERVICE_PATHS.auth}/authenticate`, command)
  },

  /** Emails a one-time code; the backend answers the same way for unknown emails. */
  requestLoginOtp(command: RequestLoginOtpCommand): Promise<string> {
    if (isMockService('auth')) return authMock.requestLoginOtp(command)
    return http.post<string>(`${SERVICE_PATHS.auth}/login-otp/request`, command)
  },

  verifyLoginOtp(command: VerifyLoginOtpCommand): Promise<LoginResponseDTO> {
    if (isMockService('auth')) return authMock.verifyLoginOtp(command)
    return http.post<LoginResponseDTO>(`${SERVICE_PATHS.auth}/login-otp/verify`, command)
  },

  register(command: RegisterCommand): Promise<RegisterResponseDTO> {
    if (isMockService('auth')) return authMock.register(command)
    return http.post<RegisterResponseDTO>(`${SERVICE_PATHS.auth}/register`, command)
  },

  /* Customer accounts (Admin, view only) ----------------------------- */

  /**
   * GET /Users returns every account; customers are the "User" role. The endpoint has no
   * paging yet, so search and paging happen here until the backend supports them.
   */
  async getCustomers(query: CustomerListQuery): Promise<PaginatedResponse<CustomerAccountDTO>> {
    if (isMockService('auth')) return customersMock.list(query)
    const accounts = await http.get<CustomerAccountDTO[]>(SERVICE_PATHS.auth)
    return toCustomerPage(accounts, query)
  },

  /* Staff accounts (Admin only) ------------------------------------- */

  getStaff(query: StaffListQuery): Promise<PaginatedResponse<UserDTO>> {
    if (isMockService('staff')) return staffMock.list(query)
    return http.get<PaginatedResponse<UserDTO>>(SERVICE_PATHS.staff, { params: query })
  },

  createStaff(command: CreateUserCommand): Promise<UserDTO> {
    if (isMockService('staff')) return staffMock.create(command)
    return http.post<UserDTO>(SERVICE_PATHS.staff, command)
  },

  updateStaff(id: string, command: UpdateUserCommand): Promise<UserDTO> {
    if (isMockService('staff')) return staffMock.update(id, command)
    return http.put<UserDTO>(`${SERVICE_PATHS.staff}/${id}`, command)
  },

  setStaffStatus(id: string, status: UserStatus): Promise<UserDTO> {
    if (isMockService('staff')) return staffMock.setStatus(id, status)
    return http.patch<UserDTO>(`${SERVICE_PATHS.staff}/${id}/status`, { status })
  },

  resetStaffPassword(id: string): Promise<ResetPasswordResultDTO> {
    if (isMockService('staff')) return staffMock.resetPassword(id)
    return http.post<ResetPasswordResultDTO>(`${SERVICE_PATHS.staff}/${id}/reset-password`)
  },
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
