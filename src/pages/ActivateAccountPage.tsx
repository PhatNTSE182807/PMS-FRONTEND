import { useState, type FormEvent } from 'react'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { getErrorMessage } from '@/api/apiError'
import AuthSplitLayout from '@/components/AuthSplitLayout'
import type { ClassicOutletContext } from '@/components/layout/ClassicLayout'
import { useActivateAccount } from '@/hooks/useAuth'

/**
 * New Manager/Staff accounts start inactive. The activation email carries the user id and a
 * token (also accepted as ?userId=&token= query parameters); here the user picks a password.
 */
export default function ActivateAccountPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { showToast } = useOutletContext<ClassicOutletContext>()
  const activate = useActivateAccount()

  const [userId, setUserId] = useState(params.get('userId') ?? '')
  const [token, setToken] = useState(params.get('token') ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!userId.trim() || !token.trim()) {
      setErrorMsg('Enter the user ID and activation token from your email.')
      return
    }
    if (newPassword.length < 8 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setErrorMsg('Password must be at least 8 characters with an upper-case letter, a lower-case letter and a digit.')
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('The passwords do not match.')
      return
    }

    activate.mutate(
      { userId: userId.trim(), token: token.trim(), newPassword, confirmPassword },
      {
        onSuccess: () => {
          showToast('Account activated. Sign in with your new password.')
          navigate('/login', { replace: true })
        },
        onError: (error) => setErrorMsg(getErrorMessage(error, 'Could not activate the account.')),
      },
    )
  }

  return (
    <div className="screens-auth-layout">
      <AuthSplitLayout title="Activate your account" subtitle="Set a password to finish setting up your staff account.">
        <div className="glass-card login-glass-card">
          {errorMsg && (
            <div className="auth-alert auth-alert--error" role="alert">
              <span>{errorMsg}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <input
                className="cyber-input"
                placeholder="User ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <input
                className="cyber-input"
                placeholder="Activation token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="form-group">
              <input
                type="password"
                className="cyber-input"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="form-group">
              <input
                type="password"
                className="cyber-input"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <button type="submit" className="btn btn-primary-cyan btn-full" disabled={activate.isPending}>
              {activate.isPending ? 'Activating...' : 'Activate account'}
            </button>
          </form>

          <div className="auth-card-footer auth-card-footer--tight">
            <span>Already activated? </span>
            <button type="button" className="auth-link-highlight" onClick={() => navigate('/login')}>
              Back to Login
            </button>
          </div>
        </div>
      </AuthSplitLayout>
    </div>
  )
}
