import { useState } from 'react'
import { toast } from 'sonner'
import { Bike, Car, CircleCheck, Info, MapPin, Zap } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import type { CapacityVehicleType, ParkingLotCapacityDTO, ZoneCapacityDTO } from '@/types/parking.dto'

const VEHICLE_ICON: Record<CapacityVehicleType, typeof Car> = { CAR: Car, MOTORBIKE: Bike, EV_CHARGING: Zap }
const VEHICLE_LABEL: Record<CapacityVehicleType, string> = { CAR: 'Car', MOTORBIKE: 'Motorbike', EV_CHARGING: 'EV charging' }

const zoneFree = (zone: ZoneCapacityDTO) => Math.max(0, zone.totalSlots - zone.occupiedSlots)

function zoneTone(zone: ZoneCapacityDTO): 'open' | 'busy' | 'full' {
  if (zone.status === 'FULL' || zoneFree(zone) === 0) return 'full'
  return zone.status === 'WARNING' ? 'busy' : 'open'
}

interface ZoneMapProps {
  lots: ParkingLotCapacityDTO[]
  isLoading: boolean
  lotId: string | undefined
  onLotChange: (lotId: string) => void
}

/** Live zones of one parking lot from the capacity feed; booking itself has no API yet. */
export function ZoneMap({ lots, isLoading, lotId, onLotChange }: ZoneMapProps) {
  const lot = lots.find((l) => l.id === lotId) ?? lots[0]
  const [zoneId, setZoneId] = useState<string>()
  const zone = lot?.zones.find((z) => z.zoneId === zoneId) ?? lot?.zones.find((z) => zoneTone(z) !== 'full') ?? lot?.zones[0]

  const free = zone ? zoneFree(zone) : 0
  const occupancy = zone && zone.totalSlots > 0 ? (zone.occupiedSlots / zone.totalSlots) * 100 : 0
  const tone = zone ? zoneTone(zone) : 'full'

  return (
    <section className="cx-card cx-map" id="map" aria-labelledby="map-title">
      <div className="cx-map__head">
        <div>
          <span className="cx-eyebrow">
            <span className="cx-dot cx-dot--gold" aria-hidden="true" /> Digital twin • Real-time bay reservation
          </span>
          <h2 className="cx-map__title" id="map-title">Interactive Parking Map &amp; Slot Booking</h2>
          <p className="cx-card__subtitle">Live zone availability across Saigon terminals, refreshed every few seconds.</p>
        </div>
        <div className="cx-tabs" role="tablist" aria-label="Parking terminal">
          {lots.map((l) => (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={l.id === lot?.id}
              className={`cx-tab ${l.id === lot?.id ? 'cx-tab--active' : ''}`}
              onClick={() => {
                onLotChange(l.id)
                setZoneId(undefined)
              }}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <div className="cx-skeleton" style={{ height: '22rem' }} />}
      {!isLoading && !lot && <p className="cx-empty">No parking terminals are available right now.</p>}

      {lot && (
        <div className="cx-map__body">
          <div className="cx-map__board">
            <div className="cx-map__legend">
              <span className="cx-map__legend-items">
                <span><span className="cx-dot" aria-hidden="true" /> Available</span>
                <span><span className="cx-dot cx-dot--amber" aria-hidden="true" /> Filling up</span>
                <span><span className="cx-dot cx-dot--teal" aria-hidden="true" /> Selected</span>
                <span><span className="cx-dot cx-dot--red" aria-hidden="true" /> Full</span>
              </span>
              <span className="cx-mono">{lot.code} • {Math.round(lot.overallOccupancyPercentage)}% occupied</span>
            </div>

            <div className="cx-map__grid">
              {lot.zones.map((z) => {
                const zTone = zoneTone(z)
                const selected = z.zoneId === zone?.zoneId
                return (
                  <button
                    key={z.zoneId}
                    type="button"
                    className={`cx-zone cx-zone--${zTone} ${selected ? 'cx-zone--selected' : ''}`}
                    aria-pressed={selected}
                    onClick={() => setZoneId(z.zoneId)}
                  >
                    <span className="cx-zone__name">{z.zoneName}</span>
                    <span className="cx-zone__free">{formatNumber(zoneFree(z))}</span>
                    <span className="cx-zone__label">{zTone === 'full' ? 'Occupied' : `free of ${formatNumber(z.totalSlots)}`}</span>
                  </button>
                )
              })}
            </div>

            <div className="cx-map__footer">
              <span><MapPin size={13} aria-hidden style={{ verticalAlign: '-2px' }} /> {lot.address}</span>
              <span><span className="cx-dot cx-dot--live" aria-hidden="true" style={{ display: 'inline-block' }} /> Sensor feed online</span>
            </div>
          </div>

          {zone && (
            <aside className="cx-map__detail" aria-live="polite">
              <div className="cx-card__head" style={{ marginBottom: 0 }}>
                <span className="cx-eyebrow cx-eyebrow--teal">
                  <Info size={14} aria-hidden /> Selected zone telemetry
                </span>
                <span className="cx-chip cx-chip--teal">{lot.code}</span>
              </div>

              <div className="cx-map__stall">
                <div>
                  <span className="cx-label">Zone</span>
                  <span className="cx-map__stall-name">{zone.zoneName}</span>
                  <span className="cx-metric__sub">{lot.name}</span>
                </div>
                <span className="cx-session__p" aria-hidden="true">P</span>
              </div>

              <div className="cx-map__cells">
                <div className="cx-map__cell">
                  <span className="cx-label">Free bays</span>
                  <strong className="is-gold">{formatNumber(free)}</strong>
                </div>
                <div className="cx-map__cell">
                  <span className="cx-label">Capacity</span>
                  <strong>{formatNumber(zone.totalSlots)} bays</strong>
                </div>
                {lot.capacityByVehicle.map((d) => {
                  const Icon = VEHICLE_ICON[d.vehicleType]
                  return (
                    <div className="cx-map__cell" key={d.vehicleType}>
                      <span className="cx-label">{VEHICLE_LABEL[d.vehicleType]} (lot)</span>
                      <strong>
                        <Icon size={13} aria-hidden style={{ verticalAlign: '-2px' }} /> {formatNumber(d.availableSlots)} free
                      </strong>
                    </div>
                  )
                })}
              </div>

              <div>
                <div className="cx-strength__row" style={{ marginBottom: '0.45rem', color: 'var(--cx-on-variant)' }}>
                  <span>Zone occupancy</span>
                  <span>{Math.round(occupancy)}%</span>
                </div>
                <div className={`cx-meter cx-meter--${tone}`}>
                  <span style={{ width: `${Math.min(100, occupancy)}%` }} />
                </div>
              </div>

              <button
                type="button"
                className="cx-btn cx-btn--light cx-btn--block"
                disabled={tone === 'full'}
                onClick={() => toast.info(`Online booking for ${zone.zoneName} opens soon. Free bays are shown live.`)}
              >
                <CircleCheck aria-hidden /> {tone === 'full' ? 'Zone is full' : `Proceed to book in ${zone.zoneName}`}
              </button>
            </aside>
          )}
        </div>
      )}
    </section>
  )
}
