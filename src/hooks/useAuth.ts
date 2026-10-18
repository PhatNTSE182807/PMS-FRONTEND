import { useCallback, useContext } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { identityService } from '@/api/identity.service'
import type { AccountRole } from '@/types/identity.dto'
import {
  AuthContext,
  type GoogleLoginInput,
  type LoginInput,
  type OtpLoginInput,
  type TwoFactorInput,
} from '@/providers/auth-context'

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.')
  return context
}

/**
 * Signs out and lands on the public homepage. The navigation is committed first (flushSync,
 * not a transition): clearing the session while a protected page is still mounted would let
 * its guard redirect to /login.
 */
export function useSignOut() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  return useCallback(async () => {
    await navigate('/', { replace: true, flushSync: true })
    logout()
  }, [logout, navigate])
}

export function useLogin() {
  const { login } = useAuth()
  return useMutation({ mutationFn: (input: LoginInput) => login(input) })
}

export function useGoogleLogin() {
  const { loginWithGoogle } = useAuth()
  return useMutation({ mutationFn: (input: GoogleLoginInput) => loginWithGoogle(input) })
}

export function useVerifyTwoFactor() {
  const { verifyTwoFactor } = useAuth()
  return useMutation({ mutationFn: (input: TwoFactorInput) => verifyTwoFactor(input) })
}

export function useResendTwoFactor() {
  return useMutation({ mutationFn: identityService.resendTwoFactor })
}

export function useRequestLoginOtp() {
  return useMutation({ mutationFn: identityService.requestLoginOtp })
}

export function useOtpLogin() {
  const { loginWithOtp } = useAuth()
  return useMutation({ mutationFn: (input: OtpLoginInput) => loginWithOtp(input) })
}

export function useRegister() {
  return useMutation({ mutationFn: identityService.register })
}

/** Landing page for a role after sign-in. */
export function homePathFor(role: AccountRole | undefined): string {
  if (role === 'ADMIN') return '/admin'
  if (role === 'MANAGER') return '/management/console'
  if (role === 'STAFF') return '/staff/gate'
  return '/me'
}

const ROLE_LABELS: Record<AccountRole, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  STAFF: 'Staff',
  USER: 'User',
}

export const roleLabel = (role: AccountRole | string | undefined) =>
  ROLE_LABELS[role as AccountRole] ?? role ?? 'User'
