import { useReveal } from './useHomeEffects'
import { t, tMaybe } from '@/i18n'

const FACILITIES = [
  {
    image: '/home/anpr-gate.jpg',
    alt: 'Sports car at an illuminated barrier gate with a plate recognition welcome screen at night',
    title: 'Optical ANPR barrier gate array',
    text: 'High-speed dual-spectrum optical cameras recognize vanity, international and dark-tint license plates instantly. A 0.2-second barrier actuation removes queues at the gate.',
  },
  {
    image: '/home/vault-deck.jpg',
    alt: 'Underground parking deck lit by green bay occupancy LEDs with luxury SUVs parked',
    title: 'Subterranean vault architecture',
    text: 'An ultra-low 65mm incline transition ramp is contoured for low carbon-fiber splitters, and 3.4-metre bays let doors swing open freely without touching the next car.',
  },
]

export function FacilityShowcase() {
  const ref = useReveal<HTMLDivElement>()

  return (
    <section className="home-section home-section--raised" id="facilities">
      <div ref={ref} className="home-container home-reveal">
        <div className="home-section__head">
          <h2 className="home-heading">{t('Autonomous vault engineering')}</h2>
        </div>

        <div className="home-showcase">
          {FACILITIES.map((facility) => (
            <article key={facility.title} className="home-showcase__card">
              <div className="home-showcase__media">
                <img src={facility.image} alt={tMaybe(facility.alt)} loading="lazy" />
              </div>
              <div className="home-showcase__body">
                <h3 className="home-showcase__title">{tMaybe(facility.title)}</h3>
                <p className="home-showcase__text">{tMaybe(facility.text)}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
