import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import LoginScreen from '@/components/LoginScreen'
import type { ClassicOutletContext } from '@/components/layout/ClassicLayout'
import { homePathFor } from '@/hooks/useAuth'
import type { SessionUser } from '@/lib/session'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useOutletContext<ClassicOutletContext>()

  const handleLoginSuccess = (user: SessionUser) => {
    const from = (location.state as { from?: string } | null)?.from
    navigate(from ?? homePathFor(user.role), { replace: true })
    showToast(`Welcome back, ${user.fullName || user.username}! Login successful.`)
  }

  return (
    <div className="screens-single-layout">
      <LoginScreen onLoginSuccess={handleLoginSuccess} onNavigateToRegister={() => navigate('/register')} />
    </div>
  )
}
