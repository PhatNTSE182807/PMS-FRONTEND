import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import AuthShowcaseLayout from '@/components/AuthShowcaseLayout'
import { AuthAlert } from '@/components/AuthFields'
import type { ClassicOutletContext } from '@/components/layout/ClassicLayout'
import { getErrorMessage } from '@/api/apiError'
import { homePathFor, useGoogleLogin } from '@/hooks/useAuth'
import { finishGoogleSignIn } from '@/lib/google-identity'

/**
 * /auth/google/callback: Google sends the browser back here with an ID token in the URL fragment.
 * The token goes to the backend's Google sign-in, which creates the customer account on first use.
 */
export default function GoogleCallbackPage() {
  const navigate = useNavigate()
  const { showToast } = useOutletContext<ClassicOutletContext>()
  const googleLogin = useGoogleLogin()
  const [error, setError] = useState('')
  // The fragment and the stored state are read once (React runs effects twice in development)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const fragment = window.location.hash
    // Keep the token out of the address bar and the browser history
    window.history.replaceState(null, '', window.location.pathname)

    let result
    try {
      result = finishGoogleSignIn(fragment)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed. Please try again.')
      return
    }

    const { idToken, rememberMe, returnTo } = result
    googleLogin
      .mutateAsync({ idToken, rememberMe })
      .then((user) => {
        // Back to the page that asked for login, but only within this role's own area
        const home = homePathFor(user.role)
        navigate(returnTo?.startsWith(home) ? returnTo : home, { replace: true })
        showToast(`Welcome, ${user.fullName || user.username}!`)
      })
      .catch((e: unknown) => setError(getErrorMessage(e, 'Google sign-in failed. Please try again.')))
  }, [googleLogin, navigate, showToast])

  return (
    <div className="screens-auth-layout">
      <AuthShowcaseLayout
        title="Signing in with Google"
        subtitle={error ? 'Google sign-in did not finish.' : 'One moment while we sign you in...'}
        photo="/lamborghini.jpg"
        tagline="Experience effortless, intelligent parking management crafted for luxury vehicles."
      >
        {error && (
          <>
            <AuthAlert tone="error">{error}</AuthAlert>
            <p className="auth-shell__footer">
              <Link to="/login" className="auth-shell__link">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </AuthShowcaseLayout>
    </div>
  )
}
