import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { LOGO_SRC } from '@/components/ParkingLogo'
import { homePathFor, useAuth } from '@/hooks/useAuth'

const LINKS = [
  { href: '#top', label: 'Home' },
  { href: '#capabilities', label: 'Features' },
  { href: '#facilities', label: 'Facilities' },
  { href: '#terminals', label: 'Terminals' },
]

interface HomeNavProps {
  /** False when the capacity feed is unreachable. */
  isOnline: boolean
}

export function HomeNav({ isOnline }: HomeNavProps) {
  const { user } = useAuth()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const closeMenu = () => setIsMenuOpen(false)
  const bookTo = user ? homePathFor(user.role) : '/register'

  return (
    <header className={`home-nav ${isScrolled ? 'home-nav--scrolled' : ''} ${isMenuOpen ? 'home-nav--open' : ''}`}>
      <div className="home-container home-nav__inner">
        <a href="#top" className="home-nav__brand" onClick={closeMenu}>
          <img src={LOGO_SRC} alt="" className="home-nav__logo" />
          <span className="home-nav__brand-mark">XXIV</span>
          <span className="home-nav__brand-text">
            <span className="home-nav__brand-name">PARKING</span>
            <span className="home-nav__brand-sub">Sovereign Telemetry</span>
          </span>
        </a>

        <nav className="home-nav__links" aria-label="Homepage sections">
          {LINKS.map((link, index) => (
            <a key={link.href} href={link.href} onClick={closeMenu} aria-current={index === 0 ? 'true' : undefined}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="home-nav__actions">
          <span className="home-pill">
            <span className={`home-dot ${isOnline ? 'home-dot--live' : 'home-dot--off'}`} aria-hidden="true" />
            {isOnline ? 'System online' : 'Feed offline'}
          </span>
          {user ? (
            <Link to={homePathFor(user.role)} className="home-nav__signin">
              Dashboard
            </Link>
          ) : (
            <Link to="/login" className="home-nav__signin">
              Sign in
            </Link>
          )}
          <Link to={bookTo} className="home-btn home-btn--teal">
            Book a slot
          </Link>
        </div>

        <button
          type="button"
          className="home-nav__toggle"
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          {isMenuOpen ? <X aria-hidden /> : <Menu aria-hidden />}
        </button>
      </div>
    </header>
  )
}
