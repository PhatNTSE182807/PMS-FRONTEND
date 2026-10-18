import { lazy, Suspense, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Bike, Car, CircleCheck, Info, MapPin, MousePointerClick, Rotate3d, X } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import { demoTariffs } from '@/mocks/managerOps.mock'
import type { ParkingLotCapacityDTO } from '@/types/parking.dto'
import { buildGarage, type Bay, type BayStatus } from '../garage/garageModel'

// three.js is large: load it only when the map is on screen.
const Garage3D = lazy(() => import('../garage/Garage3D'))

const STATUS_LABEL: Record<BayStatus, string> = {
  AVAILABLE: 'Available',
  RESERVED: 'Booked by another driver',
  OCCUPIED: 'Occupied',
}

interface ZoneMapProps {
  lots: ParkingLotCapacityDTO[]
  isLoading: boolean
  lotId: string | undefined
  onLotChange: (lotId: string) => void
}

/**
 * 3D garage of the selected lot, built from its layout template: motorbikes on the ground level, cars above. Each floor mirrors the live
 * occupancy of the lot's zones; the customer picks a free bay and reserves it.
 */
export function ZoneMap({ lots, isLoading, lotId, onLotChange }: ZoneMapProps) {
  const lot = lots.find((l) => l.id === lotId) ?? lots[0]
  const floors = useMemo(() => (lot ? buildGarage(lot) : []), [lot])
  const [focusFloor, setFocusFloor] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // The booking made here; demo until the booking API exists.
  const [myBooking, setMyBooking] = useState<{ lotId: string; bayId: string; code: string } | null>(null)

  const allBays = floors.flatMap((f) => f.bays)
  const selected = allBays.find((b) => b.id === selectedId) ?? null
  const selectedFloor = selected ? floors[selected.floorIndex] : null
  const myBayId = myBooking && myBooking.lotId === lot?.id ? myBooking.bayId : null
  const tariff = demoTariffs.find((t) => t.id === (selectedFloor?.kind === 'motorbike' ? 'MOTORBIKE' : 'CAR'))

  const changeLot = (id: string) => {
    onLotChange(id)
    setSelectedId(null)
    setFocusFloor(null)
  }

  const selectBay = (bay: Bay) => {
    setSelectedId(bay.id)
    setFocusFloor(bay.floorIndex)
  }

  const book = () => {
    if (!selected || !lot) return
    setMyBooking({ lotId: lot.id, bayId: selected.id, code: selected.code })
    toast.success(`Bay ${selected.code} reserved at ${lot.name}`, {
      description: 'Demo booking: it is kept on this page until the booking API is connected.',
    })
  }

  return (
    <section className="cx-card cx-map" id="map" aria-labelledby="map-title">
      <div className="cx-map__head">
        <div>
          <span className="cx-eyebrow">
            <span className="cx-dot cx-dot--gold" aria-hidden="true" /> 3D digital twin • Real-time bay reservation
          </span>
          <h2 className="cx-map__title" id="map-title">Interactive 3D Parking Map &amp; Slot Booking</h2>
          <p className="cx-card__subtitle">Every level refreshed live from the gate sensors. Drag to rotate, scroll to zoom, click a bay.</p>
        </div>
        <div className="cx-tabs" role="tablist" aria-label="Parking terminal">
          {lots.map((l) => (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={l.id === lot?.id}
              className={`cx-tab ${l.id === lot?.id ? 'cx-tab--active' : ''}`}
              onClick={() => changeLot(l.id)}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <div className="cx-skeleton" style={{ height: '30rem' }} />}
      {!isLoading && !lot && <p className="cx-empty">No parking terminals are available right now.</p>}

      {lot && (
        <div className="cx-map__body">
          <div className="cx-map__board cx-map__board--3d">
            <div className="cx-map__legend">
              <span className="cx-map__legend-items">
                <span><span className="cx-dot" aria-hidden="true" /> Available</span>
                <span><span className="cx-dot cx-dot--gold" aria-hidden="true" /> Booked</span>
                <span><span className="cx-dot cx-dot--red" aria-hidden="true" /> Occupied</span>
                <span><span className="cx-dot cx-dot--teal" aria-hidden="true" /> Selected</span>
              </span>
              <div className="cx-floor-tabs" role="tablist" aria-label="Floor">
                <button type="button" role="tab" aria-selected={focusFloor === null} className={`cx-tab ${focusFloor === null ? 'cx-tab--active' : ''}`} onClick={() => setFocusFloor(null)}>
                  All floors
                </button>
                {floors.map((f) => (
                  <button
                    key={f.level}
                    type="button"
                    role="tab"
                    aria-selected={focusFloor === f.index}
                    className={`cx-tab ${focusFloor === f.index ? 'cx-tab--active' : ''}`}
                    onClick={() => setFocusFloor(f.index)}
                  >
                    {f.level} {f.kind === 'car' ? <Car size={13} aria-hidden /> : <Bike size={13} aria-hidden />}
                  </button>
                ))}
              </div>
            </div>

            <Suspense fallback={<div className="garage3d garage3d--loading">Loading 3D model…</div>}>
              <Garage3D floors={floors} focusFloor={focusFloor} selectedBayId={selectedId} myBayId={myBayId} onSelectBay={selectBay} />
            </Suspense>

            <div className="cx-map__footer">
              <span><MapPin size={13} aria-hidden style={{ verticalAlign: '-2px' }} /> {lot.address}</span>
              <span><Rotate3d size={13} aria-hidden style={{ verticalAlign: '-2px' }} /> Drag to rotate • scroll to zoom</span>
            </div>
          </div>

          <aside className="cx-map__detail" aria-live="polite">
            <div className="cx-card__head" style={{ marginBottom: 0 }}>
              <span className="cx-eyebrow cx-eyebrow--teal">
                <Info size={14} aria-hidden /> Selected slot telemetry
              </span>
              <span className="cx-chip cx-chip--teal">{lot.code}</span>
            </div>

            {selected && selectedFloor ? (
              <>
                <div className="cx-map__stall">
                  <div>
                    <span className="cx-label">Stall ID</span>
                    <span className="cx-map__stall-name">Bay {selected.code}</span>
                    <span className="cx-metric__sub">
                      Floor {selectedFloor.level} • {selectedFloor.kind === 'car' ? 'Car deck' : 'Motorbike deck'}
                    </span>
                  </div>
                  <button type="button" className="cx-icon-btn" aria-label="Clear selection" onClick={() => setSelectedId(null)}>
                    <X aria-hidden />
                  </button>
                </div>
                <div className="cx-map__cells">
                  <div className="cx-map__cell">
                    <span className="cx-label">Status</span>
                    <strong className={selected.status === 'AVAILABLE' ? 'is-gold' : undefined}>
                      {selected.id === myBayId ? 'Your booking' : STATUS_LABEL[selected.status]}
                    </strong>
                  </div>
                  <div className="cx-map__cell">
                    <span className="cx-label">Vehicle type</span>
                    <strong>{selectedFloor.kind === 'car' ? 'Sedan / SUV / EV' : 'Motorbike / scooter'}</strong>
                  </div>
                  <div className="cx-map__cell">
                    <span className="cx-label">Rate</span>
                    <strong>{tariff ? `${formatNumber(tariff.firstBlockPrice)} VND first block` : '—'}</strong>
                  </div>
                  <div className="cx-map__cell">
                    <span className="cx-label">Floor free now</span>
                    <strong className="is-gold">{formatNumber(selectedFloor.liveFree)} / {formatNumber(selectedFloor.liveTotal)}</strong>
                  </div>
                </div>
                <button
                  type="button"
                  className="cx-btn cx-btn--light cx-btn--block"
                  disabled={selected.status !== 'AVAILABLE' || selected.id === myBayId}
                  onClick={book}
                >
                  <CircleCheck aria-hidden />
                  {selected.id === myBayId ? 'Booked for you' : selected.status === 'AVAILABLE' ? `Book bay ${selected.code}` : 'Not available'}
                </button>
              </>
            ) : (
              <div className="cx-map__hint">
                <MousePointerClick aria-hidden />
                <p>Click a green bay in the 3D model to see its details and book it.</p>
              </div>
            )}

            <div className="cx-map__floors">
              {floors.map((f) => {
                const free = f.bays.filter((b) => b.status === 'AVAILABLE').length
                const percent = f.liveTotal ? ((f.liveTotal - f.liveFree) / f.liveTotal) * 100 : 0
                return (
                  <button key={f.level} type="button" className="cx-map__floor" onClick={() => setFocusFloor(f.index)}>
                    <span className="cx-map__floor-name">
                      {f.level} • {f.kind === 'car' ? 'Cars' : 'Motorbikes'}
                    </span>
                    <span className="cx-map__floor-meta">{f.zoneLabel}</span>
                    <span className={`cx-meter ${percent >= 90 ? 'cx-meter--full' : percent >= 75 ? 'cx-meter--busy' : ''}`}>
                      <span style={{ width: `${Math.min(100, percent)}%` }} />
                    </span>
                    <span className="cx-map__floor-meta">
                      {formatNumber(f.liveFree)} free of {formatNumber(f.liveTotal)} • {free} bookable bays shown
                    </span>
                  </button>
                )
              })}
            </div>

            {myBooking && (
              <p className="cx-map__mine">
                <CircleCheck size={15} aria-hidden /> Your booking: bay <strong>{myBooking.code}</strong>
                <button type="button" className="cx-link" onClick={() => setMyBooking(null)}>Cancel</button>
              </p>
            )}
          </aside>
        </div>
      )}
    </section>
  )
}
