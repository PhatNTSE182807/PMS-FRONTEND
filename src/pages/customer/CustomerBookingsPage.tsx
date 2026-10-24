import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarClock,
  Car,
  CircleX,
  Clock,
  CreditCard,
  FlaskConical,
  Headset,
  MapPin,
  ScanLine,
  Search,
  SlidersHorizontal,
  SquarePlus,
  Timer,
  Wallet,
  Zap,
} from 'lucide-react'
import { BookingTimeFields } from '@/components/customer/BookingTimeFields'
import { QrCode } from '@/components/ui/qr-code'
import { useNow } from '@/hooks/useNow'
import { usePaymentSimulation } from '@/hooks/usePaymentSimulation'
import { useCancelReservation, useMyReservations, usePayDeposit, useReservationQr, useSimulateDeposit, useUpdateReservation } from '@/hooks/useReservations'
import { checkBookingTimes, describeWindow, toLocalInput, type BookingTimes } from '@/lib/bookingTime'
import { formatNumber } from '@/lib/format'
import type { PaymentProvider, ReservationDTO, ReservationStatus } from '@/types/operations.dto'

type Filter = 'ALL' | 'CONFIRMED' | 'PENDING_DEPOSIT' | 'COMPLETED' | 'CANCELLED'

/** Which tab each SRS reservation state (4.3.3) belongs to. */
const GROUP: Record<ReservationStatus, Exclude<Filter, 'ALL'>> = {
  PendingDeposit: 'PENDING_DEPOSIT',
  Confirmed: 'CONFIRMED',
  CheckedIn: 'CONFIRMED',
  Completed: 'COMPLETED',
  Cancelled: 'CANCELLED',
  LotCancelled: 'CANCELLED',
  Expired: 'CANCELLED',
  NoShow: 'CANCELLED',
}

const STATUS_LABEL: Record<ReservationStatus, string> = {
  PendingDeposit: 'Pending deposit',
  Confirmed: 'Confirmed & guaranteed',
  CheckedIn: 'Checked in',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
  LotCancelled: 'Cancelled by the lot (100% refund)',
  Expired: 'Expired',
  NoShow: 'No-show',
}

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'CONFIRMED', label: 'Active & Confirmed' },
  { value: 'PENDING_DEPOSIT', label: 'Pending Deposit' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled / Expired' },
]

const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
const day = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const vnd = (value: number) => `${formatNumber(value)} VND`

