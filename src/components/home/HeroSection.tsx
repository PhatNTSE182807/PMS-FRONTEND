import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Search } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import type { ParkingLotCapacityDTO } from '@/types/parking.dto'
import { systemTotals } from './capacityStats'
import { useCountUp, useRotatingIndex } from './useHomeEffects'

const ROTATING_WORDS = ['Find a free slot.', 'Reserve it ahead.', 'Park in seconds.']

function Stat({ value, label }: { value: number; label: string }) {
  const shown = useCountUp(value)
  return (
    <div className="home-hero__stat">
      <span className="home-hero__stat-value">{formatNumber(shown)}</span>
      <span className="home-hero__stat-label">{label}</span>
    </div>
  )
}

interface HeroSectionProps {
  lots: ParkingLotCapacityDTO[]
  isLoading: boolean
  /** Hands the search text to the availability section and scrolls there. */
  onSearch: (query: string) => void
}

export function HeroSection({ lots, isLoading, onSearch }: HeroSectionProps) {
  const [wordIndex] = useRotatingIndex(ROTATING_WORDS.length, 2600)
  const [query, setQuery] = useState('')
  const totals = systemTotals(lots)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSearch(query.trim())
  }

  return (
    <section className="home-hero" id="top">
      <div className="home-hero__photo" style={{ backgroundImage: `url('/lamborghini.jpg')` }} aria-hidden="true" />
      <div className="home-hero__tint" aria-hidden="true" />

      <div className="home-container home-hero__content">
        <p className="home-eyebrow home-eyebrow--light">
          <span className="home-live-dot" aria-hidden="true" />
          Live parking across Ho Chi Minh City
        </p>

        <h1 className="home-hero__title">
          Parking without the circling.
          <span className="home-hero__rotating" aria-live="polite">
            <span key={wordIndex} className="home-hero__word">
              {ROTATING_WORDS[wordIndex]}
            </span>
          </span>
        </h1>

        <p className="home-hero__lead">
          XXIV Parking shows free spaces in real time, lets you reserve ahead and checks you in with a QR code.
        </p>

        <form className="home-search" onSubmit={handleSubmit} role="search">
          <Search className="home-search__icon" aria-hidden />
          <input
            type="search"
            className="home-search__input"
            placeholder="Search a parking lot or address…"
            aria-label="Search parking lots"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="home-btn home-btn--primary">
            Find parking
          </button>
        </form>

        <div className="home-hero__ctas">
          <Link to="/register" className="home-btn home-btn--light">
            Get started free <ArrowRight aria-hidden />
          </Link>
        </div>

        <div className="home-hero__stats" aria-busy={isLoading}>
          <Stat value={totals.openLots} label="Lots open now" />
          <Stat value={totals.freeSpaces} label="Free spaces right now" />
          <Stat value={totals.totalSpaces} label="Spaces in the network" />
        </div>
      </div>
    </section>
  )
}
