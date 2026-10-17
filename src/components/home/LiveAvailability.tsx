import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bike, Car, MapPin, Search, Zap } from 'lucide-react'
import { formatNumber, formatRelativeTime } from '@/lib/format'
import { toSearchable } from '@/lib/text'
import { useAuth } from '@/hooks/useAuth'
import { useNow } from '@/hooks/useNow'
import type { CapacityVehicleType, ParkingLotCapacityDTO } from '@/types/parking.dto'
import {
  LEVEL_LABEL,
  STATUS_LABEL,
  VEHICLE_FILTERS,
  bookableSpaces,
  isOperating as isLotOperating,
  lotSpaces,
  occupancyLevel,
  type VehicleFilter,
} from './capacityStats'
import { useCountUp, useReveal } from './useHomeEffects'

const VEHICLE_ICON: Record<CapacityVehicleType, typeof Car> = { CAR: Car, MOTORBIKE: Bike, EV_CHARGING: Zap }
const VEHICLE_SHORT: Record<CapacityVehicleType, string> = { CAR: 'Car', MOTORBIKE: 'Motorbike', EV_CHARGING: 'EV' }

type SortKey = 'free' | 'name'

function FreeCount({ value }: { value: number }) {
  const shown = useCountUp(value, 600)
  // Re-mounting on change replays the highlight animation.
  return (
    <span key={value} className="home-lot__free-value">
      {formatNumber(shown)}
    </span>
  )
}

function LotCard({ lot, filter, reserveTo }: { lot: ParkingLotCapacityDTO; filter: VehicleFilter; reserveTo: string }) {
  const { free, total } = lotSpaces(lot, filter)
  const occupancy = total > 0 ? ((total - free) / total) * 100 : 0
  const level = occupancyLevel(occupancy)
  const isOperating = isLotOperating(lot)

  return (
    <article className={`home-lot home-lot--${level} ${isOperating ? '' : 'home-lot--offline'}`}>
      <header className="home-lot__header">
        <div>
          <h3 className="home-lot__name">{lot.name}</h3>
          <p className="home-lot__address">
            <MapPin aria-hidden /> {lot.address}
          </p>
        </div>
        <span className={`home-chip home-chip--${isOperating ? level : 'offline'}`}>
          {isOperating ? LEVEL_LABEL[level] : STATUS_LABEL[lot.status]}
        </span>
      </header>

      <div className="home-lot__free">
        <FreeCount value={isOperating ? free : 0} />
        <span className="home-lot__free-label">free of {formatNumber(total)}</span>
      </div>

      <div
        className="home-meter"
        role="meter"
        aria-label={`${lot.name} occupancy`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(occupancy)}
      >
        <span className="home-meter__fill" style={{ width: `${Math.min(100, occupancy)}%` }} />
      </div>

      <ul className="home-lot__types">
        {lot.capacityByVehicle.map((detail) => {
          const Icon = VEHICLE_ICON[detail.vehicleType]
          return (
            <li key={detail.vehicleType} className={filter === detail.vehicleType ? 'is-active' : undefined}>
              <Icon aria-hidden />
              <span>{VEHICLE_SHORT[detail.vehicleType]}</span>
              <strong>{formatNumber(detail.availableSlots)}</strong>
            </li>
          )
        })}
      </ul>

      <Link
        to={reserveTo}
        className={`home-btn home-btn--outline home-lot__cta ${isOperating && free > 0 ? '' : 'is-disabled'}`}
        aria-disabled={!isOperating || free === 0}
        tabIndex={isOperating && free > 0 ? undefined : -1}
      >
        {isOperating && free > 0 ? 'Reserve a space' : 'Unavailable'}
      </Link>
    </article>
  )
}

interface LiveAvailabilityProps {
  lots: ParkingLotCapacityDTO[]
  isLoading: boolean
  isError: boolean
  updatedAt: number
  search: string
  onSearchChange: (value: string) => void
}

export function LiveAvailability({ lots, isLoading, isError, updatedAt, search, onSearchChange }: LiveAvailabilityProps) {
  const { user } = useAuth()
  const now = useNow(1000)
  const [filter, setFilter] = useState<VehicleFilter>('ALL')
  const [sort, setSort] = useState<SortKey>('free')
  const revealRef = useReveal<HTMLElement>()

  const visibleLots = useMemo(() => {
    const term = toSearchable(search)
    return lots
      .filter((lot) => !term || toSearchable(`${lot.name} ${lot.address} ${lot.code}`).includes(term))
      .filter((lot) => filter === 'ALL' || lot.capacityByVehicle.some((d) => d.vehicleType === filter))
      .sort((a, b) =>
        sort === 'name' ? a.name.localeCompare(b.name) : bookableSpaces(b, filter) - bookableSpaces(a, filter),
      )
  }, [lots, search, filter, sort])

  // Drivers reserve from their dashboard; visitors create an account first.
  const reserveTo = user ? '/me' : '/register'

  return (
    <section className="home-section home-reveal" id="availability" ref={revealRef}>
      <div className="home-container">
        <div className="home-section__head">
          <div>
            <p className="home-eyebrow">
              <span className="home-live-dot" aria-hidden="true" />
              Live availability
            </p>
            <h2 className="home-section__title">Free spaces, updated every few seconds</h2>
          </div>
          <p className="home-updated" aria-live="polite">
            {updatedAt ? `Updated ${formatRelativeTime(updatedAt, now)}` : 'Loading…'}
          </p>
        </div>

        <div className="home-toolbar">
          <div className="home-filter" role="group" aria-label="Filter by vehicle type">
            {VEHICLE_FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`home-filter__btn ${filter === option.value ? 'is-active' : ''}`}
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="home-toolbar__right">
            <label className="home-toolbar__search">
              <Search aria-hidden />
              <input
                type="search"
                placeholder="Search lots…"
                aria-label="Search parking lots"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </label>
            <select
              className="home-select"
              aria-label="Sort parking lots"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="free">Most free spaces</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </div>
        </div>

        {isError ? (
          <p className="home-empty">Live availability is not reachable right now. Please try again in a moment.</p>
        ) : isLoading ? (
          <div className="home-lots">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="home-lot home-lot--skeleton" aria-hidden="true" />
            ))}
          </div>
        ) : visibleLots.length === 0 ? (
          <p className="home-empty">
            No parking lots match “{search}”.{' '}
            <button type="button" className="home-link" onClick={() => onSearchChange('')}>
              Show all lots
            </button>
          </p>
        ) : (
          <div className="home-lots">
            {visibleLots.map((lot) => (
              <LotCard key={lot.id} lot={lot} filter={filter} reserveTo={reserveTo} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
