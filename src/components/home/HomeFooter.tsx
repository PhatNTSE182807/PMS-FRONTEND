import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { SocialLinks } from '@/components/customer/SocialLinks'
import { usePublicLotDirectory } from '@/hooks/usePublicLots'
import { t, tMaybe } from '@/i18n'

const FEATURES = ['3D parking map', 'Plate recognition', 'Online booking', 'XXIV Wallet']
const SERVICES = ['Vehicle check-in', 'Vehicle check-out', 'Online payment', 'Customer support']

/** The lots customers can see right now, from the public API: adding, editing or removing a lot updates this list. */
function FooterBranches() {
  const { data: lots = [] } = usePublicLotDirectory()
  if (lots.length === 0) return null

  return (
    <section className="home-footer__branches" aria-labelledby="footer-branches-title">
      <h2 className="home-footer__title" id="footer-branches-title">{t('Parking Sites')}</h2>
      <ul className="home-footer__branch-list">
        {lots.map((lot) => (
          <li key={lot.id} className="home-footer__branch">
            <MapPin aria-hidden />
            <div>
              <strong>{tMaybe(lot.name)}</strong>
              <span>{tMaybe(lot.address)}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

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

        <FooterBranches />

        <div className="home-footer__bottom">
          <span>© {new Date().getFullYear()} XXIV Parking Systems. All rights reserved.</span>
          <span className="home-footer__legal">
            <Link to="/terms">{t('Terms of Service')}</Link>
            <Link to="/privacy">{t('Privacy Policy')}</Link>
          </span>
        </div>
      </div>
    </footer>
  )
}
