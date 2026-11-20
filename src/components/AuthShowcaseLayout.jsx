import { Link } from 'react-router-dom';
import { LOGO_SRC } from './ParkingLogo';
import { ThemeToggle } from './ThemeToggle';
import '../styles/auth.css';

function Brand({ className = '' }) {
  return (
    <Link to="/" className={`auth-shell__brand ${className}`}>
      <span className="auth-shell__logo-box">
        <img src={LOGO_SRC} alt="" />
      </span>
      <span className="auth-shell__brand-name"><span className="brand-gold">XXIV</span> Parking</span>
    </Link>
  );
}

/**
 * Full-window shell of the Login and Register screens (Stitch "Universal Login/Register"):
 * left = car photo with the brand, right = the form column.
 *
 * @param {{
 *   title: string,
 *   subtitle: string,
 *   photo: string,
 *   wide?: boolean,
 *   children: import('react').ReactNode,
 * }} props
 */
export default function AuthShowcaseLayout({ title, subtitle, photo, wide = false, children }) {
  return (
    <div className={`auth-shell ${wide ? 'auth-shell--wide' : ''}`}>
      <aside className="auth-shell__hero">
        <img src={photo} alt="" className="auth-shell__photo" />
        <div className="auth-shell__fade" aria-hidden="true" />

        <Brand />
      </aside>

      <section className="auth-shell__panel">
        <ThemeToggle className="auth-shell__theme" />
        <div className="auth-shell__panel-inner">
          <Brand className="auth-shell__mobile-brand" />

          <header className="auth-shell__heading">
            <h1 className="auth-shell__title">{title}</h1>
            <p className="auth-shell__subtitle">{subtitle}</p>
          </header>

          {children}
        </div>
      </section>
    </div>
  );
}
