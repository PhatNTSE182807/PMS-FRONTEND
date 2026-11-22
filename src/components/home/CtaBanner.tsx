import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Map } from 'lucide-react'
import { useReveal } from './useHomeEffects'
import { t } from '@/i18n'

interface CtaBannerProps {
  isSignedIn: boolean
  dashboardTo: string
}

export function CtaBanner({ isSignedIn, dashboardTo }: CtaBannerProps) {
  const ref = useReveal<HTMLDivElement>()

  return (
    <section className="home-section home-section--raised">
      <div ref={ref} className="home-container home-reveal">
        <div className="home-cta">
          <div>
            <span className="home-cta__badge">
              <BadgeCheck aria-hidden />{' '}{t('Book online')}
            </span>
            <h2 className="home-cta__title">
              {t('Park easier')}
              <br />
              {t('starting today')}
            </h2>
            <p className="home-cta__text">
              {t('Register your vehicle, book a bay before you arrive and pay with your wallet, VNPay or MoMo.')}
            </p>
          </div>

          <div className="home-cta__actions">
            <Link to={isSignedIn ? dashboardTo : '/register'} className="home-btn home-btn--light">
              {isSignedIn ? t('Open dashboard') : t('Sign up free')} <ArrowRight aria-hidden />
            </Link>
            <a href="#terminals" className="home-btn home-btn--dark">
              <Map aria-hidden />{' '}{t('View parking lots')}
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
