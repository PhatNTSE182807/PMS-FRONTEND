import { Link } from 'react-router-dom'
import { Bike, Car, Zap } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import type { CapacityVehicleType, ParkingLotCapacityDTO } from '@/types/parking.dto'
import { LEVEL_LABEL, STATUS_LABEL, isOperating, lotSpaces, occupancyLevel } from './capacityStats'
import { useCountUp, useReveal } from './useHomeEffects'

const VEHICLE_ICON: Record<CapacityVehicleType, typeof Car> = { CAR: Car, MOTORBIKE: Bike, EV_CHARGING: Zap }
const VEHICLE_SHORT: Record<CapacityVehicleType, string> = { CAR: 'Car', MOTORBIKE: 'Motorbike', EV_CHARGING: 'EV' }

function FreeCount({ value }: { value: number }) {
  return <span className="home-terminal__free-value">{formatNumber(useCountUp(value, 600))}</span>
}

function TerminalCard({ lot, reserveTo }: { lot: ParkingLotCapacityDTO; reserveTo: string }) {
  const { free, total } = lotSpaces(lot)
  const occupancy = total > 0 ? ((total - free) / total) * 100 : 0
  const level = occupancyLevel(occupancy)
  const operating = isOperating(lot)

  return (
    <article className={`home-terminal home-terminal--${operating ? level : 'offline'}`}>
      <div className="home-terminal__tags">
        <span className="home-terminal__city">{lot.code}</span>
        <span className={`home-terminal__level home-terminal__level--${operating ? level : 'offline'}`}>
          {operating ? LEVEL_LABEL[level] : STATUS_LABEL[lot.status]}
        </span>
      </div>

      <h3 className="home-terminal__name">{lot.name}</h3>
      <p className="home-terminal__address">{lot.address}</p>

      <div className="home-terminal__free">
        <FreeCount value={operating ? free : 0} />
        <span className="home-terminal__free-label">bays free of {formatNumber(total)}</span>
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
        {lot.capacityByVehicle.map((detail) => {
          const Icon = VEHICLE_ICON[detail.vehicleType]
          return (
            <li key={detail.vehicleType}>
              <Icon aria-hidden />
              {VEHICLE_SHORT[detail.vehicleType]} <strong>{formatNumber(detail.availableSlots)}</strong>
            </li>
          )
        })}
      </ul>

      {operating ? (
        <Link to={reserveTo} className="home-btn">
          Reserve bay
        </Link>
      ) : (
        <span className="home-btn" aria-disabled="true">
          Temporarily unavailable
        </span>
      )}
    </article>
  )
}

interface TerminalNetworkProps {
  lots: ParkingLotCapacityDTO[]
  isLoading: boolean
  isError: boolean
  reserveTo: string
}

/** Live parking lots from the capacity feed; open lots with the most space come first. */
export function TerminalNetwork({ lots, isLoading, isError, reserveTo }: TerminalNetworkProps) {
  const ref = useReveal<HTMLDivElement>()
  const sorted = [...lots].sort(
    (a, b) => Number(isOperating(b)) - Number(isOperating(a)) || lotSpaces(b).free - lotSpaces(a).free,
  )

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
          {!isLoading && sorted.length === 0 && (
            <p className="home-terminals__empty">
              {isError ? 'We could not reach the parking network. Please try again shortly.' : 'No terminals are listed yet.'}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
