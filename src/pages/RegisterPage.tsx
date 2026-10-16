import { useNavigate, useOutletContext } from 'react-router-dom'
import RegisterScreen from '@/components/RegisterScreen'
import type { ClassicOutletContext } from '@/components/layout/ClassicLayout'
import { homePathFor } from '@/hooks/useAuth'
import type { SessionUser } from '@/lib/session'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { showToast } = useOutletContext<ClassicOutletContext>()

  const handleRegisterSuccess = ({ fullName }: { fullName: string }) => {
    showToast(`Account registered successfully for ${fullName}! Please log in.`)
    navigate('/login')
  }

  // "Sign up with Google" signs the user straight in.
  const handleLoginSuccess = (user: SessionUser) => {
    navigate(homePathFor(user.role), { replace: true })
    showToast(`Welcome, ${user.fullName || user.username}!`)
  }

  return (
    <div className="screens-auth-layout">
      <RegisterScreen
        onNavigateToLogin={() => navigate('/login')}
        onRegisterSuccess={handleRegisterSuccess}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  )
}
