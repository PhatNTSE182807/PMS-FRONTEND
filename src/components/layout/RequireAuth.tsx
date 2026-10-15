import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { homePathFor, useAuth } from '@/hooks/useAuth'
import type { AccountRole } from '@/types/identity.dto'

interface Props {
  children: ReactNode
  /** When set, only these roles may enter; others go to their own home page. */
  roles?: AccountRole[]
}

/** Route guard: requires a session, and optionally one of the given roles. */
export function RequireAuth({ children, roles }: Props) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homePathFor(user.role)} replace />
  }
  return children
}
