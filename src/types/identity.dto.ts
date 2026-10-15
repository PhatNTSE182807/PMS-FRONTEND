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
