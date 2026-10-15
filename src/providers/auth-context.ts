import { createContext } from 'react'
import type { SessionUser } from '@/lib/session'
import type { LoginCommand } from '@/types/identity.dto'

export interface LoginInput extends LoginCommand {
  rememberMe: boolean
}

export interface AuthContextValue {
  user: SessionUser | null
  isDemo: boolean
  login: (input: LoginInput) => Promise<SessionUser>
  /** Signs in without a backend; every service then serves mock data. */
  startDemo: (user: SessionUser) => SessionUser
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
