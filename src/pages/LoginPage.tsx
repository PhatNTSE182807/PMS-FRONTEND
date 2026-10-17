import { useState } from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import LoginScreen from '@/components/LoginScreen'
import OtpLoginScreen from '@/components/OtpLoginScreen'
import type { ClassicOutletContext } from '@/components/layout/ClassicLayout'
import { homePathFor } from '@/hooks/useAuth'
import type { SessionUser } from '@/lib/session'
import type { TwoFactorChallenge } from '@/providers/auth-context'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useOutletContext<ClassicOutletContext>()
  // Set when a Manager/Staff password login still needs the emailed code.
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null)

  const handleLoginSuccess = (user: SessionUser) => {
    // Return to the page that required login, but only within this role's own area
    // (the redirect state may come from another account's session).
    const home = homePathFor(user.role)
    const from = (location.state as { from?: string } | null)?.from
    navigate(from?.startsWith(home) ? from : home, { replace: true })
    showToast(`Welcome back, ${user.fullName || user.username}! Login successful.`)
  }

  if (challenge) {
    return (
      <div className="screens-auth-layout">
        <OtpLoginScreen
          twoFactor={challenge}
          onLoginSuccess={handleLoginSuccess}
          onNavigateToLogin={() => setChallenge(null)}
        />
      </div>
    )
  }

  return (
    <div className="screens-auth-layout">
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        onTwoFactorRequired={setChallenge}
        onNavigateToRegister={() => navigate('/register')}
      />
    </div>
  )
}
