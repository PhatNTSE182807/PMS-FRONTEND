import { useState, type ChangeEvent, type FormEvent } from 'react'
import { ArrowRight, Check, Lock, X } from 'lucide-react'
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import AuthShowcaseLayout from '@/components/AuthShowcaseLayout'
import { AuthAlert, AuthField } from '@/components/AuthFields'
import type { ClassicOutletContext } from '@/components/layout/ClassicLayout'
import { getErrorMessage } from '@/api/apiError'
import { useResetPassword } from '@/hooks/useAuth'
import { isValidPassword, PASSWORD_RULE_MESSAGE, PASSWORD_RULES } from '@/lib/password'

/**
 * Opened from the link in the "Reset your password" / "Set a password" email:
 * /reset-password?email=...&token=... The token is valid for 30 minutes and works once.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const { showToast } = useOutletContext<ClassicOutletContext>()
  const [params] = useSearchParams()
  const email = params.get('email') ?? ''
  const token = params.get('token') ?? ''

  const resetPassword = useResetPassword()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const linkIsComplete = Boolean(email && token)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!isValidPassword(newPassword)) return setError(PASSWORD_RULE_MESSAGE)
    if (newPassword !== confirmPassword) return setError('Passwords do not match.')

    resetPassword.mutate(
      { email, token, newPassword, confirmPassword },
      {
        onSuccess: (message) => {
          showToast(message || 'Your password has been reset. You can now sign in with it.')
          navigate('/login', { replace: true })
        },
        onError: (err) => setError(getErrorMessage(err, 'Could not reset the password. Please request a new link.')),
      },
    )
  }

  return (
    <div className="screens-auth-layout">
      <AuthShowcaseLayout
        title="Choose a new password"
        subtitle={linkIsComplete ? `For the account ${email}.` : 'This link is incomplete.'}
        photo="/login-car.jpg"
        tagline="Experience effortless, intelligent parking management crafted for luxury vehicles."
      >
        {!linkIsComplete ? (
          <>
            <AuthAlert tone="error">
              The reset link is missing information. Open the link from the email again, or ask for a new one from the
              sign-in page.
            </AuthAlert>
            <Link to="/login" className="auth-shell__submit">
              Back to sign in
            </Link>
          </>
        ) : (
          <form className="auth-shell__form" onSubmit={handleSubmit} noValidate>
            {error && <AuthAlert tone="error">{error}</AuthAlert>}

            <AuthField
              id="reset-new-password"
              label="New password"
              icon={Lock}
              placeholder="••••••••••••"
              value={newPassword}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              visible={showPassword}
              onToggleVisible={() => setShowPassword(!showPassword)}
              autoFocus
            />

            {/* The API rule, ticked off live so the user sees what is still missing before submitting. */}
            <ul className="auth-shell__rules" aria-label="Password requirements">
              {PASSWORD_RULES.map((rule) => {
                const met = rule.test(newPassword)
                return (
                  <li key={rule.id} data-met={met}>
                    {met ? <Check size={14} aria-hidden /> : <X size={14} aria-hidden />}
                    {rule.label}
                    <span className="sr-only">{met ? ' (met)' : ' (missing)'}</span>
                  </li>
                )
              })}
            </ul>

            <AuthField
              id="reset-confirm-password"
              label="Confirm new password"
              icon={Lock}
              placeholder="••••••••••••"
              value={confirmPassword}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              visible={showPassword}
              onToggleVisible={() => setShowPassword(!showPassword)}
            />

            <button type="submit" className="auth-shell__submit" disabled={resetPassword.isPending}>
              {resetPassword.isPending ? 'Saving...' : 'Save new password'}
              {!resetPassword.isPending && <ArrowRight size={20} aria-hidden="true" />}
            </button>

            <p className="auth-shell__footer">
              Remembered it?
              <Link to="/login" className="auth-shell__link auth-shell__link--muted">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </AuthShowcaseLayout>
    </div>
  )
}
