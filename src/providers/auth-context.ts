import { createContext } from 'react'
import type { SessionUser } from '@/lib/session'
import type { LoginCommand, VerifyLoginOtpCommand } from '@/types/identity.dto'

export interface LoginInput extends LoginCommand {
  rememberMe: boolean
}

/** Returned by login instead of a session when the account must confirm an emailed code. */
export interface TwoFactorChallenge {
  kind: 'two-factor'
  twoFactorToken: string
  /** Masked email the code went to. */
  destination: string
  rememberMe: boolean
}

export interface GoogleLoginInput {
  idToken: string
  rememberMe: boolean
}

export interface TwoFactorInput {
  twoFactorToken: string
  code: string
  rememberMe: boolean
}

export interface OtpLoginInput extends VerifyLoginOtpCommand {
  rememberMe: boolean
}

export interface AuthContextValue {
  user: SessionUser | null
  isDemo: boolean
  login: (input: LoginInput) => Promise<SessionUser | TwoFactorChallenge>
  /** Completes a login that returned a TwoFactorChallenge. */
  verifyTwoFactor: (input: TwoFactorInput) => Promise<SessionUser>
  /** Signs in with a Google ID token; the first sign-in creates the customer account. */
  loginWithGoogle: (input: GoogleLoginInput) => Promise<SessionUser>
  /** Signs in with the 6-digit code emailed by /login-otp/request. */
  loginWithOtp: (input: OtpLoginInput) => Promise<SessionUser>
  /** Signs in without a backend; every service then serves mock data. */
  startDemo: (user: SessionUser) => SessionUser
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
