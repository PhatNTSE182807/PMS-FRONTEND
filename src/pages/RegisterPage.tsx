import { useNavigate, useOutletContext } from 'react-router-dom'
import RegisterScreen from '@/components/RegisterScreen'
import type { ClassicOutletContext } from '@/components/layout/ClassicLayout'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { showToast } = useOutletContext<ClassicOutletContext>()

  const handleRegisterSuccess = ({ fullName }: { fullName: string }) => {
    showToast(`Account registered successfully for ${fullName}! Please log in.`)
    navigate('/login')
  }

  // "Sign up with Google" goes to Google and finishes on GoogleCallbackPage
  return (
    <div className="screens-auth-layout">
      <RegisterScreen
        onNavigateToLogin={() => navigate('/login')}
        onRegisterSuccess={handleRegisterSuccess}
      />
    </div>
  )
}
