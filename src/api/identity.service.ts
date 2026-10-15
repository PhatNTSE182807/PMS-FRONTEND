import { isMockService, SERVICE_PATHS } from '@/config/env'
import type { SessionUser } from '@/lib/session'
import { authMock } from '@/mocks/auth.mock'
import type {
  AccountRole,
  LoginCommand,
  LoginResponseDTO,
  RegisterCommand,
  RegisterResponseDTO,
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

  register(command: RegisterCommand): Promise<RegisterResponseDTO> {
    if (isMockService('auth')) return authMock.register(command)
    return http.post<RegisterResponseDTO>(`${SERVICE_PATHS.auth}/register`, command)
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
