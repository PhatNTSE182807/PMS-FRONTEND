import { ArrowRight, Box, Nfc, ShieldHalf, WalletCards } from 'lucide-react'
import { useReveal } from './useHomeEffects'

const CAPABILITIES = [
  {
    icon: Box,
    gold: false,
    title: '3D digital twin mapping',
    text: 'Interactive multi-level guidance showing real-time bay occupancy from ultrasonic and LiDAR sensors.',
    link: 'Spatial mesh telemetry',
    href: '#terminals',
  },
  {
    icon: Nfc,
    gold: true,
    title: 'Zero-contact ANPR clearance',
    text: 'Vehicles clear the gate through multi-angle plate recognition. No paper tickets, no card tapping, no roll-back.',
    link: 'Frictionless access',
    href: '#facilities',
  },
  {
    icon: WalletCards,
    gold: false,
    title: 'Real-time dwell billing',
    text: 'Transparent minute-by-minute billing with pre-booking credit, corporate fleet accounts and instant digital VAT invoices.',
    link: 'Automated ledger',
    href: '#terminals',
  },
  {
    icon: ShieldHalf,
    gold: true,
    title: 'Sovereign vault security',
    text: 'Continuous surveillance, perimeter sensors and climate-controlled bays that protect collector vehicles.',
    link: 'Tier-4 vault shield',
    href: '#facilities',
  },
]

export function Capabilities() {
  const ref = useReveal<HTMLDivElement>()

  return (
    <section className="home-section home-section--deep" id="capabilities">
      <div ref={ref} className="home-container home-reveal">
        <div className="home-section__head home-section__head--center">
          <span className="home-eyebrow home-eyebrow--gold">Mission capabilities</span>
          <h2 className="home-heading">Instrument-grade control</h2>
          <p className="home-section__intro">
            Every terminal runs on the same mesh infrastructure, built for zero friction and continuous monitoring.
          </p>
        </div>

        <div className="home-capabilities">
          {CAPABILITIES.map(({ icon: Icon, ...item }) => (
            <article key={item.title} className={`home-capability ${item.gold ? 'home-capability--gold' : ''}`}>
              <div>
                <span className="home-capability__icon">
                  <Icon size={24} aria-hidden />
                </span>
                <h3 className="home-capability__title">{item.title}</h3>
                <p className="home-capability__text">{item.text}</p>
              </div>
              <a href={item.href} className="home-capability__link">
                {item.link} <ArrowRight aria-hidden />
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
