import { LOGO_SRC } from './ParkingLogo';

/**
 * Full-window two-column shell shared by Login, Email-code Login, Register and Activate:
 * left = brand panel over the Lamborghini photo (logo beside the name), right = the form.
 */
export default function AuthSplitLayout({ title, subtitle, children }) {
  return (
    <div className="auth-split">
      <aside className="auth-split__brand" aria-label="XXIV Parking">
        <div className="auth-split__photo" style={{ backgroundImage: `url('/lamborghini.jpg')` }} aria-hidden="true" />
        <div className="auth-split__tint" aria-hidden="true" />

        <div className="auth-split__brand-content">
          <div className="auth-split__brand-row">
            <img src={LOGO_SRC} alt="XXIV Parking logo" className="auth-split__logo" />

            <h1 className="auth-split__title">
              XXIV
              <span className="auth-split__title-accent">Parking</span>
            </h1>
          </div>

          <p className="auth-split__tagline">
            Find a slot, reserve it and manage your vehicles in one place.
          </p>

          <ul className="auth-split__features">
            <li>Real-time slot availability</li>
            <li>Reservations &amp; digital tickets</li>
            <li>Vehicle &amp; account management</li>
          </ul>
        </div>
      </aside>

      <section className="auth-split__panel">
        <div className="auth-split__panel-inner">
          {(title || subtitle) && (
            <header className="auth-split__heading">
              {title && <h2 className="auth-split__heading-title">{title}</h2>}
              {subtitle && <p className="auth-split__heading-subtitle">{subtitle}</p>}
            </header>
          )}
          {children}
        </div>
      </section>
    </div>
  );
}
