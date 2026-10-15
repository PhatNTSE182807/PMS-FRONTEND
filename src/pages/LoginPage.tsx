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
    // Return to the page that required login, but only within this role's own area
    // (the redirect state may come from another account's session).
    const home = homePathFor(user.role)
    const from = (location.state as { from?: string } | null)?.from
    navigate(from?.startsWith(home) ? from : home, { replace: true })
    showToast(`Welcome back, ${user.fullName || user.username}! Login successful.`)
  }

  return (
    <div className="screens-auth-layout">
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        onNavigateToRegister={() => navigate('/register')}
        onNavigateToOtpLogin={() => navigate('/login-otp')}
      />
    </div>
  )
}
