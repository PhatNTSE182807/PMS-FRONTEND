import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { identityService, toSessionUser } from '@/api/identity.service'
import { session, type SessionUser } from '@/lib/session'
import type { LoginResponseDTO } from '@/types/identity.dto'
import { AuthContext, type AuthContextValue, type LoginInput, type OtpLoginInput } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<SessionUser | null>(() => session.getUser())

  // The session store is the source of truth (the HTTP client clears it on 401).
  useEffect(() => session.subscribe(setUser), [])

  // Never show one account's cached data to the next account.
  useEffect(() => {
    if (!user) queryClient.clear()
  }, [user, queryClient])

  const startSession = useCallback((response: LoginResponseDTO, rememberMe: boolean) => {
    const sessionUser = toSessionUser(response)
    queryClient.clear()
    session.save(response.token, sessionUser, rememberMe)
    return sessionUser
  }, [queryClient])

  const login = useCallback(async ({ rememberMe, ...command }: LoginInput) => {
    return startSession(await identityService.login(command), rememberMe)
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
    () => ({ user, isDemo: user !== null && session.isDemo(), login, loginWithOtp, startDemo, logout }),
    [user, login, loginWithOtp, startDemo, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
