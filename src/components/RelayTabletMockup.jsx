import React from 'react';

export default function RelayTabletMockup({ t, onContinueAsGuest }) {
  const m = t.mockup;

  return (
    <div className="relay-hero-right">
      {/* Warm ambient decorative backdrop cards behind the tablet */}
      <div className="relay-mockup-aura" aria-hidden="true"></div>

      {/* Floating Angled Dark Tablet Mockup */}
      <div className="relay-tablet-frame">
        {/* Tablet Hardware Top Bezel & Camera Dot */}
        <div className="relay-tablet-bezel-top">
          <span className="relay-tablet-cam"></span>
          <span className="relay-tablet-mic"></span>
        </div>

        {/* Inner Dark Tablet Screen */}
        <div className="relay-tablet-screen">
          {/* Screen Top Bar */}
          <div className="relay-tablet-topbar">
            <div className="relay-tablet-brand">
              <span className="relay-orange-dot"></span>
              <span className="relay-tablet-brand__title">RelayPark OS • v3.4</span>
            </div>
            <div className="relay-tablet-live-pill">
              <span className="relay-pulse-dot"></span>
              <span>{m.liveBadge}</span>
            </div>
          </div>

          {/* Main 3D Isometric Preview Canvas inside the Tablet */}
          <div className="relay-tablet-map-stage">
            <div className="relay-tablet-map-header">
              <div>
                <h4 className="relay-tablet-lot-title">{m.lotName}</h4>
                <p className="relay-tablet-cam-sub">{m.aiCamStatus}</p>
              </div>
              <div className="relay-tablet-rate-badge">
                <span className="relay-tablet-rate-label">{m.rateLabel}</span>
                <strong className="relay-tablet-rate-val">{m.rateValue}</strong>
              </div>
            </div>

            {/* Mini Isometric 3D Parking Lot Graphic */}
            <div className="relay-tablet-iso-box">
              <svg viewBox="0 0 560 230" className="relay-tablet-iso-svg">
                <defs>
                  <linearGradient id="relayIsoDeck" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#1E1D1B" />
                    <stop offset="100%" stopColor="#121210" />
                  </linearGradient>
                  <linearGradient id="relaySlotOpen" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                  <linearGradient id="relaySlotOrange" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#FF5C00" />
                    <stop offset="100%" stopColor="#EA580C" />
                  </linearGradient>
                </defs>

                {/* Isometric Deck Base */}
                <polygon
                  points="280,15 530,98 280,212 30,118"
                  fill="url(#relayIsoDeck)"
                  stroke="#32302B"
                  strokeWidth="2"
                />

                {/* Driving lane */}
                <polygon
                  points="280,32 500,102 280,195 60,115"
                  fill="none"
                  stroke="#45423B"
                  strokeWidth="1.2"
                  strokeDasharray="5 5"
                />

                {/* Row 1: Available Green Slots */}
                <g transform="translate(0, 0)">
                  <polygon points="210,68 265,48 298,60 243,80" fill="url(#relaySlotOpen)" opacity="0.92" />
                  <polygon points="252,84 307,64 340,76 285,96" fill="url(#relaySlotOpen)" opacity="0.92" />
                  <polygon points="294,100 349,80 382,92 327,112" fill="url(#relaySlotOpen)" opacity="0.92" />
                  <polygon points="336,116 391,96 424,108 369,128" fill="url(#relaySlotOpen)" opacity="0.92" />
                </g>

                {/* Row 2: Highlighted Orange AI-Guided Slot + EV Slots */}
                <g transform="translate(-75, 42)">
                  <polygon points="210,68 265,48 298,60 243,80" fill="url(#relaySlotOpen)" opacity="0.88" />
                  <polygon
                    points="252,84 307,64 340,76 285,96"
                    fill="url(#relaySlotOrange)"
                    stroke="#FF8533"
                    strokeWidth="2"
                  />
                  {/* Floating Pin over AI Reserved Slot */}
                  <circle cx="296" cy="60" r="11" fill="#FF5C00" />
                  <text x="296" y="64" fontSize="9" fontWeight="800" textAnchor="middle" fill="#FFFFFF">P5</text>

                  <polygon points="294,100 349,80 382,92 327,112" fill="#2A2925" stroke="#45423B" strokeWidth="1" />
                  <polygon points="336,116 391,96 424,108 369,128" fill="url(#relaySlotOpen)" opacity="0.88" />
                </g>

                {/* Telemetry Callout Pill */}
                <g transform="translate(365, 24)">
                  <rect x="0" y="0" width="145" height="32" rx="8" fill="#181715" stroke="#FF5C00" strokeWidth="1.2" />
                  <circle cx="14" cy="16" r="4" fill="#10B981" />
                  <text x="26" y="20" fontSize="10.5" fontWeight="700" fill="#F5F2EB">
                    {m.availableSlots}
                  </text>
                </g>
              </svg>
            </div>

            {/* Zone Telemetry Cards Grid */}
            <div className="relay-tablet-zones">
              <div className="relay-zone-card">
                <div className="relay-zone-card__top">
                  <span className="relay-zone-dot relay-zone-dot--green"></span>
                  <span className="relay-zone-name">{m.zoneA1}</span>
                </div>
                <div className="relay-zone-status">{m.zoneA1Status}</div>
              </div>

              <div className="relay-zone-card">
                <div className="relay-zone-card__top">
                  <span className="relay-zone-dot relay-zone-dot--orange"></span>
                  <span className="relay-zone-name">{m.zoneB1}</span>
                </div>
                <div className="relay-zone-status">{m.zoneB1Status}</div>
              </div>

              <div className="relay-zone-card relay-zone-card--maint">
                <div className="relay-zone-card__top">
                  <span className="relay-zone-dot relay-zone-dot--amber"></span>
                  <span className="relay-zone-name">{m.zoneB2}</span>
                </div>
                <div className="relay-zone-status">{m.zoneB2Status}</div>
              </div>
            </div>

            {/* Interactive CTA inside Tablet to launch 3D Map in Guest Mode */}
            <button
              type="button"
              className="relay-tablet-guest-cta"
              onClick={onContinueAsGuest}
            >
              <span>{m.try3dGuestBtn}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
