import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { LOGO_SRC } from '@/components/ParkingLogo'
import { LanguageToggle } from '@/components/LanguageToggle'
import { ThemeToggle } from '@/components/ThemeToggle'
import { homePathFor, useAuth } from '@/hooks/useAuth'
import { t, tMaybe } from '@/i18n'

const LINKS = [
  { href: '#top', label: 'Home' },
  { href: '#capabilities', label: 'Features' },
  { href: '#facilities', label: 'Facilities' },
  { href: '#terminals', label: 'Terminals' },
]

export function HomeNav() {
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
          <span className="home-nav__brand-name">PARKING</span>
        </a>

        <nav className="home-nav__links" aria-label={t('Homepage sections')}>
          {LINKS.map((link, index) => (
            <a key={link.href} href={link.href} onClick={closeMenu} aria-current={index === 0 ? 'true' : undefined}>
              {tMaybe(link.label)}
            </a>
          ))}
          {/* Phone menu only: the light/dark switch sits at the right of the Home row */}
          <ThemeToggle className="home-theme-toggle home-theme-toggle--menu" />
        </nav>

        <div className="home-nav__actions">
          <LanguageToggle className="home-lang-toggle" />
          <ThemeToggle className="home-theme-toggle" />
          {user ? (
            <Link to={homePathFor(user.role)} className="home-nav__signin">
              {t('Dashboard')}
            </Link>
          ) : (
            <Link to="/login" className="home-nav__signin">
              {t('Sign in')}
            </Link>
          )}
          <Link to={bookTo} className="home-nav__signin">
            {t('Book a slot')}
          </Link>
        </div>

        <button
          type="button"
          className="home-nav__toggle"
          aria-label={isMenuOpen ? t('Close menu') : t('Open menu')}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          {isMenuOpen ? <X aria-hidden /> : <Menu aria-hidden />}
        </button>
      </div>
    </header>
  )
}
