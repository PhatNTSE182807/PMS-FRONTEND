import type { EntityRef, PageQuery } from './common.dto'

/* ------------------------------------------------------------------ */
/* Authentication (PMS.API UsersController, live today)                */
/* ------------------------------------------------------------------ */

/** Account roles, normalized to UPPER_SNAKE on the client (backend sends "Admin", "User"…). */
export type AccountRole = 'ADMIN' | 'MANAGER' | 'STAFF' | 'USER'

/** POST /Users/authenticate — PMS.Application.Models.User.LoginUserModel */
export interface LoginCommand {
  email: string
  password: string
}

/** PMS.Application.Models.User.LoginResponseModel */
/** POST /api/Users/login-otp/request: emails a 6-digit sign-in code. */
export interface RequestLoginOtpCommand {
  email: string
}

/** POST /api/Users/login-otp/verify: returns the same payload as a password login. */
export interface VerifyLoginOtpCommand {
  email: string
  code: string
}

export interface LoginResponseDTO {
  userId: string
  username: string
  email: string
  phoneNumber: string
  role: string
  token: string
}

/** POST /Users/register — PMS.Application.Models.User.CreateUserModel */
export interface RegisterCommand {
  userName: string
  fullName: string
  email: string
  password: string
  phoneNumber: string
}

/** PMS.Application.Models.User.CreateUserResponseModel */
export interface RegisterResponseDTO {
  id: string
}

/* ------------------------------------------------------------------ */
/* Staff account management (Identity service, /v1/identity/staff)     */
/* Not implemented by the backend yet: served from mocks/users.mock.ts. */
/* ------------------------------------------------------------------ */

export type UserRole = 'MANAGER' | 'STAFF'
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
export type WorkShift = 'MORNING' | 'AFTERNOON' | 'NIGHT'

export interface UserDTO {
  id: string
  employeeCode: string
  fullName: string
  email: string
  phoneNumber: string
  role: UserRole
  assignedParkingLots: EntityRef[]
  /** Staff only: the shift they are rostered on. */
  shift?: WorkShift
  status: UserStatus
  createdAt: string
}

/**
 * Customer (driver) account as returned by GET /Users
 * (PMS.Application.Models.User.UserResponseModel).
 */
export interface CustomerAccountDTO {
  id: string
  userName: string
  email: string
  phoneNumber: string
  role: string
}

export interface CustomerListQuery extends PageQuery {
  /** Matches username, email or phone number. */
  search?: string
}

export interface StaffListQuery extends PageQuery {
  /** Matches name, email, employee code or phone number. */
  search?: string
  role?: UserRole
  parkingLotId?: string
  status?: UserStatus
}

export interface CreateUserCommand {
  fullName: string
  email: string
  phoneNumber: string
  role: UserRole
  assignedParkingLotIds: string[]
  shift?: WorkShift
  /** Omitted when the server should generate one. */
  password?: string
  sendWelcomeEmail: boolean
}

export interface UpdateUserCommand {
  fullName: string
  phoneNumber: string
  role: UserRole
  assignedParkingLotIds: string[]
  shift?: WorkShift
}

export interface ResetPasswordResultDTO {
  temporaryPassword: string
}
