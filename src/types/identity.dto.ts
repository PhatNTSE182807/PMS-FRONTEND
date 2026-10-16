import type { EntityRef, PageQuery } from './common.dto'

/* ------------------------------------------------------------------ */
/* Authentication (PMS.API UsersController, live today)                */
/* ------------------------------------------------------------------ */

/** Account roles, normalized to UPPER_SNAKE on the client (backend sends "Admin", "User"…). */
export type AccountRole = 'ADMIN' | 'MANAGER' | 'STAFF' | 'USER'

/**
 * POST /Users/authenticate — PMS.Application.Models.User.LoginUserModel.
 * Customers sign in with an email, Manager/Staff accounts may use their username.
 */
export interface LoginCommand {
  email?: string
  username?: string
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
  /** Null while a second factor is still required. */
  token: string | null
  /** Activated Manager/Staff accounts must confirm a code emailed to them. */
  requiresTwoFactor?: boolean
  /** Short-lived challenge token for /Users/two-factor; never a bearer token. */
  twoFactorToken?: string | null
  /** Masked email the code was sent to. */
  destination?: string | null
}

/** POST /Users/login-google: the ID token from Google Identity Services. The first sign-in creates the account. */
export interface GoogleLoginCommand {
  idToken: string
}

/** POST /Users/two-factor — PMS.Application.Models.User.TwoFactorLoginModel */
export interface TwoFactorLoginCommand {
  twoFactorToken: string
  code: string
}

/** POST /Users/two-factor/resend — ResendTwoFactorModel / ResendTwoFactorResponseModel */
export interface ResendTwoFactorCommand {
  twoFactorToken: string
}

export interface ResendTwoFactorResponseDTO {
  succeeded: boolean
  twoFactorToken: string | null
  destination: string | null
  message: string | null
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
/* Staff account management (PMS.API AdminController, /admin)          */
/* Editing details and password resets have no endpoint yet: mock only. */
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
  fullName?: string | null
  email: string
  phoneNumber: string
  role: string
  isActive?: boolean
}

/** PMS.Application.Models.User.UserResponseModel, as returned by GET /admin/users. */
export interface InternalUserResponseDTO {
  id: string
  userName: string
  fullName: string | null
  email: string
  phoneNumber: string | null
  role: string
  employeeCode: string | null
  isActive: boolean
  /** Employee record creation time; null for customers. */
  createdAt: string | null
}

/** PMS.Application.Models.User.CreateUserResponseModel for POST /admin/managers and /admin/staff. */
export interface CreateEmployeeResponseDTO {
  id: string
  employeeCode: string | null
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
