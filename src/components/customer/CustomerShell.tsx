import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { LogOut, Shield } from 'lucide-react'
import { Toaster } from 'sonner'
import { LOGO_SRC } from '@/components/ParkingLogo'
import { roleLabel, useAuth, useSignOut } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { initials } from './customerFormat'
import '@/styles/customer.css'

/** Hash links scroll to a dashboard section; the others are pages of their own. */
const LINKS = [
  { to: '/me', label: 'Dashboard', end: true },
  { to: '/me#session', label: 'Active Session' },
  { to: '/me/vehicles', label: 'My Vehicles' },
  { to: '/me/bookings', label: 'My Bookings' },
  { to: '/me#map', label: 'Book Slot' },
  { to: '/me/bookings#history', label: 'History' },
  { to: '/me/profile', label: 'Profile' },
]

/** Layout of the signed-in customer area: top navigation, page outlet and footer. */
export function CustomerShell() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const { pathname, hash } = useLocation()

  // React Router does not follow #anchors: scroll to the section, or to the top on a new page.
  useEffect(() => {
    const target = hash ? document.getElementById(hash.slice(1)) : null
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else window.scrollTo({ top: 0 })
  }, [pathname, hash])

  const name = profile?.fullName || user?.fullName || user?.username || 'Driver'
  const avatarUrl = profile?.avatarUrl || user?.avatarUrl

  const isActive = (to: string, end?: boolean) => {
    const [path, anchor] = to.split('#')
    if (anchor) return pathname === path && hash === `#${anchor}`
    // A section link (e.g. History) wins over the page it lives on.
    if (hash && LINKS.some((l) => l.to === pathname + hash)) return false
    return end ? pathname === path && !hash : pathname.startsWith(path)
  }

  const handleLogout = useSignOut()

  return (
    <div className="cx">
      <header className="cx-nav">
        <div className="cx-container cx-nav__inner">
          <Link to="/" className="cx-nav__brand" aria-label="XXIV Parking home">
            <img src={LOGO_SRC} alt="" className="cx-nav__logo" />
            <span className="cx-nav__brand-text">
              <span className="cx-nav__brand-name">XXIV</span>
              <span className="cx-nav__brand-sub">PARKING</span>
            </span>
          </Link>

          <nav className="cx-nav__links" aria-label="Customer area">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={() => `cx-nav__link ${isActive(link.to, link.end) ? 'cx-nav__link--active' : ''}`}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="cx-nav__actions">
            <Link to="/me/profile" className="cx-nav__user">
              <span className="cx-avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : initials(name)}</span>
              <span className="cx-nav__user-text">
                <span className="cx-nav__user-name">{name}</span>
                <span className="cx-nav__user-role">{roleLabel(user?.role)} • Connected</span>
              </span>
            </Link>
            <button type="button" className="cx-btn cx-btn--ghost" onClick={handleLogout}>
              <LogOut aria-hidden /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="cx-main">
        <div className="cx-container">
          <Outlet />
        </div>
      </main>

      <footer className="cx-footer">
        <div className="cx-container">
          <div className="cx-footer__top">
            <div>
              <p className="cx-footer__brand">
                <Shield aria-hidden /> XXIV PARKING
              </p>
              <p className="cx-footer__tag">Saigon Metropolitan Network • Intelligent parking telemetry</p>
            </div>
            <nav className="cx-footer__links" aria-label="Legal">
              <Link to="/">Home</Link>
              <a href="mailto:support@xxivparking.vn">Support</a>
            </nav>
          </div>
          <div className="cx-footer__bottom">
            <span>© {new Date().getFullYear()} XXIV PARKING. Saigon Metropolitan Network. All rights reserved.</span>
            <span className="cx-footer__status">
              <span className="cx-dot cx-dot--gold" aria-hidden="true" /> System online
            </span>
          </div>
        </div>
      </footer>

      <Toaster position="top-right" theme="dark" richColors closeButton />
    </div>
  )
}
