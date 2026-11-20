import { useState, type ChangeEvent, type FormEvent } from 'react'
import { ArrowRight, Check, Lock, X } from 'lucide-react'
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import AuthShowcaseLayout from '@/components/AuthShowcaseLayout'
import { AuthAlert, AuthField } from '@/components/AuthFields'
import type { ClassicOutletContext } from '@/components/layout/ClassicLayout'
import { getErrorMessage } from '@/api/apiError'
import { useResetPassword } from '@/hooks/useAuth'
import { isValidPassword, PASSWORD_RULE_MESSAGE, PASSWORD_RULES } from '@/lib/password'
import { t, tMaybe } from '@/i18n'

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
        title={t('Choose a new password')}
        subtitle={linkIsComplete ? t('For the account {email}.', { email }) : t('This link is incomplete.')}
        photo="/login-car.jpg"
      >
        {!linkIsComplete ? (
          <>
            <AuthAlert tone="error">
              {t('The reset link is missing information. Open the link from the email again, or ask for a new one from the sign-in page.')}
            </AuthAlert>
            <Link to="/login" className="auth-shell__submit">
              {t('Back to sign in')}
            </Link>
          </>
        ) : (
          <form className="auth-shell__form" onSubmit={handleSubmit} noValidate>
            {error && <AuthAlert tone="error">{tMaybe(error)}</AuthAlert>}

            <AuthField
              id="reset-new-password"
              label={t('New password')}
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
            <ul className="auth-shell__rules" aria-label={t('Password requirements')}>
              {PASSWORD_RULES.map((rule) => {
                const met = rule.test(newPassword)
                return (
                  <li key={rule.id} data-met={met}>
                    {met ? <Check size={14} aria-hidden /> : <X size={14} aria-hidden />}
                    {tMaybe(rule.label)}
                    <span className="sr-only">{met ? t(' (met)') : t(' (missing)')}</span>
                  </li>
                )
              })}
            </ul>

            <AuthField
              id="reset-confirm-password"
              label={t('Confirm new password')}
              icon={Lock}
              placeholder="••••••••••••"
              value={confirmPassword}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              visible={showPassword}
              onToggleVisible={() => setShowPassword(!showPassword)}
            />

            <button type="submit" className="auth-shell__submit" disabled={resetPassword.isPending}>
              {resetPassword.isPending ? t('Saving...') : t('Save new password')}
              {!resetPassword.isPending && <ArrowRight size={20} aria-hidden="true" />}
            </button>

            <p className="auth-shell__footer">
              {t('Remembered it?')}
              <Link to="/login" className="auth-shell__link auth-shell__link--muted">
                {t('Back to sign in')}
              </Link>
            </p>
          </form>
        )}
      </AuthShowcaseLayout>
    </div>
  )
}
