import { ArrowRight, Box, Nfc, ShieldHalf, WalletCards } from 'lucide-react'
import { useReveal } from './useHomeEffects'
import { t, tMaybe } from '@/i18n'

const CAPABILITIES = [
  {
    icon: Box,
    gold: false,
    title: 'Live 3D parking map',
    text: 'See free and taken bays on every floor, then pick your bay right on the map.',
    link: 'Explore the 3D map',
    href: '#terminals',
  },
  {
    icon: Nfc,
    gold: true,
    title: 'Plate recognition at the gate',
    text: 'Cameras read the plate at the lane, and staff confirm it before opening the barrier.',
    link: 'See the gates',
    href: '#facilities',
  },
  {
    icon: WalletCards,
    gold: false,
    title: 'Clear block pricing',
    text: 'Fees are charged per time block, and any deposit is deducted at check-out.',
    link: 'View parking lots',
    href: '#terminals',
  },
  {
    icon: ShieldHalf,
    gold: true,
    title: 'Secure vehicle check',
    text: 'Every entry and exit is recorded, and vehicle papers are checked before a registration is approved.',
    link: 'See the bays',
    href: '#facilities',
  },
]

export function Capabilities() {
  const ref = useReveal<HTMLDivElement>()

  return (
    <section className="home-section home-section--deep" id="capabilities">
      <div ref={ref} className="home-container home-reveal">
        <div className="home-section__head home-section__head--center">
          <span className="home-eyebrow home-eyebrow--gold">{t('Features')}</span>
          <h2 className="home-heading">{t('Everything you need to park')}</h2>
          <p className="home-section__intro">
            {t('Find a bay, book it and pay in one app.')}
          </p>
        </div>

        <div className="home-capabilities">
          {CAPABILITIES.map(({ icon: Icon, ...item }) => (
            <article key={item.title} className={`home-capability ${item.gold ? 'home-capability--gold' : ''}`}>
              <div>
                <span className="home-capability__icon">
                  <Icon size={24} aria-hidden />
                </span>
                <h3 className="home-capability__title">{tMaybe(item.title)}</h3>
                <p className="home-capability__text">{tMaybe(item.text)}</p>
              </div>
              <a href={item.href} className="home-capability__link">
                {tMaybe(item.link)} <ArrowRight aria-hidden />
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
