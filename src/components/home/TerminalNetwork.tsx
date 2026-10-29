import { Link } from 'react-router-dom'
import { Bike, Car } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import type { PublicBayVehicleType, PublicLotDTO } from '@/types/publicLot.dto'
import { LEVEL_LABEL, occupancyLevel } from './capacityStats'
import { useCountUp, useReveal } from './useHomeEffects'

const VEHICLE_ICON: Record<PublicBayVehicleType, typeof Car> = { CAR: Car, MOTORBIKE: Bike }
const VEHICLE_SHORT: Record<PublicBayVehicleType, string> = { CAR: 'Car', MOTORBIKE: 'Motorbike' }
/** Cars and motorbikes are always listed, even when a lot has no bays of one family. */
const VEHICLE_ORDER: PublicBayVehicleType[] = ['CAR', 'MOTORBIKE']

/** A lot can take bookings only when it is open and staffed (the API says so with isBookable). */
const isAvailable = (lot: PublicLotDTO) => lot.isBookable && lot.status === 'Active'

/** Share of bays in use, 0–100; a lot without bays counts as full. */
const occupancyOf = (lot: PublicLotDTO) =>
  lot.totalBays > 0 ? ((lot.totalBays - lot.freeBays) / lot.totalBays) * 100 : 100

function FreeCount({ value }: { value: number }) {
  return <span className="home-terminal__free-value">{formatNumber(useCountUp(value, 600))}</span>
}

function TerminalCard({ lot, reserveTo }: { lot: PublicLotDTO; reserveTo: string }) {
  const occupancy = occupancyOf(lot)
  const level = occupancyLevel(occupancy)
  const available = isAvailable(lot)
  const tone = available ? level : 'offline'
  const statusLabel = available ? LEVEL_LABEL[level] : lot.status === 'Maintenance' ? 'Maintenance' : 'Unavailable'

  return (
    <article className={`home-terminal home-terminal--${tone}`}>
      <div className="home-terminal__tags">
        <span className="home-terminal__city">{lot.code}</span>
        <span className={`home-terminal__level home-terminal__level--${tone}`}>{statusLabel}</span>
      </div>

      <h3 className="home-terminal__name">{lot.name}</h3>
      <p className="home-terminal__address">{lot.address}</p>

      <div className="home-terminal__free">
        <FreeCount value={lot.freeBays} />
        <span className="home-terminal__free-label">bays free of {formatNumber(lot.totalBays)}</span>
      </div>
      <div
        className="home-terminal__meter"
        role="meter"
        aria-label={`${lot.name} occupancy`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(occupancy)}
      >
        <span style={{ width: `${Math.min(100, occupancy)}%` }} />
      </div>

      <ul className="home-terminal__types">
        {VEHICLE_ORDER.map((type) => {
          const Icon = VEHICLE_ICON[type]
          const bays = lot.baysByVehicle.find((b) => b.vehicleType === type)
          return (
            <li key={type}>
              <Icon aria-hidden />
              {VEHICLE_SHORT[type]} <strong>{formatNumber(bays?.freeBays ?? 0)}</strong>
            </li>
          )
        })}
      </ul>

      {available ? (
        <Link to={reserveTo} className="home-btn">
          Reserve bay
        </Link>
      ) : (
        <span className="home-btn" aria-disabled="true" title={lot.maintenanceNotice ?? undefined}>
          Temporarily unavailable
        </span>
      )}
    </article>
  )
}

interface TerminalNetworkProps {
  lots: PublicLotDTO[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  reserveTo: string
}

/** The parking lots in the system with live free bays; bookable lots with the most space come first. */
export function TerminalNetwork({ lots, isLoading, isError, onRetry, reserveTo }: TerminalNetworkProps) {
  const ref = useReveal<HTMLDivElement>()
  const sorted = [...lots].sort(
    (a, b) => Number(isAvailable(b)) - Number(isAvailable(a)) || b.freeBays - a.freeBays || a.name.localeCompare(b.name),
  )
  // Keep showing the last good list when a refresh fails
  const failed = isError && lots.length === 0

  return (
    <section className="home-section" id="terminals">
      <div ref={ref} className="home-container home-reveal">
        <div className="home-section__head">
          <div>
            <span className="home-eyebrow">Premier hubs</span>
            <h2 className="home-heading">Metropolitan terminal network</h2>
          </div>
          <span className="home-pill">
            <span className={`home-dot ${isError ? 'home-dot--off' : 'home-dot--live'}`} aria-hidden="true" />
            {isError ? 'Live feed unavailable' : 'Instant booking active'}
          </span>
        </div>

        <div className="home-terminals" aria-busy={isLoading}>
          {isLoading &&
            Array.from({ length: 3 }, (_, i) => <div key={i} className="home-terminal home-terminal--skeleton" />)}
          {!isLoading && sorted.map((lot) => <TerminalCard key={lot.id} lot={lot} reserveTo={reserveTo} />)}
          {!isLoading && failed && (
            <div className="home-terminals__empty" role="alert">
              <p>We could not reach the parking network. Please try again shortly.</p>
              <button type="button" className="home-btn" onClick={onRetry}>
                Try again
              </button>
            </div>
          )}
          {!isLoading && !isError && sorted.length === 0 && (
            <p className="home-terminals__empty">No parking lots are listed yet.</p>
          )}
        </div>
      </div>
    </section>
  )
}
