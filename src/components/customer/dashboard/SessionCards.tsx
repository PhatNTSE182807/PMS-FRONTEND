import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { CalendarClock, CircleCheck, Clock, CreditCard, Hourglass, LogIn, LogOut, QrCode as QrIcon, ScanLine, ShieldAlert, ShieldCheck, Wallet, X } from 'lucide-react'
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
import { VnpayButton } from '@/components/payment/VnpayButton'
import { t, localDateFormat, tMaybe } from '@/i18n'

const timeFormat = localDateFormat({ hour: '2-digit', minute: '2-digit' })
const vnd = (amount: number) => `${formatNumber(amount)} VND`


/** "20,000 / started hour", "5,000 / 4 h block"; null when the API sends no block price (the fee still counts). */
function tariffText(session: CurrentSessionDTO) {
  const { blockMinutes, blockPrice } = session.tariff
  if (!blockPrice) return null
  const block = blockMinutes === 60 ? 'started hour' : blockMinutes % 60 === 0 ? `${blockMinutes / 60} h block` : `${blockMinutes} min block`
  return `${formatNumber(blockPrice)} / ${block}`
}

/** The QR the exit lane scans. Every parked vehicle has one; it also says whether anything is left to pay. */
function ExitPassDialog({ pass, plate, leaving, onClose }: { pass: ExitPassDTO; plate: string; leaving: boolean; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="cx-pass-backdrop" role="presentation" onClick={onClose}>
      <div className="cx-pass" role="dialog" aria-modal="true" aria-labelledby="exit-pass-title" onClick={(e) => e.stopPropagation()}>
        <div className="cx-card__head" style={{ marginBottom: 0 }}>
          <h2 className="cx-card__title" id="exit-pass-title">{t('Exit gate pass')}</h2>
          <button type="button" className="cx-icon-btn" aria-label={t('Close')} onClick={onClose}>
            <X aria-hidden />
          </button>
        </div>
        <QrCode value={pass.token} label={t('Exit pass {sessionCode}', { sessionCode: pass.sessionCode })} className="cx-pass__qr" />
        <p className="cx-mono">{plate} • {tMaybe(pass.sessionCode)}</p>
        <p className="cx-pass__status">
          {pass.prepaid
            ? t('Paid. Show this at the exit lane before {v}.', { v: pass.validUntil ? timeFormat.format(Date.parse(pass.validUntil)) : 'your exit window ends' })
            : pass.amountDue > 0
              ? leaving
                ? t('Show this at the exit lane and pay the Staff {v} there.', { v: vnd(pass.amountDue) })
                : t('Show this at the exit lane. {v} so far is paid there, or prepay now to drive straight out.', { v: vnd(pass.amountDue) })
              : t('Nothing to pay so far. Show this at the exit lane.')}
        </p>
        <button type="button" className="cx-btn cx-btn--block" onClick={onClose}>{t('Done')}</button>
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
  const lane = request.kind === 'CheckIn' ? t('entry') : t('exit')
  // The API's "problem" is written for the Staff; an unpaid exit gets the customer's own wording
  const hint =
    request.kind === 'CheckOut' && request.sessionStatus && request.sessionStatus !== 'Paid'
      ? 'Not paid yet: pay the Staff at the exit lane.'
      : request.problem
  if (request.status === 'Refused') {
    return (
      <p className="cx-gate-request cx-gate-request--refused" role="status">
        <ShieldAlert aria-hidden />
        <span>
          {t('Staff did not open the {lane} barrier', { lane })}{request.note ? `: ${request.note}` : '.'}
        </span>
      </p>
    )
  }
  return (
    <p className="cx-gate-request" role="status" aria-live="polite">
      <Hourglass aria-hidden />
      <span>
        {t('Waiting for Staff at the {lane} lane to check your vehicle and open the barrier', { lane })}
        {hint ? `. ${tMaybe(hint)}` : '…'}
      </span>
      <button
        type="button"
        className="cx-link"
        disabled={cancel.isPending}
        onClick={() => cancel.mutate(request.id, { onError: (e) => toast.error(getErrorMessage(e, 'Could not cancel the request.')) })}
      >
        {t('Cancel')}
      </button>
    </p>
  )
}

/** Dashboard card: the first parked vehicle, with a link to the Active Sessions page when there are more. */
export function ActiveSessionCard() {
  const { data: sessions = [], isPending } = useCurrentSessions()
  const current = sessions[0]

  if (isPending) return <article className="cx-card cx-card--accent-gold"><div className="cx-skeleton" style={{ height: '18rem' }} /></article>

  if (!current) {
    return (
      <article className="cx-card cx-card--accent-gold" id="session">
        <span className="cx-eyebrow">
          <span className="cx-dot" aria-hidden="true" />{' '}{t('Active session')}
        </span>
        <div className="cx-empty-card">
          <h2 className="cx-session__name" style={{ margin: 0 }}>{t('No vehicle parked right now')}</h2>
          <p>{t('Your running fee, prepayment and exit gate pass appear here as soon as you check in at a lot.')}</p>
          <a href="#map" className="cx-btn cx-btn--teal">
            <CalendarClock aria-hidden />{' '}{t('Book a bay')}
          </a>
        </div>
      </article>
    )
  }

  return <SessionCard current={current} parkedCount={sessions.length} id="session" />
}

interface SessionCardProps {
  current: CurrentSessionDTO
  /** All vehicles parked now; above 1 the card links to the Active Sessions page. */
  parkedCount?: number
  id?: string
}

/** One parked vehicle (GET /parking-sessions/current): running fee, prepay with the wallet, VNPay or MoMo, exit pass, check-out. */
export function SessionCard({ current, parkedCount = 1, id }: SessionCardProps) {
  const now = useNow(30_000)
  const prepay = usePrepaySession()
  const checkOut = useRequestCheckOut()
  const [choosing, setChoosing] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const exitRequest = useLatestRequest((r) => r.kind === 'CheckOut' && r.sessionId === current.session.id, now)
  // Check-out asked for: the vehicle is on its way out, so the card offers no more payment (the Staff takes any fee at the lane)
  const leaving = exitRequest?.status === 'Waiting'
  // A lost-ticket case waiting for the Staff decision: no fee yet, and nothing can be paid or checked out until it is decided
  const lostTicket = Boolean(current.lostTicketPending)

  const s = current.session
  const entry = Date.parse(s.entryTime)
  // The meter ticks locally between refreshes; the fee comes from the API
  const minutes = Math.max(current.elapsedMinutes, Math.floor((now - entry) / 60_000))
  const pass = current.exitPass
  const address = [current.lotAddress, current.lotDistrict].filter(Boolean).join(', ')
  const pay = (provider: PaymentProvider) => prepay.mutate({ sessionId: s.id, provider })
  const askCheckOut = () =>
    checkOut.mutate(s.id, {
      onSuccess: () => toast.success(t('Check-out requested'), { description: t('Drive to the exit lane: Staff will check your vehicle and open the barrier.') }),
      onError: (e) => toast.error(getErrorMessage(e, 'Could not request the check-out.')),
    })

  return (
    <article className="cx-card cx-card--accent-gold" id={id}>
      <div className="cx-session__head">
        <div className="cx-session__lot">
          <span className="cx-session__p" aria-hidden="true">P</span>
          <div>
            <span className="cx-eyebrow">
              <span className="cx-dot cx-dot--live" aria-hidden="true" />{' '}{t('Currently parked')}
              {parkedCount > 1 && (
                <Link to="/me/sessions" className="cx-link">{t('• {parkedCount} vehicles parked, see all', { parkedCount })}</Link>
              )}
            </span>
            <h2 className="cx-session__name">{tMaybe(current.lotName) ?? t('Parking lot')}</h2>
            <p className="cx-session__addr">{tMaybe(address) || '—'}</p>
          </div>
        </div>
        <div className="cx-session__slot">
          <span className="cx-label">{t('Your bay')}</span>
          <span className="cx-session__slot-value">{s.slotCode ? t('Bay {slotCode}', { slotCode: s.slotCode }) : (tMaybe(s.zoneName) ?? '—')}</span>
        </div>
      </div>

      <div className="cx-metrics">
        <div>
          <span className="cx-label">{t('Vehicle')}</span>
          <span className="cx-metric__value">{tMaybe(current.vehicleLabel) || tMaybe(s.vehicleTypeName) || t('Vehicle')}</span>
          <span className="cx-metric__sub cx-mono">{tMaybe(s.plateNumber)}</span>
        </div>
        <div>
          <span className="cx-label">{t('Entry time')}</span>
          <span className="cx-metric__value">{timeFormat.format(entry)}</span>
          <span className="cx-metric__sub">{relativeDay(entry, now)}</span>
        </div>
        <div>
          <span className="cx-label">{t('Parked for')}</span>
          <span className="cx-metric__value" style={{ color: 'var(--cx-gold)' }}>
            {Math.floor(minutes / 60)}h {minutes % 60}m
          </span>
          <span className="cx-metric__sub">
            {current.plannedDeparture ? t('Planned until {v}', { v: timeFormat.format(Date.parse(current.plannedDeparture)) }) : t('Updating live')}
          </span>
        </div>
        <div>
          <span className="cx-label">{t('Fee so far')}</span>
          <span className="cx-metric__big">{lostTicket ? '—' : formatNumber(current.feeSoFar)}</span>
          <span className="cx-metric__sub">
            {lostTicket ? t('Set once the lost-ticket case is decided') : tariffText(current) ? t('VND ({v})', { v: tariffText(current) }) : t('VND so far')}
          </span>
        </div>
      </div>

      <div className="cx-session__plate-row">
        <div className="cx-card__title-row">
          <span className="cx-plate">{tMaybe(s.plateNumber)}</span>
          <div>
            <strong style={{ fontSize: '0.875rem' }}>
              {current.entryMethod === 'Reservation' ? t('Checked in with your booking') : current.entryMethod === 'Manual' ? t('Entry recorded by Staff') : t('Automatic license plate capture')}
            </strong>
            <span className="cx-metric__sub" style={{ color: 'var(--cx-success)' }}>
              <CircleCheck size={13} aria-hidden style={{ verticalAlign: '-2px' }} />{' '}{t('Verified at {v}', { v: current.entryGateName ?? 'the entry lane' })}
            </span>
          </div>
        </div>
      </div>

      <div className="cx-exit-pass">
        <button type="button" className="cx-exit-pass__qr" aria-label={t('Open the exit gate pass')} onClick={() => setShowPass(true)}>
          <QrCode value={pass.token} label={t('Exit pass {sessionCode}', { sessionCode: pass.sessionCode })} />
        </button>
        <div className="cx-exit-pass__body">
          <span className="cx-label">{t('Exit pass code')}</span>
          <span className="cx-exit-pass__code cx-mono">{tMaybe(pass.sessionCode)}</span>
          <span className="cx-metric__sub">
            {pass.prepaid
              ? t('Paid: show it at the exit lane to drive out.')
              : leaving
                ? t('Show it at the exit lane and pay the Staff there.')
                : t('Show it at the exit lane; tap the QR to enlarge.')}
          </span>
        </div>
      </div>

      {lostTicket ? (
        <p className="cx-prepay" role="status">
          <span>
            <ShieldAlert size={15} aria-hidden style={{ verticalAlign: '-3px', color: 'var(--cx-gold)' }} />{' '}{t('Your ticket was reported lost and the Staff are checking your Citizen ID and registration papers. The fee and the lost-ticket fine are settled with the Staff at the exit lane once it is decided.')}
          </span>
        </p>
      ) : pass.prepaid ? (
        <p className="cx-prepay">
          <span><ShieldCheck size={15} aria-hidden style={{ verticalAlign: '-3px', color: 'var(--cx-success)' }} />{' '}{t('Paid. Drive out before')}{' '}{pass.validUntil ? timeFormat.format(Date.parse(pass.validUntil)) : 'the exit window ends'}.</span>
        </p>
      ) : choosing && !leaving ? (
        <div className="cx-prepay" aria-live="polite">
          <span>
            {t('Pay')}{' '}<strong>{vnd(current.amountDue)}</strong>{' '}{t('now')}
            {current.depositApplied > 0 ? t(' (after your {v} deposit)', { v: vnd(current.depositApplied) }) : ''}{t('; you then have 15 minutes to leave.')}
          </span>
          {current.pendingPayment?.payUrl && (
            <a className="cx-link" href={current.pendingPayment.payUrl}>{t('Continue the {provider} payment you started', { provider: current.pendingPayment.provider })}</a>
          )}
          <div className="cx-prepay__row">
            <button type="button" className="cx-btn cx-btn--wallet" disabled={prepay.isPending || current.amountDue <= 0} onClick={() => pay('Wallet')}>
              <CreditCard aria-hidden />{' '}{t('Pay with XXIV Wallet')}
            </button>
            <VnpayButton className="cx-btn" disabled={prepay.isPending || current.amountDue <= 0} onClick={() => pay('VNPay')} />
            <button type="button" className="cx-btn cx-btn--momo" disabled={prepay.isPending || current.amountDue <= 0} onClick={() => pay('MoMo')}>
              <Wallet aria-hidden />{' '}{t('MoMo')}
            </button>
            <button type="button" className="cx-btn" onClick={() => setChoosing(false)}>{t('Not now')}</button>
          </div>
        </div>
      ) : null}

      <div className="cx-session__actions">
        {!pass.prepaid && !leaving && !lostTicket && (
          <button type="button" className="cx-btn cx-btn--teal" disabled={current.amountDue <= 0} onClick={() => setChoosing(true)}>
            <ScanLine aria-hidden /> {current.amountDue > 0 ? t('Prepay parking fee') : t('Nothing to pay yet')}
          </button>
        )}
        <button type="button" className="cx-btn cx-btn--gold" onClick={() => setShowPass(true)}>
          <QrIcon aria-hidden />{' '}{t('View exit gate pass')}
        </button>
        <button
          type="button"
          className="cx-btn cx-btn--teal"
          disabled={checkOut.isPending || leaving || lostTicket}
          title={
            lostTicket
              ? t('Wait for the Staff to decide the lost-ticket case')
              : pass.prepaid || current.amountDue <= 0 ? undefined : t('Prepay first, or pay the Staff at the exit lane')
          }
          onClick={askCheckOut}
        >
          <LogOut aria-hidden /> {leaving ? t('Check-out requested') : t('Check out')}
        </button>
      </div>

      {exitRequest && <GateRequestNotice request={exitRequest} />}

      {showPass && <ExitPassDialog pass={pass} plate={s.plateNumber} leaving={leaving} onClose={() => setShowPass(false)} />}
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

/** Dashboard card: the next booking (GET /reservations/upcoming). */
export function ReservationCard() {
  const { data: booking, isPending } = useUpcomingReservation()

  if (isPending) return <article className="cx-card"><div className="cx-skeleton" style={{ height: '18rem' }} /></article>

  if (!booking) {
    return (
      <article className="cx-card" style={{ display: 'flex', flexDirection: 'column' }}>
        <span className="cx-eyebrow">
          <CalendarClock size={14} aria-hidden />{' '}{t('Scheduled reservation')}
        </span>
        <div className="cx-empty-card">
          <h2 className="cx-session__name" style={{ margin: 0 }}>{t('No upcoming booking')}</h2>
          <p>{t('Pick a bay on the 3D map, then choose a scheduled window or pay as you go.')}</p>
          <a href="#map" className="cx-btn cx-btn--teal">
            <CalendarClock aria-hidden />{' '}{t('Book a bay')}
          </a>
        </div>
      </article>
    )
  }

  return <BookingCard booking={booking} showAllLink />
}

/** One booking that has not started: window, bay and vehicle, deposit, check-in request, change and cancel. */
export function BookingCard({ booking, showAllLink = false }: { booking: ReservationDTO; showAllLink?: boolean }) {
  const now = useNow(30_000)
  const update = useUpdateReservation()
  const cancel = useCancelReservation()
  const payDeposit = usePayDeposit()
  const checkIn = useRequestCheckIn()
  const entryRequest = useLatestRequest((r) => r.kind === 'CheckIn' && r.reservationId === booking.id, now)
  const [editing, setEditing] = useState(false)
  const [times, setTimes] = useState<BookingTimes | null>(null)
  const [error, setError] = useState('')

  const pending = booking.status === 'PendingDeposit'
  const depositDue = booking.depositDueAt ? Date.parse(booking.depositDueAt) : null
  const location = [booking.parkingLotAddress, booking.parkingLotDistrict].filter(Boolean).join(', ')
  // The entry lane accepts the booking from 15 minutes before arrival until the hold ends
  const windowOpen = booking.status === 'Confirmed' && now >= Date.parse(booking.checkInFrom) && now <= Date.parse(booking.checkInUntil)
  const askCheckIn = () =>
    checkIn.mutate(booking.id, {
      onSuccess: () => toast.success(t('Check-in requested'), { description: t('Drive to the entry lane: Staff will check your vehicle and open the barrier.') }),
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
      ? t('Cancel this booking? No deposit has been paid yet.')
      : booking.refundIfCancelledNow > 0
        ? t('Cancel this booking and refund {v}?', { v: vnd(booking.refundIfCancelledNow) })
        : t('It is less than 30 minutes before arrival, so the deposit is not refunded. Cancel anyway?')
    if (window.confirm(message)) cancel.mutate({ id: booking.id })
  }

  return (
    <article className="cx-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="cx-card__head" style={{ marginBottom: '1rem' }}>
        <span className="cx-eyebrow">
          <CalendarClock size={14} aria-hidden />{' '}{t('Scheduled reservation')}
        </span>
        {pending ? (
          <span className="cx-chip cx-chip--gold">{t('Deposit due')}{' '}{depositDue ? timeFormat.format(depositDue) : ''}</span>
        ) : (
          <span className="cx-chip cx-chip--teal">{t('Bay held')}</span>
        )}
      </div>
      <h2 className="cx-session__name" style={{ marginTop: 0 }}>{tMaybe(booking.parkingLotName) ?? t('Parking lot')}</h2>
      <p className="cx-session__addr" style={{ marginBottom: '1.25rem' }}>{tMaybe(location) || t('Booking #{code}', { code: booking.code })}</p>

      {editing && times ? (
        <div className="cx-booking__edit" style={{ marginTop: 0 }}>
          <BookingTimeFields value={times} onChange={setTimes} now={now} idPrefix={`card-${booking.id}`} disabled={update.isPending} holdMinutes={booking.holdMinutes} />
          {error && <p className="cx-error" role="alert">{tMaybe(error)}</p>}
        </div>
      ) : (
        <div className="cx-kv">
          <div className="cx-kv__row">
            {booking.bookingMode === 'Scheduled' ? t('Scheduled window') : t('Arrival (pay as you go)')}{' '}
            <strong>{describeWindow(booking.arrivalTime, booking.departureTime, now)}</strong>
          </div>
          <div className="cx-kv__row">
            {t('Your bay')}{' '}<strong className="is-gold">{[tMaybe(booking.zoneName), booking.slotCode && t('Bay {slotCode}', { slotCode: booking.slotCode })].filter(Boolean).join(' • ') || '—'}</strong>
          </div>
          <div className="cx-kv__row">
            {t('Vehicle')}{' '}<strong>{booking.vehicleLabel ? `${booking.vehicleLabel} (${booking.plateNumber ?? '—'})` : (tMaybe(booking.plateNumber) ?? '—')}</strong>
          </div>
        </div>
      )}

      {!editing && (
        <p className="cx-footnote">
          <Clock aria-hidden />{' '}{t('Check-in {v} - {v2} •', { v: timeFormat.format(Date.parse(booking.checkInFrom)), v2: timeFormat.format(Date.parse(booking.checkInUntil)) })}{' '}
          {booking.bookingMode === 'Scheduled' ? t('you pay for the time you actually park') : t('leave anytime, you pay for the time you park')}
        </p>
      )}

      <div className="cx-actions" style={{ marginTop: 'auto', paddingTop: '1.5rem', justifyContent: 'stretch' }}>
        {editing ? (
          <>
            <button type="button" className="cx-btn cx-btn--teal" style={{ flex: 1 }} disabled={update.isPending} onClick={save}>
              {update.isPending ? t('Saving…') : t('Save new window')}
            </button>
            <button type="button" className="cx-btn" onClick={() => setEditing(false)}>{t('Keep')}</button>
          </>
        ) : pending ? (
          <>
            <button type="button" className="cx-btn cx-btn--wallet" style={{ flex: 1 }} disabled={payDeposit.isPending} onClick={() => payDeposit.mutate({ id: booking.id, provider: 'Wallet' })}>
              <CreditCard aria-hidden />{' '}{t('Pay with XXIV Wallet')}
            </button>
            <VnpayButton className="cx-btn" disabled={payDeposit.isPending} onClick={() => payDeposit.mutate({ id: booking.id, provider: 'VNPay' })} />
            <button type="button" className="cx-btn cx-btn--momo" disabled={payDeposit.isPending} onClick={() => payDeposit.mutate({ id: booking.id, provider: 'MoMo' })}>
              <Wallet aria-hidden />{' '}{t('MoMo')}
            </button>
            <button type="button" className="cx-btn cx-btn--danger" disabled={cancel.isPending} onClick={confirmCancel}>{t('Cancel')}</button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="cx-btn cx-btn--gold"
              style={{ flex: 1 }}
              disabled={!windowOpen || checkIn.isPending || entryRequest?.status === 'Waiting'}
              title={windowOpen ? undefined : t('Check-in opens at {v}', { v: timeFormat.format(Date.parse(booking.checkInFrom)) })}
              onClick={askCheckIn}
            >
              <LogIn aria-hidden /> {entryRequest?.status === 'Waiting' ? t('Check-in requested') : t('Check in')}
            </button>
            <button
              type="button"
              className="cx-btn"
              disabled={!booking.canChange}
              title={booking.canChange ? undefined : t('Changes close 30 minutes before arrival')}
              onClick={() => {
                setTimes(timesOf(booking))
                setError('')
                setEditing(true)
              }}
            >
              {t('Change time')}
            </button>
            <button type="button" className="cx-btn cx-btn--danger" disabled={!booking.canCancel || cancel.isPending} onClick={confirmCancel}>
              {t('Cancel')}
            </button>
          </>
        )}
      </div>
      {entryRequest && <GateRequestNotice request={entryRequest} />}
      {showAllLink && <Link to="/me/sessions" className="cx-link" style={{ marginTop: '0.75rem' }}>{t('All active bookings and sessions')}</Link>}
    </article>
  )
}
