import { Link } from 'react-router-dom'
import { Boxes, Gauge, Navigation, ShieldCheck, SlidersHorizontal, Zap } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import type { ParkingLotCapacityDTO } from '@/types/parking.dto'
import { isOperating, lotSpaces, systemTotals } from './capacityStats'
import { useCountUp } from './useHomeEffects'

function LiveNumber({ value }: { value: number }) {
  return <>{formatNumber(useCountUp(value))}</>
}

interface HeroSectionProps {
  lots: ParkingLotCapacityDTO[]
  isLoading: boolean
  /** Where "Reserve priority slot" goes: the dashboard when signed in, otherwise sign-up. */
  reserveTo: string
}

export function HeroSection({ lots, isLoading, reserveTo }: HeroSectionProps) {
  const totals = systemTotals(lots)
  const occupancy = totals.totalSpaces > 0 ? ((totals.totalSpaces - totals.freeSpaces) / totals.totalSpaces) * 100 : 0
  // The lot with the most free spaces is the one we'd route a driver to.
  const best = lots.filter(isOperating).sort((a, b) => lotSpaces(b).free - lotSpaces(a).free)[0]

  return (
    <section className="home-hero" id="top">
      <img src="/home/hero-garage.jpg" alt="" className="home-hero__photo" />
      <div className="home-hero__shade" aria-hidden="true" />
      <div className="home-hero__glow home-hero__glow--teal" aria-hidden="true" />
      <div className="home-hero__glow home-hero__glow--gold" aria-hidden="true" />

      <div className="home-container home-hero__grid">
        <div>
          <p className="home-hero__badge">
            <span className="home-dot home-dot--gold" aria-hidden="true" />
            Ho Chi Minh City metropolitan network • 99.998% uptime
          </p>

          <h1 className="home-hero__title">
            Next-generation
            <span className="home-hero__title-accent">sovereign parking</span>
            telemetry
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

        <aside className="home-hud" aria-label="Live network status" aria-busy={isLoading}>
          <div className="home-hud__header">
            <span className="home-hud__feed">
              <span className="home-dot home-dot--live" aria-hidden="true" />
              Gateway telemetry feed
            </span>
            <span className="home-hud__lock">Live</span>
          </div>

          <div className="home-hud__stats">
            <div className="home-hud__stat">
              <span className="home-hud__stat-label">Free bays now</span>
              <span className="home-hud__stat-value home-hud__stat-value--gold">
                <LiveNumber value={totals.freeSpaces} />
              </span>
              <span className="home-hud__stat-note">of {formatNumber(totals.totalSpaces)} in the network</span>
            </div>
            <div className="home-hud__stat">
              <span className="home-hud__stat-label">Terminals open</span>
              <span className="home-hud__stat-value">
                <LiveNumber value={totals.openLots} />
              </span>
              <span className="home-hud__stat-note">{Math.round(occupancy)}% occupied</span>
            </div>
          </div>

          <div
            className="home-hud__meter"
            role="meter"
            aria-label="Network occupancy"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(occupancy)}
          >
            <span className="home-hud__meter-fill" style={{ width: `${Math.min(100, occupancy)}%` }} />
          </div>

          <div className="home-hud__route">
            <Navigation aria-hidden />
            <span className="home-hud__route-text">
              <span className="home-hud__route-title">
                {best ? `Guidance: ${best.name}` : isLoading ? 'Connecting to gateways...' : 'No terminal open'}
              </span>
              <span className="home-hud__route-sub">
                {best ? `${formatNumber(lotSpaces(best).free)} bays free • most space right now` : 'Waiting for live data'}
              </span>
            </span>
            <span className="home-hud__live">LIVE</span>
          </div>
        </aside>
      </div>
    </section>
  )
}
