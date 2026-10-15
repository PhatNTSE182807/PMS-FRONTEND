import { Navigate } from 'react-router-dom'
import { homePathFor, useAuth } from '@/hooks/useAuth'

/** Sends unknown URLs to the signed-in user's home page, or to login. */
export function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={user ? homePathFor(user.role) : '/login'} replace />
}
