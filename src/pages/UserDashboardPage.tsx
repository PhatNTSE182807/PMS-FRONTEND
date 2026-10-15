import { useNavigate, useOutletContext } from 'react-router-dom'
import UserScreen from '@/components/UserScreen'
import type { ClassicOutletContext } from '@/components/layout/ClassicLayout'
import { useAuth } from '@/hooks/useAuth'

export default function UserDashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useOutletContext<ClassicOutletContext>()

  const handleLogout = () => {
    logout()
    navigate('/login')
    showToast('Logged out successfully. See you again!')
  }

  return (
    <div className="screen-user-layout">
      <UserScreen user={user} onLogout={handleLogout} />
    </div>
  )
}
