import { Link } from 'react-router-dom';
import { LOGO_SRC } from './ParkingLogo';
import '../styles/auth.css';

function Brand({ className = '' }) {
  return (
    <Link to="/" className={`auth-shell__brand ${className}`}>
      <span className="auth-shell__logo-box">
        <img src={LOGO_SRC} alt="" />
      </span>
      <span className="auth-shell__brand-name">XXIV Parking</span>
    </Link>
  );
}

/**
 * Dark full-window shell of the Login and Register screens (Stitch "Universal Login/Register"):
 * left = car photo with the brand and tagline, right = the form column.
 *
 * @param {{
 *   title: string,
 *   subtitle: string,
 *   photo: string,
 *   tagline: string,
 *   wide?: boolean,
 *   children: import('react').ReactNode,
 * }} props
 */
export default function AuthShowcaseLayout({ title, subtitle, photo, tagline, wide = false, children }) {
  return (
    <div className={`auth-shell ${wide ? 'auth-shell--wide' : ''}`}>
      <aside className="auth-shell__hero">
        <img src={photo} alt="" className="auth-shell__photo" />
        <div className="auth-shell__fade" aria-hidden="true" />

        <Brand />

        <div className="auth-shell__tagline">
          <p className="auth-shell__tagline-title">Precision access for elite automotive collections.</p>
          <p className="auth-shell__tagline-text">{tagline}</p>
        </div>
      </aside>

      <section className="auth-shell__panel">
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
