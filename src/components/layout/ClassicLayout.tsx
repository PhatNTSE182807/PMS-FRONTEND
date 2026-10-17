import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import ApiStatusBadge from '@/components/ApiStatusBadge'
import { LOGO_SRC } from '@/components/ParkingLogo'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { homePathFor, useAuth, useSignOut } from '@/hooks/useAuth'
import { DEMO_DRIVER } from '@/mocks/auth.mock'

/** Context handed to the login/register/driver pages rendered inside this shell. */
export interface ClassicOutletContext {
  showToast: (message: string) => void
}

/**
 * Shell of the public and driver screens: global header and toast. The auth pages draw
 * their own Lamborghini brand panel (AuthSplitLayout).
 */
const AUTH_PATHS = ['/login', '/register']

export function ClassicLayout() {
  const { user, startDemo } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isDriverView = pathname.startsWith('/me')
  // Sign-in screens fill the window with their own brand panel instead of the header.
  const isAuthView = AUTH_PATHS.includes(pathname)

  const [toastMessage, setToastMessage] = useState('')
  const toastTimer = useRef<number | undefined>(undefined)

  const showToast = useCallback((message: string) => {
    window.clearTimeout(toastTimer.current)
    setToastMessage(message)
    toastTimer.current = window.setTimeout(() => setToastMessage(''), 3500)
  }, [])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  const handleLogout = useSignOut()

  const openDriverDashboard = () => {
    // Without a session, the tab opens the dashboard with the demo driver (as before).
    if (!user) startDemo(DEMO_DRIVER)
    navigate('/me')
  }

  const context: ClassicOutletContext = { showToast }

  return (
    <div className="pms-app">
      {/* Soft warm ambient light */}
      <div className="cyber-glow cyber-glow--cyan-top"></div>
      <div className="cyber-glow cyber-glow--blue-bottom"></div>

      {/* The API status badge (and its URL override) stays reachable on the sign-in screens */}
      {isAuthView && (
        <div className="auth-floating-badge">
          <ApiStatusBadge />
        </div>
      )}

      {/* Global Navigation Bar / Control Header */}
      {!isAuthView && (
        <nav className="global-header">
          <div className="global-header__left">
            <div className="brand-pill" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
              <img src={LOGO_SRC} alt="" className="brand-logo" />
              <span className="brand-text">XXIV PARKING</span>
            </div>

            {/* Quick Screen Switcher Tabs */}
            <div className="screen-nav-tabs">
              <button
                type="button"
                className={`nav-btn ${pathname === '/login' ? 'nav-btn--active' : ''}`}
                onClick={() => navigate('/login')}
              >
                Login
              </button>
              <button
                type="button"
                className={`nav-btn ${pathname === '/register' ? 'nav-btn--active' : ''}`}
                onClick={() => navigate('/register')}
              >
                Register
              </button>
              <button
                type="button"
                className={`nav-btn ${isDriverView ? 'nav-btn--active' : ''}`}
                onClick={openDriverDashboard}
              >
                User Dashboard
              </button>
            </div>
          </div>

          <div className="global-header__right">
            {/* Backend Connection Indicator Badge */}
            <ApiStatusBadge />

            {user && !isDriverView && (
              <button
                type="button"
                className="btn btn-outline-cyan btn-sm"
                onClick={() => navigate(homePathFor(user.role))}
              >
                Dashboard ({user.username})
              </button>
            )}

            {user && (
              <button
                type="button"
                className="btn btn-danger-sm"
                onClick={handleLogout}
                title="Logout current session"
              >
                Logout
              </button>
            )}
          </div>
        </nav>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="pms-toast" role="status">
          <span className="pms-toast__icon">✓</span>
          <span className="pms-toast__text">{toastMessage}</span>
          <button type="button" className="pms-toast__close" onClick={() => setToastMessage('')}>✕</button>
        </div>
      )}

      {/* Main Single Screen Viewport */}
      <ErrorBoundary>
        <main className={`pms-main-viewport ${isAuthView ? 'pms-main-viewport--full' : ''}`}>
          <Outlet context={context} />
        </main>
      </ErrorBoundary>
    </div>
  )
}
