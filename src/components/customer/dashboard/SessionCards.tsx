import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { CalendarClock, CircleCheck, Clock, CreditCard, Hourglass, LogIn, LogOut, Navigation, QrCode as QrIcon, ScanLine, ShieldAlert, ShieldCheck, Wallet, X } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { BookingTimeFields } from '@/components/customer/BookingTimeFields'
import { QrCode } from '@/components/ui/qr-code'
import { useCancelGateRequest, useMyGateRequests, useRequestCheckIn, useRequestCheckOut } from '@/hooks/useGateRequests'
import { useCurrentSessions, usePrepaySession } from '@/hooks/useParkingSessions'
import { useCancelReservation, usePayDeposit, useUpcomingReservation, useUpdateReservation } from '@/hooks/useReservations'
import { useNow } from '@/hooks/useNow'
import { checkBookingTimes, describeWindow, relativeDay, toLocalInput, type BookingTimes } from '@/lib/bookingTime'
import { formatNumber } from '@/lib/format'
import type { GateRequestDTO } from '@/types/gateRequest.dto'
import type { CurrentSessionDTO, ExitPassDTO, PaymentProvider, ReservationDTO } from '@/types/operations.dto'

const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
const vnd = (amount: number) => `${formatNumber(amount)} VND`

/** Google Maps directions to the lot (the bay is shown on the 3D model once inside). */
const directionsUrl = (address: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`

/** "20,000 / started hour", "5,000 / 4 h block". */
function tariffText(session: CurrentSessionDTO) {
  const { blockMinutes, blockPrice } = session.tariff
  if (!blockPrice) return 'Free'
  const block = blockMinutes === 60 ? 'started hour' : blockMinutes % 60 === 0 ? `${blockMinutes / 60} h block` : `${blockMinutes} min block`
  return `${formatNumber(blockPrice)} / ${block}`
}

/** The QR the exit lane scans. Every parked vehicle has one; it also says whether anything is left to pay. */
function ExitPassDialog({ pass, plate, onClose }: { pass: ExitPassDTO; plate: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="cx-pass-backdrop" role="presentation" onClick={onClose}>
      <div className="cx-pass" role="dialog" aria-modal="true" aria-labelledby="exit-pass-title" onClick={(e) => e.stopPropagation()}>
        <div className="cx-card__head" style={{ marginBottom: 0 }}>
          <h2 className="cx-card__title" id="exit-pass-title">Exit gate pass</h2>
          <button type="button" className="cx-icon-btn" aria-label="Close" onClick={onClose}>
            <X aria-hidden />
          </button>
        </div>
        <QrCode value={pass.token} label={`Exit pass ${pass.sessionCode}`} className="cx-pass__qr" />
        <p className="cx-mono">{plate} • {pass.sessionCode}</p>
        <p className="cx-pass__status">
          {pass.prepaid
            ? `Paid. Show this at the exit lane before ${pass.validUntil ? timeFormat.format(Date.parse(pass.validUntil)) : 'your exit window ends'}.`
            : pass.amountDue > 0
              ? `Show this at the exit lane. ${vnd(pass.amountDue)} so far is paid there, or prepay now to drive straight out.`
              : 'Nothing to pay so far. Show this at the exit lane.'}
        </p>
        <button type="button" className="cx-btn cx-btn--block" onClick={onClose}>Done</button>
      </div>
    </div>
  )
}

/** A refusal stays on the card this long, so the customer can read Staff's reason. */
const REFUSAL_VISIBLE_MS = 30 * 60_000

/**
 * The latest request for this booking or parked vehicle, while it matters: waiting at the lane, or
 * refused recently (with Staff's reason). Completed requests show through the cards themselves.
 */
function useLatestRequest(match: (r: GateRequestDTO) => boolean, now: number) {
  const { data: requests = [] } = useMyGateRequests()
  const latest = requests.find(match)
  if (!latest) return null
  if (latest.status === 'Waiting') return latest
  if (latest.status === 'Refused' && latest.handledAt && now - Date.parse(latest.handledAt) < REFUSAL_VISIBLE_MS) return latest
  return null
}

/** "Waiting for Staff at the entry lane…" with Cancel, or Staff's refusal. */
function GateRequestNotice({ request }: { request: GateRequestDTO }) {
  const cancel = useCancelGateRequest()
  const lane = request.kind === 'CheckIn' ? 'entry' : 'exit'
  // The API's "problem" is written for the Staff; an unpaid exit gets the customer's own wording
  const hint =
    request.kind === 'CheckOut' && request.sessionStatus && request.sessionStatus !== 'Paid'
      ? 'Not paid yet: prepay above, or pay the Staff at the exit lane.'
      : request.problem
  if (request.status === 'Refused') {
    return (
      <p className="cx-gate-request cx-gate-request--refused" role="status">
        <ShieldAlert aria-hidden />
        <span>
          Staff did not open the {lane} barrier{request.note ? `: ${request.note}` : '.'}
        </span>
      </p>
    )
  }
  return (
    <p className="cx-gate-request" role="status" aria-live="polite">
      <Hourglass aria-hidden />
      <span>
        Waiting for Staff at the {lane} lane to check your vehicle and open the barrier
        {hint ? `. ${hint}` : '…'}
      </span>
      <button
        type="button"
        className="cx-link"
        disabled={cancel.isPending}
        onClick={() => cancel.mutate(request.id, { onError: (e) => toast.error(getErrorMessage(e, 'Could not cancel the request.')) })}
      >
        Cancel
      </button>
    </p>
  )
}

/** The car parked right now (GET /parking-sessions/current): running fee, prepay with VNPay or MoMo, exit pass. */
export function ActiveSessionCard() {
  const now = useNow(30_000)
  const { data: sessions = [], isPending } = useCurrentSessions()
  const prepay = usePrepaySession()
  const checkOut = useRequestCheckOut()
  const [choosing, setChoosing] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const current = sessions[0]
  const exitRequest = useLatestRequest((r) => r.kind === 'CheckOut' && r.sessionId === current?.session.id, now)

  if (isPending) return <article className="cx-card cx-card--accent-gold"><div className="cx-skeleton" style={{ height: '18rem' }} /></article>

  if (!current) {
    return (
      <article className="cx-card cx-card--accent-gold" id="session">
        <span className="cx-eyebrow">
          <span className="cx-dot" aria-hidden="true" /> Active session
        </span>
        <div className="cx-empty-card">
          <h2 className="cx-session__name" style={{ margin: 0 }}>No vehicle parked right now</h2>
          <p>Your running fee, prepayment and exit gate pass appear here as soon as you check in at a lot.</p>
          <a href="#map" className="cx-btn cx-btn--teal">
            <CalendarClock aria-hidden /> Book a bay
          </a>
        </div>
      </article>
    )
  }

  const s = current.session
  const entry = Date.parse(s.entryTime)
  // The meter ticks locally between refreshes; the fee comes from the API
  const minutes = Math.max(current.elapsedMinutes, Math.floor((now - entry) / 60_000))
  const pass = current.exitPass
  const address = [current.lotAddress, current.lotDistrict].filter(Boolean).join(', ')
  const pay = (provider: PaymentProvider) => prepay.mutate({ sessionId: s.id, provider })
  const askCheckOut = () =>
    checkOut.mutate(s.id, {
      onSuccess: () => toast.success('Check-out requested', { description: 'Drive to the exit lane: Staff will check your vehicle and open the barrier.' }),
      onError: (e) => toast.error(getErrorMessage(e, 'Could not request the check-out.')),
    })

  return (
    <article className="cx-card cx-card--accent-gold" id="session">
      <div className="cx-session__head">
        <div className="cx-session__lot">
          <span className="cx-session__p" aria-hidden="true">P</span>
          <div>
            <span className="cx-eyebrow">
              <span className="cx-dot cx-dot--live" aria-hidden="true" /> Live active dwell
              {sessions.length > 1 && <span style={{ color: 'var(--cx-on-variant)' }}>• {sessions.length} vehicles parked</span>}
            </span>
            <h2 className="cx-session__name">{current.lotName ?? 'Parking lot'}</h2>
            <p className="cx-session__addr">{address || '—'}</p>
          </div>
        </div>
        <div className="cx-session__slot">
          <span className="cx-label">Slot assign</span>
          <span className="cx-session__slot-value">{s.slotCode ? `Bay ${s.slotCode}` : (s.zoneName ?? '—')}</span>
        </div>
      </div>

      <div className="cx-metrics">
        <div>
          <span className="cx-label">Vehicle</span>
          <span className="cx-metric__value">{current.vehicleLabel || s.vehicleTypeName || 'Vehicle'}</span>
          <span className="cx-metric__sub cx-mono">{s.plateNumber}</span>
        </div>
        <div>
          <span className="cx-label">Entry time</span>
          <span className="cx-metric__value">{timeFormat.format(entry)}</span>
          <span className="cx-metric__sub">{relativeDay(entry, now)}</span>
        </div>
        <div>
          <span className="cx-label">Elapsed duration</span>
          <span className="cx-metric__value" style={{ color: 'var(--cx-gold)' }}>
            {Math.floor(minutes / 60)}h {minutes % 60}m
          </span>
          <span className="cx-metric__sub">
            {current.plannedDeparture ? `Planned until ${timeFormat.format(Date.parse(current.plannedDeparture))}` : 'Real-time meter'}
          </span>
        </div>
        <div>
          <span className="cx-label">Accrued total</span>
          <span className="cx-metric__big">{formatNumber(current.feeSoFar)}</span>
          <span className="cx-metric__sub">VND ({tariffText(current)})</span>
        </div>
      </div>

      <div className="cx-session__plate-row">
        <div className="cx-card__title-row">
          <span className="cx-plate">{s.plateNumber}</span>
          <div>
            <strong style={{ fontSize: '0.875rem' }}>
              {current.entryMethod === 'Reservation' ? 'Checked in with your booking' : current.entryMethod === 'Manual' ? 'Entry recorded by Staff' : 'Automatic license plate capture'}
            </strong>
            <span className="cx-metric__sub" style={{ color: '#6fdba8' }}>
              <CircleCheck size={13} aria-hidden style={{ verticalAlign: '-2px' }} /> Verified at {current.entryGateName ?? 'the entry lane'}
            </span>
          </div>
        </div>
        {address && (
          <a className="cx-btn" href={directionsUrl(`${current.lotName ?? ''} ${address}`)} target="_blank" rel="noopener noreferrer">
            <Navigation aria-hidden /> Directions to lot
          </a>
        )}
      </div>

      {pass.prepaid ? (
        <p className="cx-prepay">
          <span><ShieldCheck size={15} aria-hidden style={{ verticalAlign: '-3px', color: '#6fdba8' }} /> Paid. Drive out before {pass.validUntil ? timeFormat.format(Date.parse(pass.validUntil)) : 'the exit window ends'}.</span>
        </p>
      ) : choosing ? (
        <div className="cx-prepay" aria-live="polite">
          <span>
            Pay <strong>{vnd(current.amountDue)}</strong> now
            {current.depositApplied > 0 ? ` (after your ${vnd(current.depositApplied)} deposit)` : ''}; you then have 15 minutes to leave.
          </span>
          {current.pendingPayment?.payUrl && (
            <a className="cx-link" href={current.pendingPayment.payUrl}>Continue the {current.pendingPayment.provider} payment you started</a>
          )}
          <div className="cx-prepay__row">
            <button type="button" className="cx-btn cx-btn--wallet" disabled={prepay.isPending || current.amountDue <= 0} onClick={() => pay('Wallet')}>
              <CreditCard aria-hidden /> Pay with XXIV Wallet
            </button>
            <button type="button" className="cx-btn cx-btn--gold" disabled={prepay.isPending || current.amountDue <= 0} onClick={() => pay('VNPay')}>
              <Wallet aria-hidden /> VNPay
            </button>
            <button type="button" className="cx-btn cx-btn--momo" disabled={prepay.isPending || current.amountDue <= 0} onClick={() => pay('MoMo')}>
              <Wallet aria-hidden /> MoMo
            </button>
            <button type="button" className="cx-btn" onClick={() => setChoosing(false)}>Not now</button>
          </div>
        </div>
      ) : null}

      <div className="cx-session__actions">
        {!pass.prepaid && (
          <button type="button" className="cx-btn cx-btn--teal" disabled={current.amountDue <= 0} onClick={() => setChoosing(true)}>
            <ScanLine aria-hidden /> {current.amountDue > 0 ? 'Prepay parking fee' : 'Nothing to pay yet'}
          </button>
        )}
        <button type="button" className="cx-btn cx-btn--gold" onClick={() => setShowPass(true)}>
          <QrIcon aria-hidden /> View exit gate pass
        </button>
        <button
          type="button"
          className="cx-btn cx-btn--teal"
          disabled={checkOut.isPending || exitRequest?.status === 'Waiting'}
          title={pass.prepaid || current.amountDue <= 0 ? undefined : 'Prepay first, or pay the Staff at the exit lane'}
          onClick={askCheckOut}
        >
          <LogOut aria-hidden /> {exitRequest?.status === 'Waiting' ? 'Check-out requested' : 'Check out'}
        </button>
      </div>

      {exitRequest && <GateRequestNotice request={exitRequest} />}

      {showPass && <ExitPassDialog pass={pass} plate={s.plateNumber} onClose={() => setShowPass(false)} />}
    </article>
  )
}

/** The booking's times as form values (a pay-as-you-go booking proposes a two-hour window if switched). */
function timesOf(booking: ReservationDTO): BookingTimes {
  const arrival = Date.parse(booking.arrivalTime)
  return {
    mode: booking.bookingMode ?? 'PayAsYouGo',
    arrival: toLocalInput(arrival),
    departure: toLocalInput(booking.departureTime ? Date.parse(booking.departureTime) : arrival + 2 * 3_600_000),
  }
}

/** The next booking (GET /reservations/upcoming): window, bay and vehicle, with change and cancel. */
export function ReservationCard() {
  const now = useNow(30_000)
  const { data: booking, isPending } = useUpcomingReservation()
  const update = useUpdateReservation()
  const cancel = useCancelReservation()
  const payDeposit = usePayDeposit()
  const checkIn = useRequestCheckIn()
  const entryRequest = useLatestRequest((r) => r.kind === 'CheckIn' && r.reservationId === booking?.id, now)
  const [editing, setEditing] = useState(false)
  const [times, setTimes] = useState<BookingTimes | null>(null)
  const [error, setError] = useState('')

  if (isPending) return <article className="cx-card"><div className="cx-skeleton" style={{ height: '18rem' }} /></article>

  if (!booking) {
    return (
      <article className="cx-card" style={{ display: 'flex', flexDirection: 'column' }}>
        <span className="cx-eyebrow">
          <CalendarClock size={14} aria-hidden /> Scheduled reservation
        </span>
        <div className="cx-empty-card">
          <h2 className="cx-session__name" style={{ margin: 0 }}>No upcoming booking</h2>
          <p>Pick a bay on the 3D map, then choose a scheduled window or pay as you go.</p>
          <a href="#map" className="cx-btn cx-btn--teal">
            <CalendarClock aria-hidden /> Book a bay
          </a>
        </div>
      </article>
    )
  }

  const pending = booking.status === 'PendingDeposit'
  const depositDue = booking.depositDueAt ? Date.parse(booking.depositDueAt) : null
  const location = [booking.parkingLotAddress, booking.parkingLotDistrict].filter(Boolean).join(', ')
  // The entry lane accepts the booking from 15 minutes before arrival until the hold ends
  const windowOpen = booking.status === 'Confirmed' && now >= Date.parse(booking.checkInFrom) && now <= Date.parse(booking.checkInUntil)
  const askCheckIn = () =>
    checkIn.mutate(booking.id, {
      onSuccess: () => toast.success('Check-in requested', { description: 'Drive to the entry lane: Staff will check your vehicle and open the barrier.' }),
      onError: (e) => toast.error(getErrorMessage(e, 'Could not request the check-in.')),
    })

  const save = () => {
    if (!times) return
    const checked = checkBookingTimes(times, Date.now())
    if (!checked.ok) return setError(checked.error)
    setError('')
    update.mutate(
      { id: booking.id, request: { arrivalTime: checked.arrivalTime, bookingMode: times.mode, departureTime: checked.departureTime } },
      { onSuccess: () => setEditing(false) },
    )
  }

  const confirmCancel = () => {
    const message = pending
      ? 'Cancel this booking? No deposit has been paid yet.'
      : booking.refundIfCancelledNow > 0
        ? `Cancel this booking and refund ${vnd(booking.refundIfCancelledNow)}?`
        : 'It is less than 30 minutes before arrival, so the deposit is not refunded. Cancel anyway?'
    if (window.confirm(message)) cancel.mutate({ id: booking.id })
  }

  return (
    <article className="cx-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="cx-card__head" style={{ marginBottom: '1rem' }}>
        <span className="cx-eyebrow">
          <CalendarClock size={14} aria-hidden /> Scheduled reservation
        </span>
        {pending ? (
          <span className="cx-chip cx-chip--gold">Deposit due {depositDue ? timeFormat.format(depositDue) : ''}</span>
        ) : (
          <span className="cx-chip cx-chip--teal">Guaranteed slot</span>
        )}
      </div>
      <h2 className="cx-session__name" style={{ marginTop: 0 }}>{booking.parkingLotName ?? 'Parking lot'}</h2>
      <p className="cx-session__addr" style={{ marginBottom: '1.25rem' }}>{location || `Booking #${booking.code}`}</p>

      {editing && times ? (
        <div className="cx-booking__edit" style={{ marginTop: 0 }}>
          <BookingTimeFields value={times} onChange={setTimes} now={now} idPrefix={`card-${booking.id}`} disabled={update.isPending} />
          {error && <p className="cx-error" role="alert">{error}</p>}
        </div>
      ) : (
        <div className="cx-kv">
          <div className="cx-kv__row">
            {booking.bookingMode === 'Scheduled' ? 'Scheduled window' : 'Arrival (pay as you go)'}{' '}
            <strong>{describeWindow(booking.arrivalTime, booking.departureTime, now)}</strong>
          </div>
          <div className="cx-kv__row">
            Allocated stall area <strong className="is-gold">{[booking.zoneName, booking.slotCode && `Bay ${booking.slotCode}`].filter(Boolean).join(' • ') || '—'}</strong>
          </div>
          <div className="cx-kv__row">
            Designated vehicle <strong>{booking.vehicleLabel ? `${booking.vehicleLabel} (${booking.plateNumber ?? '—'})` : (booking.plateNumber ?? '—')}</strong>
          </div>
        </div>
      )}

      {!editing && (
        <p className="cx-footnote">
          <Clock aria-hidden /> Check-in {timeFormat.format(Date.parse(booking.checkInFrom))} - {timeFormat.format(Date.parse(booking.checkInUntil))}
          {' • '}
          {booking.bookingMode === 'Scheduled' ? 'you pay for the time you actually park' : 'leave anytime, you pay for the time you park'}
        </p>
      )}

      <div className="cx-actions" style={{ marginTop: 'auto', paddingTop: '1.5rem', justifyContent: 'stretch' }}>
        {editing ? (
          <>
            <button type="button" className="cx-btn cx-btn--teal" style={{ flex: 1 }} disabled={update.isPending} onClick={save}>
              {update.isPending ? 'Saving…' : 'Save new window'}
            </button>
            <button type="button" className="cx-btn" onClick={() => setEditing(false)}>Keep</button>
          </>
        ) : pending ? (
          <>
            <button type="button" className="cx-btn cx-btn--wallet" style={{ flex: 1 }} disabled={payDeposit.isPending} onClick={() => payDeposit.mutate({ id: booking.id, provider: 'Wallet' })}>
              <CreditCard aria-hidden /> Pay with XXIV Wallet
            </button>
            <button type="button" className="cx-btn cx-btn--gold" disabled={payDeposit.isPending} onClick={() => payDeposit.mutate({ id: booking.id, provider: 'VNPay' })}>
              <Wallet aria-hidden /> VNPay
            </button>
            <button type="button" className="cx-btn cx-btn--momo" disabled={payDeposit.isPending} onClick={() => payDeposit.mutate({ id: booking.id, provider: 'MoMo' })}>
              <Wallet aria-hidden /> MoMo
            </button>
            <button type="button" className="cx-btn cx-btn--danger" disabled={cancel.isPending} onClick={confirmCancel}>Cancel</button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="cx-btn cx-btn--gold"
              style={{ flex: 1 }}
              disabled={!windowOpen || checkIn.isPending || entryRequest?.status === 'Waiting'}
              title={windowOpen ? undefined : `Check-in opens at ${timeFormat.format(Date.parse(booking.checkInFrom))}`}
              onClick={askCheckIn}
            >
              <LogIn aria-hidden /> {entryRequest?.status === 'Waiting' ? 'Check-in requested' : 'Check in'}
            </button>
            <button
              type="button"
              className="cx-btn"
              disabled={!booking.canChange}
              title={booking.canChange ? undefined : 'Changes close 30 minutes before arrival'}
              onClick={() => {
                setTimes(timesOf(booking))
                setError('')
                setEditing(true)
              }}
            >
              Modify window
            </button>
            <button type="button" className="cx-btn cx-btn--danger" disabled={!booking.canCancel || cancel.isPending} onClick={confirmCancel}>
              Cancel
            </button>
          </>
        )}
      </div>
      {entryRequest && <GateRequestNotice request={entryRequest} />}
      <Link to="/me/bookings" className="cx-link" style={{ marginTop: '0.75rem' }}>All my bookings</Link>
    </article>
  )
}
