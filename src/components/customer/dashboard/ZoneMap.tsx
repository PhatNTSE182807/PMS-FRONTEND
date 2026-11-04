import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bike, Car, CircleCheck, Info, MapPin, MousePointerClick, Rotate3d, Wrench, X } from 'lucide-react'
import { isMockService } from '@/config/env'
import { useLotPlan2D } from '@/hooks/useLotLayout'
import { usePublicPrices } from '@/hooks/usePricing'
import { useVehicles } from '@/hooks/useProfile'
import { useBookableLots, useMyReservations } from '@/hooks/useReservations'
import { formatNumber } from '@/lib/format'
import type { ParkingLotCapacityDTO } from '@/types/parking.dto'
import type { PublicLotPriceDTO } from '@/types/pricing.dto'
import { vehicleKind } from '../customerFormat'
import { GarageView } from '../garage/GarageView'
import { buildGarage, type Bay, type BayStatus } from '../garage/garageModel'
import { ParkMotorbikePanel } from './ParkMotorbikePanel'
import { ReserveBayPanel } from './ReserveBayPanel'

/** What the map needs of a lot, from either the live lot list or the demo capacity data. */
type MapLot = Pick<ParkingLotCapacityDTO, 'id' | 'code' | 'name' | 'address'> & {
  /** False while the lot is under maintenance (e.g. no Manager and Staff on duty yet): view only. */
  isBookable?: boolean
  maintenanceNotice?: string | null
}

const DEFAULT_MAINTENANCE_NOTICE = 'This lot is under maintenance. You can look around, but it cannot take bookings right now.'

const STATUS_LABEL: Record<BayStatus, string> = {
  AVAILABLE: 'Available',
  RESERVED: 'Booked by another driver',
  OCCUPIED: 'Occupied',
}

