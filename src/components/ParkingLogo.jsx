export default function ParkingLogo({ size = 'medium', className = '' }) {
  const isSmall = size === 'small';
  const isLarge = size === 'large';

  return (
    <div className={`parking-logo ${className} ${isSmall ? 'parking-logo--small' : ''} ${isLarge ? 'parking-logo--large' : ''}`}>
      <div className="parking-logo__icon-box">
        {/* Futuristic car inside hexagonal/shield badge */}
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="parking-logo__svg"
        >
          {/* Outer shield */}
          <path
            d="M24 4L42 12V24C42 34 24 44 24 44C24 44 6 34 6 24V12L24 4Z"
            fill="url(#shield-grad)"
            stroke="#E98074"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Car silhouette */}
          <path
            d="M16 26L18 20C18.5 18.5 19.8 17.5 21.4 17.5H26.6C28.2 17.5 29.5 18.5 30 20L32 26"
            stroke="#3B3632"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M14 26H34C35.1 26 36 26.9 36 28V31C36 31.6 35.6 32 35 32H13C12.4 32 12 31.6 12 31V28C12 26.9 12.9 26 14 26Z"
            fill="#3B3632"
          />
          {/* Headlights */}
          <circle cx="16" cy="29" r="1.5" fill="#E98074" />
          <circle cx="32" cy="29" r="1.5" fill="#E98074" />
          {/* Wheels */}
          <rect x="15" y="32" width="4" height="2" rx="1" fill="#E98074" />
          <rect x="29" y="32" width="4" height="2" rx="1" fill="#E98074" />

          <defs>
            <linearGradient id="shield-grad" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F4F1EA" />
              <stop offset="1" stopColor="#E3D3BC" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="parking-logo__text">
        <span className="parking-logo__brand">PARKING MANAGEMENT SYSTEM</span>
        <span className="parking-logo__sub">OJT</span>
      </div>
    </div>
  );
}
