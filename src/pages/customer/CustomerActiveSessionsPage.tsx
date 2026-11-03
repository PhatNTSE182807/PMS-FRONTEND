import { Link } from 'react-router-dom'
import { CalendarClock, Car, SquarePlus } from 'lucide-react'
import { BookingCard, SessionCard } from '@/components/customer/dashboard/SessionCards'
import { useCurrentSessions } from '@/hooks/useParkingSessions'
import { useMyReservations } from '@/hooks/useReservations'
import { bookingAllowance, isUpcomingBooking } from '@/lib/bookingLimits'
import { getErrorMessage } from '@/api/apiError'
import { formatNumber } from '@/lib/format'

/** A list that could not be loaded, with a retry. */
function ErrorNotice({ error, fallback, onRetry }: { error: unknown; fallback: string; onRetry: () => void }) {
  return (
    <div className="cx-card cx-empty-card" role="alert">
      <p className="cx-error">{getErrorMessage(error, fallback)}</p>
      <button type="button" className="cx-btn" onClick={onRetry}>Try again</button>
    </div>
  )
}

/**
 * /me/sessions: everything the customer has in progress, in one place. Vehicles parked now (running
 * fee, prepay, exit pass, check-out) and bookings not started yet (deposit, check-in, change, cancel).
 */
export default function CustomerActiveSessionsPage() {
  const sessionsQuery = useCurrentSessions()
  const reservationsQuery = useMyReservations()

  const sessions = sessionsQuery.data ?? []
  const reservations = reservationsQuery.data ?? []
  const upcoming = reservations.filter(isUpcomingBooking).sort((a, b) => Date.parse(a.arrivalTime) - Date.parse(b.arrivalTime))
  const allowance = bookingAllowance(reservations)
  const amountDue = sessions.reduce((sum, s) => sum + (s.exitPass.prepaid ? 0 : s.amountDue), 0)
  const depositsDue = upcoming.filter((b) => b.status === 'PendingDeposit').length

  return (
    <>
      <header className="cx-page-head">
        <div>
          <span className="cx-eyebrow">
            <span className="cx-dot cx-dot--live" aria-hidden="true" /> Live sessions • Refreshed automatically
          </span>
          <h1 className="cx-page-title">Active Sessions</h1>
          <p className="cx-page-lead">
            Your parked vehicles and the bookings you have not used yet. Pay, show your exit pass, check in or out from here.
            Up to {allowance.limit} active bookings per account, one per vehicle.
          </p>
        </div>
        {allowance.atLimit ? (
          <span className="cx-btn" aria-disabled="true" title="Use or cancel a booking before making a new one">
            <SquarePlus aria-hidden /> Booking limit reached
          </span>
        ) : (
          <Link to="/me#map" className="cx-btn cx-btn--teal" style={{ padding: '0.9rem 1.4rem' }}>
            <SquarePlus aria-hidden /> Book a bay
          </Link>
        )}
      </header>

      <div className="cx-tiles" style={{ marginTop: 0, marginBottom: '1.5rem' }}>
        <div className="cx-tile">
          <span className="cx-label">Parked now</span>
          <strong className="cx-tile__value is-gold">{sessionsQuery.isPending ? '…' : sessions.length}</strong>
          <span className="cx-tile__sub">{sessions.length === 1 ? 'vehicle inside a lot' : 'vehicles inside a lot'}</span>
        </div>
        <div className="cx-tile">
          <span className="cx-label">Active bookings</span>
          <strong className="cx-tile__value is-teal">
            {reservationsQuery.isPending ? '…' : `${allowance.activeCount} / ${allowance.limit}`}
          </strong>
          <span className="cx-tile__sub">{allowance.atLimit ? 'Limit reached' : `${allowance.limit - allowance.activeCount} more allowed`}</span>
        </div>
        <div className="cx-tile">
          <span className="cx-label">Fees so far</span>
          <strong className="cx-tile__value">{formatNumber(amountDue)} VND</strong>
          <span className="cx-tile__sub">Not paid yet, across parked vehicles</span>
        </div>
        <div className="cx-tile">
          <span className="cx-label">Deposits due</span>
          <strong className="cx-tile__value">{depositsDue}</strong>
          <span className="cx-tile__sub">{depositsDue ? 'Pay before the deadline or the bay is released' : 'Nothing waiting'}</span>
        </div>
      </div>

      <section className="cx-section" aria-labelledby="parked-title" id="parked">
        <div className="cx-section__head">
          <h2 className="cx-section__title" id="parked-title">
            <Car aria-hidden /> Parked now
          </h2>
        </div>
        {sessionsQuery.isPending ? (
          <div className="cx-card"><div className="cx-skeleton" style={{ height: '16rem' }} /></div>
        ) : sessionsQuery.isError && sessions.length === 0 ? (
          <ErrorNotice error={sessionsQuery.error} fallback="Could not load your parked vehicles." onRetry={() => void sessionsQuery.refetch()} />
        ) : sessions.length === 0 ? (
          <div className="cx-card cx-empty-card">
            <h3 className="cx-session__name" style={{ margin: 0 }}>No vehicle parked right now</h3>
            <p>The running fee, prepayment and exit gate pass of each parked vehicle appear here after check-in.</p>
          </div>
        ) : (
          <div className="cx-stack">
            {sessions.map((current) => (
              <SessionCard key={current.session.id} current={current} />
            ))}
          </div>
        )}
      </section>

      <section className="cx-section" aria-labelledby="bookings-title" id="bookings">
        <div className="cx-section__head">
          <h2 className="cx-section__title" id="bookings-title">
            <CalendarClock aria-hidden /> Upcoming bookings
          </h2>
          <Link to="/me/bookings#history" className="cx-link">Booking history</Link>
        </div>
        {reservationsQuery.isPending ? (
          <div className="cx-card"><div className="cx-skeleton" style={{ height: '16rem' }} /></div>
        ) : reservationsQuery.isError && reservations.length === 0 ? (
          <ErrorNotice error={reservationsQuery.error} fallback="Could not load your bookings." onRetry={() => void reservationsQuery.refetch()} />
        ) : upcoming.length === 0 ? (
          <div className="cx-card cx-empty-card">
            <h3 className="cx-session__name" style={{ margin: 0 }}>No upcoming booking</h3>
            <p>Pick a bay on the 3D map, then choose a scheduled window or pay as you go.</p>
          </div>
        ) : (
          <div className="cx-sessions-grid">
            {upcoming.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </div>
        )}
      </section>
    </>
  )
}
