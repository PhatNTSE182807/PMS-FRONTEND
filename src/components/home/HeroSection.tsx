import { Link } from 'react-router-dom'
import { Boxes, Gauge, ShieldCheck, SlidersHorizontal, Zap } from 'lucide-react'

interface HeroSectionProps {
  /** Where "Reserve priority slot" goes: the dashboard when signed in, otherwise sign-up. */
  reserveTo: string
}

export function HeroSection({ reserveTo }: HeroSectionProps) {

  return (
    <section className="home-hero" id="top">
      <img src="/home/hero-garage.jpg" alt="" className="home-hero__photo" />
      <div className="home-hero__shade" aria-hidden="true" />
      <div className="home-hero__glow home-hero__glow--teal" aria-hidden="true" />
      <div className="home-hero__glow home-hero__glow--gold" aria-hidden="true" />

      <div className="home-container home-hero__grid">
        <div>
          <h1 className="home-hero__title">
            Next-generation
            <span className="home-hero__title-accent">Parking System</span>
          </h1>

          <p className="home-hero__lead">
            Seamless optical ANPR access, 3D digital twin spatial guidance, and precision slot allocation for prestige
            &amp; performance fleets.
          </p>

          <div className="home-hero__actions">
            <a href="#facilities" className="home-btn home-btn--teal">
              <Boxes aria-hidden />
              Explore 3D bay architecture
            </a>
            <Link to={reserveTo} className="home-btn home-btn--gold-outline">
              <ShieldCheck aria-hidden />
              Reserve priority slot
            </Link>
          </div>

          <ul className="home-hero__features">
            <li>
              <Gauge aria-hidden /> Optical ANPR access
            </li>
            <li>
              <SlidersHorizontal aria-hidden /> Dedicated wide bays
            </li>
            <li>
              <Zap aria-hidden /> Rapid high-power charging
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}
