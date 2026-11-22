import { useReveal } from './useHomeEffects'
import { t, tMaybe } from '@/i18n'

const FACILITIES = [
  {
    image: '/home/anpr-gate.jpg',
    alt: 'Sports car at an illuminated barrier gate with a plate recognition welcome screen at night',
    title: 'Entry and exit gates',
    text: 'Each lane has a camera and a barrier. Staff check the plate the camera reads, then open the barrier.',
  },
  {
    image: '/home/vault-deck.jpg',
    alt: 'Underground parking deck lit by green bay occupancy LEDs with luxury SUVs parked',
    title: 'Bays for cars and motorbikes',
    text: 'Separate zones for 4-seat cars, 7-seat cars and motorbikes, with free bays shown live on the map.',
  },
]

export function FacilityShowcase() {
  const ref = useReveal<HTMLDivElement>()

  return (
    <section className="home-section home-section--raised" id="facilities">
      <div ref={ref} className="home-container home-reveal">
        <div className="home-section__head">
          <h2 className="home-heading">{t('Inside our parking lots')}</h2>
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
