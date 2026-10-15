import ParkingLogo from './ParkingLogo';

/**
 * Two-column shell shared by Login, Email-code Login and Register:
 * left = brand panel over the Lamborghini photo, right = the form card.
 */
export default function AuthSplitLayout({ title, subtitle, children }) {
  return (
    <div className="auth-split">
      <aside className="auth-split__brand" aria-label="Parking Management System - OJT">
        <div className="auth-split__photo" style={{ backgroundImage: `url('/lamborghini.jpg')` }} aria-hidden="true" />
        <div className="auth-split__tint" aria-hidden="true" />

        <div className="auth-split__brand-content">
          <span className="auth-split__badge">
            <ParkingLogo size="small" className="parking-logo--icon-only" />
            Smart parking platform
          </span>

          <h1 className="auth-split__title">
            Parking Management System
            <span className="auth-split__title-accent">- OJT</span>
          </h1>

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
