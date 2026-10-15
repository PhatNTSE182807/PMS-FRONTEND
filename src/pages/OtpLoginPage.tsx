import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import OtpLoginScreen from '@/components/OtpLoginScreen'
import type { ClassicOutletContext } from '@/components/layout/ClassicLayout'
import { homePathFor } from '@/hooks/useAuth'
import type { SessionUser } from '@/lib/session'

export default function OtpLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useOutletContext<ClassicOutletContext>()

  // Same landing rules as the password login (see LoginPage).
  const handleLoginSuccess = (user: SessionUser) => {
    const home = homePathFor(user.role)
    const from = (location.state as { from?: string } | null)?.from
    navigate(from?.startsWith(home) ? from : home, { replace: true })
    showToast(`Welcome back, ${user.fullName || user.username}! Login successful.`)
  }

  return (
    <div className="screens-auth-layout">
      <OtpLoginScreen onLoginSuccess={handleLoginSuccess} onNavigateToLogin={() => navigate('/login')} />
    </div>
  )
}
