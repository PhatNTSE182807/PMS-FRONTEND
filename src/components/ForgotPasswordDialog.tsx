import { useState, type FormEvent } from 'react'
import { Mail, X } from 'lucide-react'
import { AuthAlert, AuthField } from './AuthFields'
import { getErrorMessage } from '@/api/apiError'
import { useForgotPassword } from '@/hooks/useAuth'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface ForgotPasswordDialogProps {
  /** Pre-filled from the login form when it holds an email. */
  initialEmail?: string
  onClose: () => void
  /** Called with the API's answer, which is the same whether or not the email has an account. */
  onSent: (message: string) => void
}

/**
 * Asks for a reset link by email. Works for every account: one with a password gets a reset link,
 * one that signs in with Google or an email code gets a link to set a password.
 */
export default function ForgotPasswordDialog({ initialEmail = '', onClose, onSent }: ForgotPasswordDialogProps) {
  const forgotPassword = useForgotPassword()
  const [email, setEmail] = useState(initialEmail.includes('@') ? initialEmail.trim() : '')
  const [error, setError] = useState('')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    const value = email.trim()
    if (!EMAIL_PATTERN.test(value)) {
      setError('Please enter the email address of your account.')
      return
    }
    forgotPassword.mutate(
      { email: value },
      {
        onSuccess: (message) => onSent(message),
        onError: (err) => setError(getErrorMessage(err, 'Could not send the email. Please try again later.')),
      },
    )
  }

  return (
    <div className="auth-shell__backdrop" onClick={onClose}>
      <form
        className="auth-shell__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="forgot-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="auth-shell__dialog-header">
          <h2 id="forgot-title" className="auth-shell__dialog-title">Reset password</h2>
          <button type="button" className="auth-shell__toggle" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="auth-shell__dialog-body">
          <p>
            Enter the email of your account. We will send you a link to choose a new password. The link is valid
            for 30 minutes and works once.
          </p>
          {error && <AuthAlert tone="error">{error}</AuthAlert>}
          <AuthField
            id="forgot-email"
            label="Email"
            icon={Mail}
            type="email"
            placeholder="name@domain.com"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
          />
        </div>
        <div className="auth-shell__dialog-footer">
          <button type="button" className="auth-shell__ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="auth-shell__submit" disabled={forgotPassword.isPending}>
            {forgotPassword.isPending ? 'Sending...' : 'Send reset link'}
          </button>
        </div>
      </form>
    </div>
  )
}
