import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { BookMarked, Car, CreditCard, Menu, Shield, UserRound, X } from 'lucide-react'
import { Toaster } from 'sonner'
import { AssistantWidget } from '@/components/assistant/AssistantWidget'
import { LOGO_SRC } from '@/components/ParkingLogo'
import { UserMenu } from '@/components/UserMenu'
import { useAuth, useSignOut } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useWallet, formatVndBalance } from '@/hooks/useWallet'
import { initials, resolveMediaUrl } from './customerFormat'
import { NotificationBell } from './NotificationBell'
import { UserWalletModal } from './UserWalletModal'
import '@/styles/customer.css'
import '@/styles/customer-light.css'
import '@/styles/wallet.css'
import { t, tMaybe } from '@/i18n'

/** Hash links scroll to a section of a page. Profile, vehicles, bookings and the wallet are in the account menu. */
const LINKS = [
  { to: '/me', label: 'Dashboard', end: true },
  { to: '/me/sessions', label: 'Active Sessions' },
  { to: '/me/bookings#history', label: 'History' },
]

/** Layout of the signed-in customer area: top navigation, page outlet and footer. */
export function CustomerShell() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const { pathname, hash } = useLocation()
  const wallet = useWallet()
  const { balance } = wallet
  const [isWalletOpen, setIsWalletOpen] = useState(false)
  // Phones and tablets: the links fold into a menu opened from the top bar
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [menuPath, setMenuPath] = useState(pathname + hash)
  if (menuPath !== pathname + hash) {
    setMenuPath(pathname + hash)
    setIsMenuOpen(false)
  }

  // React Router does not follow #anchors: scroll to the section, or to the top on a new page.
  useEffect(() => {
    const target = hash ? document.getElementById(hash.slice(1)) : null
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else window.scrollTo({ top: 0 })
  }, [pathname, hash])

  const name = profile?.fullName || user?.fullName || user?.username || 'Driver'
  const avatarUrl = resolveMediaUrl(profile?.avatarUrl || user?.avatarUrl)

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
          <Link to="/" className="cx-nav__brand" aria-label={t('XXIV Parking home')}>
            <img src={LOGO_SRC} alt="" className="cx-nav__logo" />
            {/* One line, as in the admin, manager and staff consoles */}
            <span className="cx-nav__brand-text">
              <span className="cx-nav__brand-name">
                <span className="brand-gold">XXIV</span>{' '}PARKING
              </span>
            </span>
          </Link>

          <nav id="cx-nav-links" className={`cx-nav__links ${isMenuOpen ? 'cx-nav__links--open' : ''}`} aria-label={t('Customer area')}>
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={() => `cx-nav__link ${isActive(link.to, link.end) ? 'cx-nav__link--active' : ''}`}
              >
                {tMaybe(link.label)}
              </NavLink>
            ))}
          </nav>

          <div className="cx-nav__actions">
            <NotificationBell />
            <UserMenu
              name={tMaybe(name)}
              subtitle={profile?.email || user?.email}
              avatarUrl={avatarUrl}
              initials={initials(name)}
              extra={
                <button type="button" className="user-menu__wallet" onClick={() => setIsWalletOpen(true)}>
                  <CreditCard className="user-menu__icon" aria-hidden />
                  <span className="user-menu__wallet-text">
                    <span className="user-menu__wallet-label">{t('XXIV E-Wallet')}</span>
                    <span className="user-menu__wallet-amount">{formatVndBalance(balance)}</span>
                  </span>
                </button>
              }
              items={[
                { label: t('User Profile'), icon: UserRound, to: '/me/profile' },
                { label: t('My Vehicles'), icon: Car, to: '/me/vehicles' },
                { label: t('My Bookings'), icon: BookMarked, to: '/me/bookings' },
              ]}
              onSignOut={handleLogout}
            />
            <button
              type="button"
              className="cx-btn cx-btn--ghost cx-nav__menu-btn"
              aria-label={isMenuOpen ? t('Close menu') : t('Open menu')}
              aria-expanded={isMenuOpen}
              aria-controls="cx-nav-links"
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              {isMenuOpen ? <X aria-hidden /> : <Menu aria-hidden />}
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
                <Shield aria-hidden />{' '}XXIV PARKING
              </p>
              <p className="cx-footer__tag">{t('Smart parking in Ho Chi Minh City')}</p>
            </div>
          </div>
          <div className="cx-footer__bottom">
            <span>© {new Date().getFullYear()} XXIV PARKING. All rights reserved.</span>
          </div>
        </div>
      </footer>

      <UserWalletModal isOpen={isWalletOpen} onClose={() => setIsWalletOpen(false)} wallet={wallet} />

      <Toaster position="top-right" theme="dark" richColors closeButton />
      <AssistantWidget />
    </div>
  )
}

