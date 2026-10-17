import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { LOGO_SRC } from '@/components/ParkingLogo'
import { homePathFor, useAuth } from '@/hooks/useAuth'

const LINKS = [
  { href: '#availability', label: 'Live availability' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
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

  return (
    <header className={`home-nav ${isScrolled ? 'home-nav--scrolled' : ''} ${isMenuOpen ? 'home-nav--open' : ''}`}>
      <div className="home-container home-nav__inner">
        <a href="#top" className="home-nav__brand" onClick={closeMenu}>
          <img src={LOGO_SRC} alt="" className="home-nav__logo" />
          <span>
            XXIV <span className="home-nav__brand-accent">Parking</span>
          </span>
        </a>

        <nav className="home-nav__links" aria-label="Homepage sections">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={closeMenu}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="home-nav__actions">
          {user ? (
            <Link to={homePathFor(user.role)} className="home-btn home-btn--primary">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="home-btn home-btn--ghost">
                Sign in
              </Link>
              <Link to="/register" className="home-btn home-btn--primary">
                Create account
              </Link>
            </>
          )}
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
