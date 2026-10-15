import { useContext } from 'react'
import { useMutation } from '@tanstack/react-query'
import { identityService } from '@/api/identity.service'
import type { AccountRole } from '@/types/identity.dto'
import { AuthContext, type LoginInput, type OtpLoginInput } from '@/providers/auth-context'

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.')
  return context
}

export function useLogin() {
  const { login } = useAuth()
  return useMutation({ mutationFn: (input: LoginInput) => login(input) })
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
  return role === 'ADMIN' ? '/admin' : role === 'MANAGER' ? '/management/lots' : '/me'
}

const ROLE_LABELS: Record<AccountRole, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  STAFF: 'Staff',
  USER: 'User',
}

export const roleLabel = (role: AccountRole | string | undefined) =>
  ROLE_LABELS[role as AccountRole] ?? role ?? 'User'