function relativeDay(ts: number, now: number) {
  const startOf = (t: number) => new Date(t).setHours(0, 0, 0, 0)
  const diff = Math.round((startOf(ts) - startOf(now)) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return day.format(ts)
}

const countdown = (ms: number) => `${Math.floor(ms / 60_000)}m ${String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0')}s`

/** The booking's current times as form values (a pay-as-you-go booking proposes a two-hour window if switched). */
function timesOf(booking: ReservationDTO): BookingTimes {
  const arrival = Date.parse(booking.arrivalTime)
  return {
    mode: booking.bookingMode ?? 'PayAsYouGo',
    arrival: toLocalInput(arrival),
    departure: toLocalInput(booking.departureTime ? Date.parse(booking.departureTime) : arrival + 2 * 3_600_000),
  }
}

function FeaturedBooking({ booking, now }: { booking: ReservationDTO; now: number }) {
  const qr = useReservationQr(booking)
  const cancel = useCancelReservation()
  const update = useUpdateReservation()
  const [editing, setEditing] = useState(false)
  const [times, setTimes] = useState<BookingTimes>(() => timesOf(booking))
  const [timeError, setTimeError] = useState('')
  const windowOpen = now >= Date.parse(booking.checkInFrom)
  const msLeft = Math.max(0, Date.parse(windowOpen ? booking.checkInUntil : booking.checkInFrom) - now)

  const confirmCancel = () => {
    const refund = booking.refundIfCancelledNow
    const message = refund > 0 ? `Cancel this reservation and refund ${vnd(refund)}?` : 'It is less than 30 minutes before arrival, so the deposit is not refunded. Cancel anyway?'
    if (window.confirm(message)) cancel.mutate({ id: booking.id })
  }

  return (
    <section className="cx-card cx-booking" aria-labelledby="featured-title">
      <div className="cx-booking__main">
        <div className="cx-booking__chips">
          <span className="cx-chip cx-chip--gold"><span className="cx-dot cx-dot--gold" aria-hidden="true" /> {STATUS_LABEL[booking.status]}</span>
          {booking.status === 'Confirmed' && (
            <span className="cx-chip cx-chip--teal">
              <Clock aria-hidden /> {windowOpen ? `Check-in window closes in ${countdown(msLeft)}` : `Check-in opens in ${countdown(msLeft)}`}
            </span>
          )}
          <span className="cx-chip cx-chip--muted cx-mono">#{booking.code}</span>
        </div>
        <h2 className="cx-booking__title" id="featured-title">{booking.parkingLotName}</h2>
        <p className="cx-booking__addr">
          <MapPin aria-hidden /> {booking.zoneName ?? 'Car deck'}
        </p>

        <div className="cx-tiles">
          <div className="cx-tile">
            <span className="cx-label">Bay assigned</span>
            <strong className="cx-tile__value is-gold">{booking.slotCode}</strong>
            <span className="cx-tile__sub">Reserved bay</span>
          </div>
          <div className="cx-tile">
            <span className="cx-label">Vehicle</span>
            <strong className="cx-tile__value cx-mono">{booking.plateNumber ?? '—'}</strong>
            <span className="cx-tile__sub">QR or verified plate at the gate</span>
          </div>
          <div className="cx-tile">
            <span className="cx-label">Arrival time</span>
            <strong className="cx-tile__value is-teal">{time.format(Date.parse(booking.arrivalTime))}</strong>
            <span className="cx-tile__sub">
              {describeWindow(booking.arrivalTime, booking.departureTime, now)}
              {booking.bookingMode === 'PayAsYouGo' ? ' (pay as you go)' : ''}
            </span>
          </div>
          {/* Without a deposit there is nothing to deduct, but the bay is held for a shorter time */}
          <div className="cx-tile">
            <span className="cx-label">{booking.hasDeposit ? 'Deposit paid' : 'Deposit'}</span>
            <strong className="cx-tile__value">{booking.hasDeposit ? vnd(booking.depositAmount) : 'No deposit'}</strong>
            <span className="cx-tile__sub" style={{ color: 'var(--cx-gold)' }}>
              {booking.hasDeposit ? 'Deductible at exit' : 'Nothing to pay now'} • bay held {booking.holdMinutes} min after arrival
            </span>
          </div>
        </div>

        {editing ? (
          <form
            className="cx-booking__edit"
            onSubmit={(e) => {
              e.preventDefault()
              const checked = checkBookingTimes(times, Date.now())
              if (!checked.ok) return setTimeError(checked.error)
              setTimeError('')
              update.mutate(
                { id: booking.id, request: { arrivalTime: checked.arrivalTime, bookingMode: times.mode, departureTime: checked.departureTime } },
                { onSuccess: () => setEditing(false) },
              )
            }}
          >
            <BookingTimeFields value={times} onChange={setTimes} now={now} idPrefix={`edit-${booking.id}`} disabled={update.isPending} holdMinutes={booking.holdMinutes} />
            {timeError && <p className="cx-error" role="alert">{timeError}</p>}
            <div className="cx-booking__actions">
              <button type="submit" className="cx-btn cx-btn--teal" disabled={update.isPending}>Save</button>
              <button type="button" className="cx-btn" onClick={() => setEditing(false)}>Keep</button>
            </div>
          </form>
        ) : (
          <div className="cx-booking__actions">
            <Link to="/me#map" className="cx-btn cx-btn--teal">
              <Car aria-hidden /> View on the 3D map
            </Link>
            <button
              type="button"
              className="cx-btn"
              disabled={!booking.canChange}
              onClick={() => {
                setTimes(timesOf(booking))
                setEditing(true)
              }}
            >
              <SlidersHorizontal aria-hidden /> Change date &amp; time
            </button>
            <button type="button" className="cx-btn cx-btn--danger cx-booking__cancel" disabled={!booking.canCancel || cancel.isPending} onClick={confirmCancel}>
              <CircleX aria-hidden /> Cancel reservation
            </button>
          </div>
        )}
        <p className="cx-booking__note">
          {booking.hasDeposit
            ? `* Full deposit refund when cancelled at least 30 minutes before arrival; none after that. Not checked in by ${time.format(Date.parse(booking.checkInUntil))}: the booking becomes a no-show and the deposit is kept.`
            : `* Booked without a deposit: cancel any time for free. Not checked in by ${time.format(Date.parse(booking.checkInUntil))}: the bay is released for other drivers.`}
        </p>
      </div>

      <aside className="cx-pass" aria-label="Check-in QR">
        <div className="cx-pass__head">
          <span className="cx-eyebrow"><ScanLine size={14} aria-hidden /> Check-in pass</span>
          <span className="cx-label">Signed QR</span>
        </div>
        <div className="cx-pass__frame">
          {qr.data ? (
            <QrCode value={qr.data.qrPayload} label={`Reservation QR ${booking.code}`} className="cx-pass__qr" />
          ) : (
            <div className="cx-skeleton" style={{ width: '13rem', aspectRatio: '1' }} />
          )}
        </div>
        <span className="cx-label" style={{ textAlign: 'center' }}>Reservation code</span>
        <span className="cx-pass__token cx-mono">{booking.code}</span>
        <p className="cx-pass__hint">Hold this code under the entry lane scanner during the check-in window, or arrive in a verified vehicle to check in by plate.</p>
      </aside>
    </section>
  )
}

function PendingDeposit({ booking, now }: { booking: ReservationDTO; now: number }) {
  const pay = usePayDeposit()
  // Development / testing only: confirm the deposit without the VNPay / MoMo pages
  const canSimulate = usePaymentSimulation()
  const simulate = useSimulateDeposit()
  const cancel = useCancelReservation()
  const left = Math.max(0, Date.parse(booking.depositDueAt ?? booking.createdAt) - now)
  const payWith = (provider: PaymentProvider) => pay.mutate({ id: booking.id, provider })

  return (
    <article className="cx-card cx-upcoming">
      <span className="cx-upcoming__icon"><Car aria-hidden /></span>
      <div className="cx-upcoming__text">
        <p className="cx-upcoming__title">
          {booking.parkingLotName} <span className="cx-chip cx-chip--gold">Pending deposit</span>
          <span className="cx-mono cx-label">#{booking.code}</span>
        </p>
        <p className="cx-upcoming__meta">
          <MapPin aria-hidden /> <strong>Bay {booking.slotCode}</strong> • <span className="cx-mono">{booking.plateNumber ?? '—'}</span>
        </p>
        <p className="cx-upcoming__when">
          {relativeDay(Date.parse(booking.arrivalTime), now)}, {time.format(Date.parse(booking.arrivalTime))}
        </p>
      </div>
      <div className="cx-upcoming__deposit">
        <span className="cx-label">Deposit amount</span>
        <strong>{vnd(booking.depositAmount)}</strong>
        <span className="cx-upcoming__due"><Timer aria-hidden /> {left > 0 ? `Pay within ${countdown(left)}` : 'Expired'}</span>
      </div>
      <div className="cx-reserve__pay" style={{ minWidth: '16rem' }}>
        <button type="button" className="cx-btn cx-btn--wallet" disabled={pay.isPending || left === 0} onClick={() => payWith('Wallet')}>
          <CreditCard aria-hidden /> Pay with XXIV Wallet
        </button>
        <button type="button" className="cx-btn cx-btn--gold" disabled={pay.isPending || left === 0} onClick={() => payWith('VNPay')}>
          <Wallet aria-hidden /> VNPay
        </button>
        <button type="button" className="cx-btn cx-btn--momo" disabled={pay.isPending || left === 0} onClick={() => payWith('MoMo')}>
          <Wallet aria-hidden /> MoMo
        </button>
        {canSimulate && (
          <button type="button" className="cx-btn cx-btn--simulate" disabled={simulate.isPending || left === 0} onClick={() => simulate.mutate(booking.id)}>
            <FlaskConical aria-hidden /> {simulate.isPending ? 'Simulating…' : 'Simulate successful payment'}
          </button>
        )}
        <button type="button" className="cx-link" style={{ width: '100%', textAlign: 'center' }} disabled={cancel.isPending} onClick={() => cancel.mutate({ id: booking.id, reason: 'Given up before paying' })}>
          Give up this booking
        </button>
      </div>
    </article>
  )
}

/** /me/bookings: the customer's reservations, deposit payments and history (SRS FR-RSV-02..05). */
export default function CustomerBookingsPage() {
  const now = useNow(1000)
  const reservations = useMyReservations()
  const [filter, setFilter] = useState<Filter>('ALL')
  const [query, setQuery] = useState('')

  const all = reservations.data ?? []
  const matches = (b: ReservationDTO) => {
    const q = query.trim().toLowerCase()
    return (
      (filter === 'ALL' || GROUP[b.status] === filter) &&
      (!q || b.code.toLowerCase().includes(q) || (b.plateNumber ?? '').toLowerCase().includes(q) || (b.parkingLotName ?? '').toLowerCase().includes(q))
    )
  }

  const visible = all.filter(matches)
  const featured = visible.filter((b) => b.status === 'Confirmed' || b.status === 'CheckedIn')
  const upcoming = visible.filter((b) => b.status === 'PendingDeposit')
  const history = visible.filter((b) => GROUP[b.status] === 'COMPLETED' || GROUP[b.status] === 'CANCELLED')
  const count = (f: Filter) => (f === 'ALL' ? all.length : all.filter((b) => GROUP[b.status] === f).length)

  return (
    <>
      <header className="cx-page-head">
        <div>
          <span className="cx-eyebrow"><span className="cx-dot cx-dot--gold" aria-hidden="true" /> Slot reservations • Deposits via XXIV Wallet / VNPay / MoMo</span>
          <h1 className="cx-page-title">My Bookings &amp; Reservations</h1>
          <p className="cx-page-lead">Track reservations, pay deposits, show your check-in QR and review your history. Up to 2 active reservations per account.</p>
        </div>
        <Link to="/me#map" className="cx-btn cx-btn--teal" style={{ padding: '0.9rem 1.4rem' }}>
          <SquarePlus aria-hidden /> New reservation
        </Link>
      </header>

      <div className="cx-card cx-filterbar">
        <div className="cx-filterbar__tabs" role="tablist" aria-label="Filter bookings">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              className={`cx-tab ${filter === f.value ? 'cx-tab--active' : ''}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label} <span className="cx-count">{count(f.value)}</span>
            </button>
          ))}
        </div>
        <label className="cx-filterbar__search">
          <Search aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by plate or code..." aria-label="Search bookings" />
        </label>
      </div>

      {reservations.isPending && <div className="cx-skeleton" style={{ height: '18rem' }} />}
      {reservations.isError && <p className="cx-empty">Could not load your reservations. Try again later.</p>}
      {!reservations.isPending && all.length === 0 && (
        <p className="cx-empty">
          No reservations yet. <Link to="/me#map" className="cx-link">Pick a bay on the 3D map</Link> to start.
        </p>
      )}

      {featured.map((b) => (
        <FeaturedBooking key={b.id} booking={b} now={now} />
      ))}

      {upcoming.length > 0 && (
        <section className="cx-section" aria-labelledby="upcoming-title">
          <div className="cx-section__head">
            <h2 className="cx-section__title" id="upcoming-title">
              <CalendarClock aria-hidden /> Waiting for the deposit
            </h2>
            <span className="cx-label cx-mono">{upcoming.length} action required</span>
          </div>
          {upcoming.map((b) => (
            <PendingDeposit key={b.id} booking={b} now={now} />
          ))}
        </section>
      )}

      {history.length > 0 && (
        <section className="cx-section" id="history" aria-labelledby="history-title">
          <div className="cx-section__head">
            <div>
              <h2 className="cx-section__title" id="history-title">Booking History</h2>
              <p className="cx-card__subtitle">Completed, cancelled, expired and no-show bookings with their refunds.</p>
            </div>
          </div>

          <div className="cx-card" style={{ padding: 0 }}>
            <div className="cx-table-wrap">
              <table className="cx-table">
                <thead>
                  <tr>
                    <th scope="col">Booking</th>
                    <th scope="col">Facility</th>
                    <th scope="col">Vehicle</th>
                    <th scope="col">Bay</th>
                    <th scope="col">Arrival</th>
                    <th scope="col">Deposit / refund</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((b) => {
                    const ended = GROUP[b.status] === 'CANCELLED'
                    return (
                      <tr key={b.id}>
                        <td className="cx-mono" style={{ color: ended ? 'var(--cx-muted)' : 'var(--cx-primary)', fontWeight: 700 }}>#{b.code}</td>
                        <td>
                          <strong>{b.parkingLotName}</strong>
                          <span className="cx-table__sub">{b.zoneName}</span>
                        </td>
                        <td><strong className="cx-mono">{b.plateNumber ?? '—'}</strong></td>
                        <td><span className="cx-plate" style={{ fontSize: '0.75rem' }}>Bay {b.slotCode}</span></td>
                        <td>
                          {relativeDay(Date.parse(b.arrivalTime), now)}
                          <span className="cx-table__sub">{time.format(Date.parse(b.arrivalTime))}</span>
                        </td>
                        <td>
                          <strong className="cx-table__num">{b.hasDeposit ? vnd(b.depositAmount) : 'No deposit'}</strong>
                          <span className="cx-table__sub">
                            {!b.hasDeposit ? `Held ${b.holdMinutes} min` : b.refundAmount > 0 ? `Refunded ${vnd(b.refundAmount)}` : b.status === 'Completed' ? 'Deducted from the fee' : 'Not refunded'}
                          </span>
                        </td>
                        <td>
                          <span className={`cx-chip ${ended ? 'cx-chip--muted' : ''}`} title={b.cancelReason ?? undefined}>{STATUS_LABEL[b.status]}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <div className="cx-info-cards">
        {[
          { icon: ScanLine, title: 'QR or plate check-in', text: 'Scan the signed QR at the entry lane, or arrive in a vehicle whose papers are verified.' },
          { icon: Zap, title: 'Deposits are deducted', text: 'The deposit is taken off your parking fee at the exit; any remainder is refunded automatically.' },
          { icon: Headset, title: 'Lot cancellations refund 100%', text: 'If the lot closes or the bay needs maintenance, the lot cancels the booking and returns the whole deposit.' },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="cx-card cx-info-card">
            <span className="cx-card__icon cx-card__icon--gold"><Icon aria-hidden /></span>
            <div>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
