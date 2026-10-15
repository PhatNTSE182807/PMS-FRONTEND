import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { identityService, toSessionUser } from '@/api/identity.service'
import { session, type SessionUser } from '@/lib/session'
import { AuthContext, type AuthContextValue, type LoginInput } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<SessionUser | null>(() => session.getUser())

  // The session store is the source of truth (the HTTP client clears it on 401).
  useEffect(() => session.subscribe(setUser), [])

  // Never show one account's cached data to the next account.
  useEffect(() => {
    if (!user) queryClient.clear()
  }, [user, queryClient])

  const login = useCallback(async ({ rememberMe, ...command }: LoginInput) => {
    const response = await identityService.login(command)
    const sessionUser = toSessionUser(response)
    queryClient.clear()
    session.save(response.token, sessionUser, rememberMe)
    return sessionUser
  }, [queryClient])

  const startDemo = useCallback((demoUser: SessionUser) => {
    queryClient.clear()
    session.startDemo(demoUser)
    return demoUser
  }, [queryClient])

  const logout = useCallback(() => session.clear(), [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, isDemo: user !== null && session.isDemo(), login, startDemo, logout }),
    [user, login, startDemo, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
