import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bike, CalendarClock, Car, CircleAlert, CircleCheck, Info, MapPin, MousePointerClick, Navigation, Rotate3d, Wrench, X } from 'lucide-react'
import { isMockService } from '@/config/env'
import { LotDirectionsDialog } from '@/components/customer/LotDirectionsDialog'
import { usePublicLots } from '@/hooks/usePublicLots'
import { useLotPlan2D } from '@/hooks/useLotLayout'
import { useLotRealtime } from '@/hooks/useLotRealtime'
import { usePublicPrices } from '@/hooks/usePricing'
import { useBayForecast, useBookableLots, useMyReservations } from '@/hooks/useReservations'
import { useNow } from '@/hooks/useNow'
import { checkBookingTimes, defaultBookingTimes, describeWindow } from '@/lib/bookingTime'
import { BookingTimeFields } from '@/components/customer/BookingTimeFields'
import type { BayForecastDTO } from '@/types/operations.dto'
import { formatNumber } from '@/lib/format'
import { FILL_LABEL, fillLevel, fillLevelOf, type FillLevel } from '@/lib/fillLevel'
import type { ParkingLotCapacityDTO } from '@/types/parking.dto'
import type { PublicLotPriceDTO } from '@/types/pricing.dto'
import { vehicleKind } from '../customerFormat'
import { useCurrentSessions } from '@/hooks/useParkingSessions'
import { formatDate, formatTime } from '@/lib/format'
import type { CurrentSessionDTO } from '@/types/operations.dto'
import { BayVehicleCard } from '../garage/BayVehicleCard'
import { formatStay, useStayMinutes, vndOrDash } from '../garage/bayVehicleFormat'
import { GarageView } from '../garage/GarageView'
import { buildGarage, standardBays, type Bay, type BayStatus, type GarageFloor } from '../garage/garageModel'
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

const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })

