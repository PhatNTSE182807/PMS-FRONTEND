const ARCHITECTURE = ['LiDAR space mesh', 'Sub-second ANPR array', 'Ultra-fast DC charging', 'Sovereign vault docks']
const OPERATIONS = ['Autonomous valet transit', 'Terminal gate dispatch', '24/7 operations desk', 'Fleet telematics API']

export function HomeFooter() {
  return (
    <footer className="home-footer">
      <div className="home-container">
        <div className="home-footer__grid">
          <div>
            <p className="home-footer__brand">
              <span>XXIV</span>PARKING
            </p>
            <p className="home-footer__about">
              Real-time telemetry, automated bay allocation and secure vehicle management for high-density city
              estates.
            </p>
            <p className="home-footer__status">
              <span className="home-dot home-dot--gold" aria-hidden="true" />
              Core gateways active
            </p>
          </div>

          <div>
            <h2 className="home-footer__title">Architecture</h2>
            <ul className="home-footer__list">
              {ARCHITECTURE.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="home-footer__title">Operations</h2>
            <ul className="home-footer__list">
              {OPERATIONS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="home-footer__title">Concierge &amp; support</h2>
            <div className="home-footer__contact">
              <p>24/7 priority dispatch and assistance across all metropolitan terminals.</p>
              <a href="mailto:support@xxivparking.vn" className="home-footer__mail">
                support@xxivparking.vn
              </a>
              <span className="home-footer__phone">Direct line: +84 (28) 7300-2424</span>
              <span className="home-footer__hubs">
                Metropolitan hubs: District 1 • Thu Thiem • Binh Thanh • District 7 (Ho Chi Minh City)
              </span>
            </div>
          </div>
        </div>

        <div className="home-footer__bottom">
          <span>© {new Date().getFullYear()} XXIV Parking Systems. All rights reserved.</span>
          <span className="home-footer__legal">
            <span>System protocol</span>
            <span>Security attestation</span>
            <span>Terminal SLA</span>
          </span>
        </div>
      </div>
    </footer>
  )
}