/** "20,000 VND / 1h", "35,000 VND first 2h", "5,000 VND / day", or day and night prices, from the lot's public price. */
function priceLabel(p: PublicLotPriceDTO): string {
  if (p.chargeModel === 'PerEntry') return `${formatNumber(p.entryFee)} VND / day`
  const block = p.blockMinutes % 60 === 0 ? `${p.blockMinutes / 60}h` : `${p.blockMinutes} min`
  if (p.chargeModel === 'DayNight' && p.dayPrice != null && p.nightPrice != null)
    return `${formatNumber(p.dayPrice)} day • ${formatNumber(p.nightPrice)} night VND / ${block}`
  if (p.firstBlockMinutes && p.firstBlockPrice != null)
    return `${formatNumber(p.firstBlockPrice)} VND first ${p.firstBlockMinutes % 60 === 0 ? `${p.firstBlockMinutes / 60}h` : `${p.firstBlockMinutes} min`}`
  return `${formatNumber(p.blockPrice)} VND / ${block}`
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
export function ZoneMap({ lots: capacityLots, isLoading, lotId, onLotChange }: ZoneMapProps) {
  // Live bookings need the backend's lots (numeric ids); demo bookings use the demo capacity lots
  const liveBooking = !isMockService('booking')
  const bookable = useBookableLots()
  const lots: MapLot[] = liveBooking
    ? (bookable.data ?? []).map((l) => ({
        id: l.key,
        code: l.code,
        name: l.name,
        address: l.address,
        isBookable: l.isBookable ?? true,
        maintenanceNotice: l.maintenanceNotice,
      }))
    : capacityLots
  // The page owns the selection, so the lot chips in the welcome banner move the map too
  const lot = lots.find((l) => l.id === lotId) ?? lots[0]
  const capacityLot = capacityLots.find((l) => l.id === lot?.id)

  // The published layout gives the real slot ids a reservation needs; the template model is the fallback
  const plan = useLotPlan2D(lot?.id, 'slots', false)
  const planFloors = plan.data?.floors
  const floors = useMemo(() => planFloors ?? (capacityLot ? buildGarage(capacityLot) : []), [planFloors, capacityLot])
  const bookableBays = Boolean(planFloors)
  const [focusFloor, setFocusFloor] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const myReservations = useMyReservations()
  const vehicles = useVehicles()
  const myActive = (myReservations.data ?? []).filter(
    (r) => (r.status === 'PendingDeposit' || r.status === 'Confirmed') && lot && (String(r.parkingLotId) === lot.id || r.parkingLotName === lot.name),
  )
  const myBayIds = new Set(myActive.map((r) => String(r.slotId)))

  const allBays = floors.flatMap((f) => f.bays)
  const selected = allBays.find((b) => b.id === selectedId) ?? null
  const selectedFloor = selected ? floors[selected.floorIndex] : null
  // Highlighted in the model as "your booking"
  const myBayId = myActive[0] ? String(myActive[0].slotId) : null
  const myVehicle = vehicles.data?.find((v) => v.vehicleId === myActive[0]?.vehicleId)
  const myVehicleKind = myVehicle && vehicleKind({ name: myVehicle.vehicleType }) === 'suv' ? 'suv' : 'car'
  // The lot's real prices (the same rule the exit gate uses): motorbike floors show the motorbike price, car floors the 4-seat car price
  const prices = usePublicPrices(lot?.id)
  const price = prices.data?.find((p) => p.vehicleTypeCode === (selectedFloor?.kind === 'motorbike' ? 'MOTORBIKE' : 'CAR_4'))
  const isLoadingLots = liveBooking ? bookable.isPending : isLoading
  const underMaintenance = lot?.isBookable === false

  const changeLot = (id: string) => {
    onLotChange(id)
    setSelectedId(null)
    setFocusFloor(null)
  }

  const selectBay = (bay: Bay) => {
    setSelectedId(bay.id)
    setFocusFloor(bay.floorIndex)
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
              {l.isBookable === false && ' • Maintenance'}
            </button>
          ))}
        </div>
      </div>

      {isLoadingLots && <div className="cx-skeleton" style={{ height: '30rem' }} />}
      {!isLoadingLots && !lot && <p className="cx-empty">No parking terminals are available right now.</p>}

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

            <GarageView floors={floors} focusFloor={focusFloor} selectedBayId={selectedId} myBayId={myBayId} myVehicleColor={myVehicle?.color} myVehicleKind={myVehicleKind} onSelectBay={selectBay} />

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

            {underMaintenance && (
              <p className="cx-map__mine" role="status">
                <Wrench size={15} aria-hidden /> {lot.maintenanceNotice || DEFAULT_MAINTENANCE_NOTICE}
              </p>
            )}

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
                      {myBayIds.has(selected.id) ? 'Your booking' : STATUS_LABEL[selected.status]}
                    </strong>
                  </div>
                  <div className="cx-map__cell">
                    <span className="cx-label">Vehicle type</span>
                    <strong>{selectedFloor.kind === 'car' ? '4-seat & 7-seat cars' : 'Motorbikes'}</strong>
                  </div>
                  <div className="cx-map__cell">
                    <span className="cx-label">Rate</span>
                    <strong>{price ? priceLabel(price) : '—'}</strong>
                  </div>
                  <div className="cx-map__cell">
                    <span className="cx-label">Floor free now</span>
                    <strong className="is-gold">{formatNumber(selectedFloor.liveFree)} / {formatNumber(selectedFloor.liveTotal)}</strong>
                  </div>
                </div>
                {myBayIds.has(selected.id) ? (
                  <Link to="/me/bookings" className="cx-btn cx-btn--light cx-btn--block">
                    <CircleCheck aria-hidden />
                    {myActive.find((r) => String(r.slotId) === selected.id)?.status === 'PendingDeposit'
                      ? 'Booked for you • pay the deposit'
                      : selectedFloor.kind === 'car'
                        ? 'Booked for you • show my QR'
                        : 'Held for you • Staff checks you in at the gate'}
                  </Link>
                ) : selected.status === 'AVAILABLE' && bookableBays && !underMaintenance ? (
                  // Cars book ahead with a time and an optional deposit; motorbikes claim the bay now
                  selectedFloor.kind === 'car' ? (
                    <ReserveBayPanel key={`${lot.id}-${selected.id}`} lotKey={lot.id} slotId={selected.id} slotCode={selected.code} />
                  ) : (
                    <ParkMotorbikePanel key={`${lot.id}-${selected.id}`} lotKey={lot.id} slotId={selected.id} slotCode={selected.code} />
                  )
                ) : (
                  <button type="button" className="cx-btn cx-btn--light cx-btn--block" disabled>
                    <CircleCheck aria-hidden />
                    {myBayIds.has(selected.id)
                      ? 'Booked for you'
                      : underMaintenance
                        ? 'Under maintenance • view only'
                        : selected.status !== 'AVAILABLE'
                        ? 'Not available'
                        : 'This lot has no published layout yet'}
                  </button>
                )}
              </>
            ) : (
              <div className="cx-map__hint">
                <MousePointerClick aria-hidden />
                <p>
                  {underMaintenance
                    ? 'Click a bay in the 3D model to see its details. This lot is not taking bookings right now.'
                    : 'Click a green bay in the 3D model to see its details and book it.'}
                </p>
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

            {myActive.map((r) => (
              <p key={r.id} className="cx-map__mine">
                <CircleCheck size={15} aria-hidden /> Your booking: bay <strong>{r.slotCode}</strong>
                {r.status === 'PendingDeposit' ? ' • deposit pending' : ' • confirmed'}
                <Link to="/me/bookings" className="cx-link">Manage</Link>
              </p>
            ))}
          </aside>
        </div>
      )}
    </section>
  )
}
