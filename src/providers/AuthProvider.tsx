import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { identityService, toSessionUser } from '@/api/identity.service'
import { session, type SessionUser } from '@/lib/session'
import type { LoginResponseDTO } from '@/types/identity.dto'
import {
  AuthContext,
  type AuthContextValue,
  type GoogleLoginInput,
  type LoginInput,
  type OtpLoginInput,
  type TwoFactorChallenge,
  type TwoFactorInput,
} from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<SessionUser | null>(() => session.getUser())

  // The session store is the source of truth (the HTTP client clears it on 401).
  useEffect(() => session.subscribe(setUser), [])

  // Never show one account's cached data to the next account: clear on sign-out only.
  // Clearing while signed out on first load would also drop the public pages' in-flight
  // queries (the homepage's live availability then waited for the next refetch).
  const previousUser = useRef(user)
  useEffect(() => {
    if (previousUser.current && !user) queryClient.clear()
    previousUser.current = user
  }, [user, queryClient])

  const startSession = useCallback((response: LoginResponseDTO, rememberMe: boolean) => {
    if (!response.token) throw new Error('The server did not return an access token.')
    const sessionUser = toSessionUser(response)
    queryClient.clear()
    session.save(response.token, sessionUser, rememberMe)
    return sessionUser
  }, [queryClient])

  const login = useCallback(async ({ rememberMe, ...command }: LoginInput): Promise<SessionUser | TwoFactorChallenge> => {
    const response = await identityService.login(command)
    if (response.requiresTwoFactor && response.twoFactorToken) {
      return {
        kind: 'two-factor',
        twoFactorToken: response.twoFactorToken,
        destination: response.destination ?? response.email,
        rememberMe,
      }
    }
    return startSession(response, rememberMe)
  }, [startSession])

  const verifyTwoFactor = useCallback(async ({ rememberMe, ...command }: TwoFactorInput) => {
    return startSession(await identityService.verifyTwoFactor(command), rememberMe)
  }, [startSession])

  const loginWithGoogle = useCallback(async ({ rememberMe, ...command }: GoogleLoginInput) => {
    return startSession(await identityService.loginWithGoogle(command), rememberMe)
  }, [startSession])

  const loginWithOtp = useCallback(async ({ rememberMe, ...command }: OtpLoginInput) => {
    return startSession(await identityService.verifyLoginOtp(command), rememberMe)
  }, [startSession])

  const startDemo = useCallback((demoUser: SessionUser) => {
    queryClient.clear()
    session.startDemo(demoUser)
    return demoUser
  }, [queryClient])

  const logout = useCallback(() => session.clear(), [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, isDemo: user !== null && session.isDemo(), login, verifyTwoFactor, loginWithGoogle, loginWithOtp, startDemo, logout }),
    [user, login, verifyTwoFactor, loginWithGoogle, loginWithOtp, startDemo, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