/** The selected car bay's state during the picked window. */
function forecastLabel(f: BayForecastDTO): string {
  switch (f.state) {
    case 'Free':
      return 'Free at your time'
    case 'FreeingUp':
      return f.freeFrom ? `Free from ${clock.format(Date.parse(f.freeFrom))} • vehicle leaving` : 'Free at your time • vehicle leaving'
    case 'Booked':
      return 'Booked by another driver at your time'
    case 'Occupied':
      return f.bookable ? 'Occupied now • may be free by your time' : 'Still occupied at your time'
    case 'OutOfService':
      return 'Out of service'
    default:
      return 'Penalty bay'
  }
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

/** Popup over the 3D model when the customer clicks their own parked vehicle: where, how long, fee so far. */
function MyVehicleCard({ current, bayCode, onClose }: { current: CurrentSessionDTO; bayCode: string; onClose: () => void }) {
  const { session } = current
  const stay = useStayMinutes(session.entryTime)
  return (
    <BayVehicleCard
      bayCode={bayCode}
      title="Your vehicle"
      badge={{ text: current.vehicleLabel || session.vehicleTypeName || 'Parked', tone: 'mine' }}
      rows={[
        { label: 'Plate', value: session.hasPlate ? session.plateNumber : 'No plate' },
        { label: 'Entered', value: `${formatTime(session.entryTime)} · ${formatDate(session.entryTime)}` },
        { label: 'Parked for', value: formatStay(stay ?? current.elapsedMinutes) },
        // A lost-ticket case waiting for the Staff decision has no fee yet
        ...(current.lostTicketPending
          ? [{ label: 'Fee', value: 'Lost ticket • Staff checking the papers', emphasis: true }]
          : [
              { label: 'Fee so far', value: vndOrDash(current.feeSoFar), emphasis: true },
              ...(current.depositApplied > 0 ? [{ label: 'Deposit', value: `− ${vndOrDash(current.depositApplied)}` }] : []),
              ...(current.alreadyPaid > 0 ? [{ label: 'Already paid', value: `− ${vndOrDash(current.alreadyPaid)}` }] : []),
              { label: 'Due now', value: vndOrDash(current.amountDue) },
            ]),
      ]}
      footer={
        current.lostTicketPending ? (
          <>
            The fee and fine are settled at the exit lane once the case is decided. <Link to="/me" className="cx-link">See the details</Link>
          </>
        ) : (
          <>
            The fee refreshes every minute. <Link to="/me" className="cx-link">Pay or show the exit pass</Link>
          </>
        )
      }
      onClose={onClose}
    />
  )
}

/** The live status a forecast state is drawn with in the 3D model. */
const FORECAST_STATUS: Partial<Record<BayForecastDTO['state'], BayStatus>> = {
  Free: 'AVAILABLE',
  FreeingUp: 'AVAILABLE',
  Booked: 'RESERVED',
  Occupied: 'OCCUPIED',
}

/**
 * The car floors as they are expected to be during the picked window: a bay whose vehicle leaves in time is drawn
 * empty, a bay booked then is drawn booked. Motorbike floors, penalty bays and bays without a forecast stay live.
 */
function projectFloors(floors: GarageFloor[], forecast: Map<string, BayForecastDTO>): GarageFloor[] {
  if (forecast.size === 0) return floors
  return floors.map((floor) =>
    floor.kind !== 'car'
      ? floor
      : {
          ...floor,
          bays: floor.bays.map((bay) => {
            const f = bay.penalty ? undefined : forecast.get(bay.id)
            const status = f ? FORECAST_STATUS[f.state] : undefined
            if (!f || !status) return bay
            // A vehicle parked now that is still there at the picked time keeps the car the model draws for it (its
            // colour and 4- or 7-seat body), even when a booking also covers that time
            if (bay.status === 'OCCUPIED' && status !== 'AVAILABLE' && f.parkedThen !== false) return bay
            if (status === bay.status) return bay
            // A vehicle expected to be gone is not drawn; a bay expected to fill gets the model's own car
            return { ...bay, status, vehicleColor: null, vehicleKind: null, countedWalkIn: false, walkInSessionId: null }
          }),
        },
  )
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
  // Route to the selected lot (its map position when the Admin saved one, else found by address)
  const [showDirections, setShowDirections] = useState(false)
  const publicLots = usePublicLots()
  const directionsLot = publicLots.data?.find((l) => String(l.id) === lot?.id)
  const capacityLot = capacityLots.find((l) => l.id === lot?.id)
  // How full each lot is right now, from the public list (live counters); the selected lot falls back to its floors
  const fillOfLot = (id: string): FillLevel | null => {
    const publicLot = publicLots.data?.find((l) => String(l.id) === id)
    return publicLot ? fillLevelOf(publicLot) : null
  }

  // The published layout gives the real slot ids a reservation needs; the template model is the fallback
  // Bay changes arrive on the lot's public SignalR channel and patch the cached plan; while it is up the plan is only
  // re-read on a reconnect or a layout change (and every few minutes as a safety net) instead of every 2 seconds
  const realtime = useLotRealtime(lot?.id)
  const plan = useLotPlan2D(lot?.id, 'slots', realtime)
  const planFloors = plan.data?.floors
  const liveFloors = useMemo(() => planFloors ?? (capacityLot ? buildGarage(capacityLot) : []), [planFloors, capacityLot])
  const bookableBays = Boolean(planFloors)

  // Team rule (2026-11-17): the customer picks the time first and the car floors show what each bay is expected to be
  // then, e.g. a bay booked until 15:00 is free from 15:30, a simulated walk-in's bay is free once its stay is over
  const now = useNow(30_000)
  const [times, setTimes] = useState(() => defaultBookingTimes(Date.now()))
  const checkedTimes = checkBookingTimes(times, now)
  const bookingWindow = checkedTimes.ok ? { arrivalTime: checkedTimes.arrivalTime, departureTime: checkedTimes.departureTime } : null
  const hasCarFloor = liveFloors.some((f) => f.kind === 'car')
  const forecast = useBayForecast(bookableBays && hasCarFloor ? lot?.id : undefined, bookingWindow, realtime.connected)
  const forecastBySlot = useMemo(() => new Map((forecast.data ?? []).map((f) => [String(f.slotId), f])), [forecast.data])
  const floors = useMemo(() => projectFloors(liveFloors, forecastBySlot), [liveFloors, forecastBySlot])
  const forecastOn = forecastBySlot.size > 0
  // Car bays only: motorbikes claim a bay on arrival and are not part of the picked window
  const projectedFree = floors
    .filter((f) => f.kind === 'car')
    .reduce((sum, f) => sum + standardBays(f).filter((b) => forecastBySlot.get(b.id)?.bookable).length, 0)
  const [focusFloor, setFocusFloor] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const myReservations = useMyReservations()
  const myActive = (myReservations.data ?? []).filter(
    (r) => (r.status === 'PendingDeposit' || r.status === 'Confirmed') && lot && (String(r.parkingLotId) === lot.id || r.parkingLotName === lot.name),
  )
  const myBayIds = new Set(myActive.map((r) => String(r.slotId)))

  // The customer's own vehicles parked in this lot (GET /parking-sessions/current, scoped to the signed-in account)
  const currentSessions = useCurrentSessions()
  const myParked = (currentSessions.data ?? []).filter(
    (c) => c.session.slotId != null && lot && (String(c.session.parkingLotId) === lot.id || c.lotName === lot.name),
  )
  const myParkedByBay = new Map(myParked.map((c) => [String(c.session.slotId), c]))
  const [myVehicleBayId, setMyVehicleBayId] = useState<string | null>(null)
  const myVehicleOpen = myVehicleBayId ? myParkedByBay.get(myVehicleBayId) : undefined

  const allBays = floors.flatMap((f) => f.bays)
  const selected = allBays.find((b) => b.id === selectedId) ?? null
  const selectedFloor = selected ? floors[selected.floorIndex] : null
  // Car bays follow the forecast of the picked window; motorbikes claim a bay now, so they follow the live state
  const selectedForecast = selected && selectedFloor?.kind === 'car' ? forecastBySlot.get(selected.id) : undefined
  const selectedBookable = selectedForecast ? selectedForecast.bookable : selected?.status === 'AVAILABLE'
  // Highlighted in the model as "your booking", or else your parked vehicle
  const myBayId = myActive[0] ? String(myActive[0].slotId) : myParked[0] ? String(myParked[0].session.slotId) : null
  // Only a vehicle that checked in is drawn, so the colour and body the model may fall back on are those of the
  // customer's parked vehicle, never of a booked one (its bay may still hold someone else's car)
  const myParkedHere = myActive[0] ? undefined : myParked[0]
  const myVehicleColor = myParkedHere?.session.paintColor ?? null
  const myVehicleKind = myParkedHere && vehicleKind({ name: myParkedHere.session.vehicleTypeName ?? '' }) === 'suv' ? 'suv' : 'car'
  // The lot's real prices (the same rule the exit gate uses): motorbike floors show the motorbike price, car floors the 4-seat car price
  const prices = usePublicPrices(lot?.id)
  const price = prices.data?.find((p) => p.vehicleTypeCode === (selectedFloor?.kind === 'motorbike' ? 'MOTORBIKE' : 'CAR_4'))
  const isLoadingLots = liveBooking ? bookable.isPending : isLoading
  const underMaintenance = lot?.isBookable === false
  const lotFill =
    (lot && fillOfLot(lot.id)) ??
    fillLevel(
      floors.reduce((sum, f) => sum + f.liveTotal, 0),
      floors.reduce((sum, f) => sum + f.liveFree, 0),
    )
  // A motorbike claims its bay right now, so a full motorbike floor cannot take one more
  const floorFull = (floor: { liveTotal: number; liveFree: number }) => fillLevel(floor.liveTotal, floor.liveFree) === 'Full'

  const changeLot = (id: string) => {
    onLotChange(id)
    setSelectedId(null)
    setMyVehicleBayId(null)
    setFocusFloor(null)
  }

  const selectBay = (bay: Bay) => {
    setSelectedId(bay.id)
    setFocusFloor(bay.floorIndex)
    // Only the customer's own parked vehicle opens a details popup; other vehicles stay anonymous
    setMyVehicleBayId(myParkedByBay.has(bay.id) ? bay.id : null)
  }

  return (
    <section className="cx-card cx-map" id="map" aria-labelledby="map-title">
      <div className="cx-map__head">
        <div>
          <h2 className="cx-map__title" id="map-title">Interactive 3D Parking Map &amp; Slot Booking</h2>
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
              {l.isBookable === false
                ? ' • Maintenance'
                : FILL_LABEL[fillOfLot(l.id) ?? 'Available'] && ` • ${FILL_LABEL[fillOfLot(l.id) ?? 'Available']}`}
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

            <div style={{ position: 'relative' }}>
              <GarageView
                floors={floors}
                focusFloor={focusFloor}
                selectedBayId={selectedId}
                myBayId={myBayId}
                myVehicleColor={myVehicleColor}
                myVehicleKind={myVehicleKind}
                onSelectBay={selectBay}
                bayHint={(bay) => (myParkedByBay.has(bay.id) ? 'Your vehicle · click for details' : null)}
              />
              {myVehicleOpen && myVehicleBayId && (
                <MyVehicleCard
                  current={myVehicleOpen}
                  bayCode={allBays.find((b) => b.id === myVehicleBayId)?.code ?? myVehicleOpen.session.slotCode ?? ''}
                  onClose={() => setMyVehicleBayId(null)}
                />
              )}
            </div>

            <div className="cx-map__footer">
              <span><MapPin size={13} aria-hidden style={{ verticalAlign: '-2px' }} /> {lot.address}</span>
              {lot.address && (
                <button type="button" className="cx-btn cx-map__view-map" onClick={() => setShowDirections(true)}>
                  <Navigation size={14} aria-hidden /> View map
                </button>
              )}
              <span><Rotate3d size={13} aria-hidden style={{ verticalAlign: '-2px' }} /> Drag to rotate • scroll to zoom</span>
            </div>
          </div>

          <aside className="cx-map__detail" aria-live="polite">
            <div className="cx-card__head" style={{ marginBottom: 0 }}>
              <span className="cx-eyebrow cx-eyebrow--teal">
                <Info size={14} aria-hidden /> Selected slot
              </span>
              <span className="cx-chip cx-chip--teal">{lot.code}</span>
            </div>

            {underMaintenance && (
              <p className="cx-map__mine" role="status">
                <Wrench size={15} aria-hidden /> {lot.maintenanceNotice || DEFAULT_MAINTENANCE_NOTICE}
              </p>
            )}

            {!underMaintenance && lotFill === 'Full' && (
              <p className="cx-map__mine cx-map__full" role="status">
                <CircleAlert size={15} aria-hidden /> This lot is full right now. Pick your time: bays whose vehicle leaves
                before you arrive turn green, or pick another lot.
              </p>
            )}
            {!underMaintenance && lotFill === 'AlmostFull' && (
              <p className="cx-map__mine" role="status">
                <CircleAlert size={15} aria-hidden /> This lot is almost full: book soon to keep a bay.
              </p>
            )}

            {bookableBays && hasCarFloor && !underMaintenance && (
              <div className="cx-map__when">
                <span className="cx-label">
                  <CalendarClock size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> When will you park your car?
                </span>
                <BookingTimeFields value={times} onChange={setTimes} now={now} idPrefix={`map-${lot.id}`} />
                <p className="cx-field__hint" role="status">
                  {!checkedTimes.ok
                    ? checkedTimes.error
                    : forecastOn
                      ? `${describeWindow(checkedTimes.arrivalTime, checkedTimes.departureTime, now)}: ${projectedFree} car bays free. A bay whose vehicle leaves before you arrive shows as free.`
                      : 'Loading the bays for your time…'}
                </p>
              </div>
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
                    <strong className={selectedBookable ? 'is-gold' : undefined}>
                      {myBayIds.has(selected.id)
                        ? 'Your booking'
                        : myParkedByBay.has(selected.id)
                          ? 'Your vehicle is parked here'
                          : selected.penalty
                            ? selected.status === 'OCCUPIED' ? 'Penalty bay • towed vehicle' : 'Penalty bay'
                            : selectedForecast
                              ? forecastLabel(selectedForecast)
                              : STATUS_LABEL[selected.status]}
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
                ) : selectedBookable && !selected.penalty && bookableBays && !underMaintenance && !(selectedFloor.kind === 'motorbike' && floorFull(selectedFloor)) ? (
                  // Cars book ahead with a time and an optional deposit; motorbikes claim the bay now
                  selectedFloor.kind === 'car' ? (
                    <ReserveBayPanel
                      key={`${lot.id}-${selected.id}`}
                      lotKey={lot.id}
                      slotId={selected.id}
                      slotCode={selected.code}
                      times={times}
                    />
                  ) : (
                    <ParkMotorbikePanel key={`${lot.id}-${selected.id}`} lotKey={lot.id} slotId={selected.id} slotCode={selected.code} />
                  )
                ) : (
                  <button type="button" className="cx-btn cx-btn--light cx-btn--block" disabled>
                    <CircleCheck aria-hidden />
                    {myBayIds.has(selected.id)
                      ? 'Booked for you'
                      : selected.penalty
                        ? 'Penalty bay • only for towed vehicles'
                        : underMaintenance
                        ? 'Under maintenance • view only'
                        : !selectedBookable
                        ? selectedForecast ? 'Not available at your time • pick another time or bay' : 'Not available'
                        : selectedFloor.kind === 'motorbike' && floorFull(selectedFloor)
                        ? 'The motorbike floor is full • try again soon'
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
                const free = standardBays(f).filter((b) => b.status === 'AVAILABLE').length
                const percent = f.liveTotal ? ((f.liveTotal - f.liveFree) / f.liveTotal) * 100 : 0
                const fill = fillLevel(f.liveTotal, f.liveFree)
                return (
                  <button key={f.level} type="button" className="cx-map__floor" onClick={() => setFocusFloor(f.index)}>
                    <span className="cx-map__floor-name">
                      {f.level} • {f.kind === 'car' ? 'Cars' : 'Motorbikes'}
                      {FILL_LABEL[fill] && <strong className={fill === 'Full' ? 'cx-map__fill cx-map__fill--full' : 'cx-map__fill'}> • {FILL_LABEL[fill]}</strong>}
                    </span>
                    <span className="cx-map__floor-meta">{f.zoneLabel}</span>
                    <span className={`cx-meter ${fill === 'Full' ? 'cx-meter--full' : fill === 'AlmostFull' ? 'cx-meter--busy' : ''}`}>
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
      {showDirections && lot && (
        <LotDirectionsDialog
          lot={{
            name: lot.name,
            address: directionsLot?.address ?? lot.address ?? '',
            district: directionsLot?.district ?? null,
            city: directionsLot?.city ?? null,
            latitude: directionsLot?.latitude ?? null,
            longitude: directionsLot?.longitude ?? null,
          }}
          onClose={() => setShowDirections(false)}
        />
      )}
    </section>
  )
}
