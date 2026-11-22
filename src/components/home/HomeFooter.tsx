import { SocialLinks } from '@/components/customer/SocialLinks'
import { t, tMaybe } from '@/i18n'

const FEATURES = ['3D parking map', 'Plate recognition', 'Online booking', 'XXIV Wallet']
const SERVICES = ['Vehicle check-in', 'Vehicle check-out', 'Online payment', 'Customer support']

export function HomeFooter() {
  return (
    <footer className="home-footer">
      <div className="home-container">
        <div className="home-footer__grid">
          <div>
            <p className="home-footer__brand">
              <span className="brand-gold">XXIV</span>PARKING
            </p>
            <p className="home-footer__about">
              {t('See free bays live, book ahead and manage your vehicles and payments in one place.')}
            </p>
          </div>

          <div>
            <h2 className="home-footer__title">{t('Features')}</h2>
            <ul className="home-footer__list">
              {FEATURES.map((item) => (
                <li key={item}>{tMaybe(item)}</li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="home-footer__title">{t('Services')}</h2>
            <ul className="home-footer__list">
              {SERVICES.map((item) => (
                <li key={item}>{tMaybe(item)}</li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="home-footer__title">{t('Support')}</h2>
            <div className="home-footer__contact">
              <p>{t('Contact us if you need help with parking, bookings or payments.')}</p>
              <a href="mailto:support@xxivparking.vn" className="home-footer__mail">
                {t('support@xxivparking.vn')}
              </a>
              <span className="home-footer__phone">{t('Direct line: +84 (28) 7300-2424')}</span>
              <SocialLinks blockClass="home-footer" />
            </div>
          </div>
        </div>

        <div className="home-footer__bottom">
          <span>© {new Date().getFullYear()}{' '}{t('XXIV Parking Systems. All rights reserved.')}</span>
          <span className="home-footer__legal">
            <span>{t('Terms of Service')}</span>
            <span>{t('Privacy Policy')}</span>
          </span>
        </div>
      </div>
    </footer>
  )
}
