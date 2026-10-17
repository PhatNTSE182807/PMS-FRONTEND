import { toast } from 'sonner'
import { CalendarClock, CircleCheck, Navigation, QrCode, ScanLine, Zap } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import { useNow } from '@/hooks/useNow'
import type { VehicleDTO } from '@/types/profile.dto'
import { demoActiveSession, demoReservation } from '@/mocks/customerActivity.mock'
import { vehicleTitle } from '../customerFormat'

const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })

const comingSoon = (what: string) => toast.info(`${what} will be available once the parking session service is live.`)

/** Live dwell for the car parked right now. The session itself is demo data (no API yet). */
export function ActiveSessionCard({ vehicle }: { vehicle?: VehicleDTO }) {
  const now = useNow(30_000)
  const session = demoActiveSession
  const minutes = Math.max(0, Math.floor((now - session.entryAt) / 60_000))
  const accrued = Math.ceil(minutes / 60) * session.hourlyRate
  const plate = vehicle?.licensePlate ?? '—'

  return (
    <article className="cx-card cx-card--accent-gold" id="session">
      <div className="cx-session__head">
        <div className="cx-session__lot">
          <span className="cx-session__p" aria-hidden="true">P</span>
          <div>
            <span className="cx-eyebrow">
              <span className="cx-dot cx-dot--live" aria-hidden="true" /> Live active dwell
              <span className="cx-demo-tag">Demo</span>
            </span>
            <h2 className="cx-session__name">{session.lotName}</h2>
            <p className="cx-session__addr">{session.address}</p>
          </div>
        </div>
        <div className="cx-session__slot">
          <span className="cx-label">Slot assign</span>
          <span className="cx-session__slot-value">Bay {session.slot}</span>
        </div>
      </div>

      <div className="cx-metrics">
        <div>
          <span className="cx-label">Vehicle</span>
          <span className="cx-metric__value">{vehicle ? vehicleTitle(vehicle) : 'No vehicle yet'}</span>
          <span className="cx-metric__sub cx-mono">{plate}</span>
        </div>
        <div>
          <span className="cx-label">Entry time</span>
          <span className="cx-metric__value">{timeFormat.format(session.entryAt)}</span>
          <span className="cx-metric__sub">Today</span>
        </div>
        <div>
          <span className="cx-label">Elapsed duration</span>
          <span className="cx-metric__value" style={{ color: 'var(--cx-gold)' }}>
            {Math.floor(minutes / 60)}h {minutes % 60}m
          </span>
          <span className="cx-metric__sub">Real-time meter</span>
        </div>
        <div>
          <span className="cx-label">Accrued total</span>
          <span className="cx-metric__big">{formatNumber(accrued)}</span>
          <span className="cx-metric__sub">VND ({formatNumber(session.hourlyRate)} / started hour)</span>
        </div>
      </div>

      <div className="cx-session__plate-row">
        <div className="cx-card__title-row">
          <span className="cx-plate">{plate}</span>
          <div>
            <strong style={{ fontSize: '0.875rem' }}>Automatic license plate capture</strong>
            <span className="cx-metric__sub" style={{ color: '#6fdba8' }}>
              <CircleCheck size={13} aria-hidden style={{ verticalAlign: '-2px' }} /> Verified at {session.entryGate}
            </span>
          </div>
        </div>
        <button type="button" className="cx-btn" onClick={() => comingSoon('Turn-by-turn directions')}>
          <Navigation aria-hidden /> Directions to bay
        </button>
      </div>

      <div className="cx-session__actions">
        <button type="button" className="cx-btn cx-btn--teal" onClick={() => comingSoon('Pre-payment')}>
          <ScanLine aria-hidden /> Pre-pay via VietQR / Card
        </button>
        <button type="button" className="cx-btn cx-btn--gold" onClick={() => comingSoon('The exit gate pass')}>
          <QrCode aria-hidden /> View exit gate pass
        </button>
      </div>
    </article>
  )
}

/** Next booking. Demo data until the reservation API exists. */
export function ReservationCard({ vehicle }: { vehicle?: VehicleDTO }) {
  const r = demoReservation
  return (
    <article className="cx-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="cx-card__head" style={{ marginBottom: '1rem' }}>
        <span className="cx-eyebrow">
          <CalendarClock size={14} aria-hidden /> Scheduled reservation <span className="cx-demo-tag">Demo</span>
        </span>
        <span className="cx-chip cx-chip--teal">Guaranteed slot</span>
      </div>
      <h2 className="cx-session__name" style={{ marginTop: 0 }}>{r.lotName}</h2>
      <p className="cx-session__addr" style={{ marginBottom: '1.25rem' }}>{r.area}</p>

      <div className="cx-kv">
        <div className="cx-kv__row">
          Scheduled window <strong>{r.window}</strong>
        </div>
        <div className="cx-kv__row">
          Allocated stall area <strong className="is-gold">{r.stallArea}</strong>
        </div>
        <div className="cx-kv__row">
          Designated vehicle <strong>{vehicle ? `${vehicleTitle(vehicle)} (${vehicle.licensePlate})` : '—'}</strong>
        </div>
      </div>

      <p className="cx-footnote">
        <Zap aria-hidden /> {r.note}
      </p>

      <div className="cx-actions" style={{ marginTop: 'auto', paddingTop: '1.5rem', justifyContent: 'stretch' }}>
        <button type="button" className="cx-btn" style={{ flex: 1 }} onClick={() => comingSoon('Changing a reservation')}>
          Modify window
        </button>
        <button type="button" className="cx-btn cx-btn--danger" onClick={() => comingSoon('Cancelling a reservation')}>
          Cancel
        </button>
      </div>
    </article>
  )
}
