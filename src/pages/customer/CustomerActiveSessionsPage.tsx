import { Link } from 'react-router-dom'
import { CalendarClock, Car, SquarePlus } from 'lucide-react'
import { BookingCard, SessionCard } from '@/components/customer/dashboard/SessionCards'
import { useCurrentSessions } from '@/hooks/useParkingSessions'
import { useMyReservations } from '@/hooks/useReservations'
import { bookingAllowance, isUpcomingBooking } from '@/lib/bookingLimits'
import { getErrorMessage } from '@/api/apiError'
import { formatNumber } from '@/lib/format'
import { t, tMaybe } from '@/i18n'

/** A list that could not be loaded, with a retry. */
function ErrorNotice({ error, fallback, onRetry }: { error: unknown; fallback: string; onRetry: () => void }) {
  return (
    <div className="cx-card cx-empty-card" role="alert">
      <p className="cx-error">{tMaybe(getErrorMessage(error, fallback))}</p>
      <button type="button" className="cx-btn" onClick={onRetry}>{t('Try again')}</button>
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
          <h1 className="cx-page-title">{t('Active Sessions')}</h1>
        </div>
        {allowance.atLimit ? (
          <span className="cx-btn" aria-disabled="true" title={t('Use or cancel a booking before making a new one')}>
            <SquarePlus aria-hidden />{' '}{t('Booking limit reached')}
          </span>
        ) : (
          <Link to="/me#map" className="cx-btn cx-btn--teal" style={{ padding: '0.9rem 1.4rem' }}>
            <SquarePlus aria-hidden />{' '}{t('Book a bay')}
          </Link>
        )}
      </header>

      <div className="cx-tiles" style={{ marginTop: 0, marginBottom: '1.5rem' }}>
        <div className="cx-tile">
          <span className="cx-label">{t('Parked now')}</span>
          <strong className="cx-tile__value is-gold">{sessionsQuery.isPending ? '…' : sessions.length}</strong>
          <span className="cx-tile__sub">{sessions.length === 1 ? t('vehicle inside a lot') : t('vehicles inside a lot')}</span>
        </div>
        <div className="cx-tile">
          <span className="cx-label">{t('Active bookings')}</span>
          <strong className="cx-tile__value is-teal">
            {reservationsQuery.isPending ? '…' : `${allowance.activeCount} / ${allowance.limit}`}
          </strong>
          <span className="cx-tile__sub">{allowance.atLimit ? t('Limit reached') : t('{v} more allowed', { v: allowance.limit - allowance.activeCount })}</span>
        </div>
        <div className="cx-tile">
          <span className="cx-label">{t('Fees so far')}</span>
          <strong className="cx-tile__value">{t('{amountDue} VND', { amountDue: formatNumber(amountDue) })}</strong>
          <span className="cx-tile__sub">{t('Not paid yet, across parked vehicles')}</span>
        </div>
        <div className="cx-tile">
          <span className="cx-label">{t('Deposits due')}</span>
          <strong className="cx-tile__value">{tMaybe(depositsDue)}</strong>
          <span className="cx-tile__sub">{depositsDue ? t('Pay before the deadline or the bay is released') : t('Nothing waiting')}</span>
        </div>
      </div>

      <section className="cx-section" aria-labelledby="parked-title" id="parked">
        <div className="cx-section__head">
          <h2 className="cx-section__title" id="parked-title">
            <Car aria-hidden />{' '}{t('Parked now')}
          </h2>
        </div>
        {sessionsQuery.isPending ? (
          <div className="cx-card"><div className="cx-skeleton" style={{ height: '16rem' }} /></div>
        ) : sessionsQuery.isError && sessions.length === 0 ? (
          <ErrorNotice error={tMaybe(sessionsQuery.error)} fallback="Could not load your parked vehicles." onRetry={() => void sessionsQuery.refetch()} />
        ) : sessions.length === 0 ? (
          <div className="cx-card cx-empty-card">
            <h3 className="cx-session__name" style={{ margin: 0 }}>{t('No vehicle parked right now')}</h3>
            <p>{t('The running fee, prepayment and exit gate pass of each parked vehicle appear here after check-in.')}</p>
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
            <CalendarClock aria-hidden />{' '}{t('Upcoming bookings')}
          </h2>
          <Link to="/me/bookings#history" className="cx-link">{t('Booking history')}</Link>
        </div>
        {reservationsQuery.isPending ? (
          <div className="cx-card"><div className="cx-skeleton" style={{ height: '16rem' }} /></div>
        ) : reservationsQuery.isError && reservations.length === 0 ? (
          <ErrorNotice error={tMaybe(reservationsQuery.error)} fallback="Could not load your bookings." onRetry={() => void reservationsQuery.refetch()} />
        ) : upcoming.length === 0 ? (
          <div className="cx-card cx-empty-card">
            <h3 className="cx-session__name" style={{ margin: 0 }}>{t('No upcoming booking')}</h3>
            <p>{t('Pick a bay on the 3D map, then choose a scheduled window or pay as you go.')}</p>
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
