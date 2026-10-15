export const LOGO_SRC = '/xxiv-parking-logo.png';

export default function ParkingLogo({ size = 'medium', className = '' }) {
  const isSmall = size === 'small';
  const isLarge = size === 'large';

  return (
    <div className={`parking-logo ${className} ${isSmall ? 'parking-logo--small' : ''} ${isLarge ? 'parking-logo--large' : ''}`}>
      <div className="parking-logo__icon-box">
        <img src={LOGO_SRC} alt="" className="parking-logo__img" />
      </div>

      <div className="parking-logo__text">
        <span className="parking-logo__brand">XXIV</span>
        <span className="parking-logo__sub">PARKING</span>
      </div>
    </div>
  );
}
