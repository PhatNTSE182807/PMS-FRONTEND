import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Bike,
  CalendarClock,
  Car,
  CircleX,
  Clock,
  Download,
  Headset,
  Info,
  MapPin,
  Navigation,
  ReceiptText,
  ScanLine,
  Search,
  SlidersHorizontal,
  SquarePlus,
  Timer,
  Wallet,
  Zap,
} from 'lucide-react'
import { useNow } from '@/hooks/useNow'
import { useVehicles } from '@/hooks/useProfile'
import { formatNumber } from '@/lib/format'
import { demoBookings, type DemoBooking, type DemoBookingStatus } from '@/mocks/customerActivity.mock'
import { vehicleTitle } from '@/components/customer/customerFormat'
import type { VehicleDTO } from '@/types/profile.dto'

type Filter = 'ALL' | DemoBookingStatus

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'CONFIRMED', label: 'Active & Confirmed' },
  { value: 'PENDING_DEPOSIT', label: 'Pending Deposit' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled / Refunded' },
]

const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
const day = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const vnd = (value: number) => `${formatNumber(value)} VND`
const soon = (what: string) => toast.info(`${what} will be available once the booking service is live.`)

function relativeDay(ts: number, now: number) {
  const startOf = (t: number) => new Date(t).setHours(0, 0, 0, 0)
  const diff = Math.round((startOf(ts) - startOf(now)) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return day.format(ts)
}

function duration(start: number, end: number) {
  const minutes = Math.max(0, Math.round((end - start) / 60_000))
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

/** Decorative pass pattern from the booking id: the real gate pass comes with the booking API. */
function PassPattern({ seed }: { seed: string }) {
  // 25x25 modules; the three finder corners are drawn separately.
  const cells = useMemo(() => {
    let h = [...seed].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7)
    const inFinder = (x: number, y: number) => (x < 8 && y < 8) || (x > 16 && y < 8) || (x < 8 && y > 16)
    const out: { x: number; y: number }[] = []
    for (let y = 0; y < 25; y++) {
      for (let x = 0; x < 25; x++) {
        h = (h * 1103515245 + 12345) >>> 0
        if (!inFinder(x, y) && (h >> 16) % 5 < 2) out.push({ x, y })
      }
    }
    return out
  }, [seed])
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="7" height="7" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1" />
      <rect x={x + 2} y={y + 2} width="3" height="3" rx="0.6" fill="var(--cx-gold)" />
    </g>
  )
  return (
    <svg viewBox="0 0 25 25" className="cx-pass__code" role="img" aria-label="Gate pass code">
      {cells.map(({ x, y }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="0.92" height="0.92" rx="0.15" fill="currentColor" />
      ))}
      {finder(0, 0)}
      {finder(18, 0)}
      {finder(0, 18)}
    </svg>
  )
}

function FeaturedBooking({ booking, vehicle, now }: { booking: DemoBooking; vehicle?: VehicleDTO; now: number }) {
  const msLeft = Math.max(0, booking.start + 15 * 60_000 - now)
  return (
    <section className="cx-card cx-booking" aria-labelledby="featured-title">
      <div className="cx-booking__main">
        <div className="cx-booking__chips">
          <span className="cx-chip cx-chip--gold"><span className="cx-dot cx-dot--gold" aria-hidden="true" /> Confirmed &amp; guaranteed</span>
          <span className="cx-chip cx-chip--teal">
            <Clock aria-hidden /> Check-in window closes in {Math.floor(msLeft / 60_000)}m {Math.floor((msLeft % 60_000) / 1000)}s
          </span>
          <span className="cx-chip cx-chip--muted cx-mono">#{booking.id}</span>
          <span className="cx-demo-tag">Demo</span>
        </div>
        <h2 className="cx-booking__title" id="featured-title">{booking.lotName}</h2>
        <p className="cx-booking__addr">
          <MapPin aria-hidden /> {booking.address} • <span className="cx-mono">#{booking.lotCode}</span>
        </p>

        <div className="cx-tiles">
          <div className="cx-tile">
            <span className="cx-label">Bay assigned</span>
            <strong className="cx-tile__value is-gold">{booking.bay}</strong>
            <span className="cx-tile__sub">{booking.bayType}</span>
          </div>
          <div className="cx-tile">
            <span className="cx-label">Vehicle</span>
            <strong className="cx-tile__value cx-mono">{vehicle?.licensePlate ?? '—'}</strong>
            <span className="cx-tile__sub">{vehicle ? vehicleTitle(vehicle) : 'Register a vehicle'}</span>
          </div>
          <div className="cx-tile">
            <span className="cx-label">Arrival time</span>
            <strong className="cx-tile__value is-teal">{time.format(booking.start)} – {time.format(booking.end)}</strong>
            <span className="cx-tile__sub">{relativeDay(booking.start, now)} • Active window</span>
          </div>
          <div className="cx-tile">
            <span className="cx-label">Deposit paid</span>
            <strong className="cx-tile__value">{vnd(booking.deposit)}</strong>
            <span className="cx-tile__sub" style={{ color: 'var(--cx-gold)' }}>Deductible at exit</span>
          </div>
        </div>

        <div className="cx-booking__actions">
          <button type="button" className="cx-btn cx-btn--teal" onClick={() => soon('In-garage navigation')}>
            <Navigation aria-hidden /> View navigation guide
          </button>
          <button type="button" className="cx-btn" onClick={() => soon('Changing the slot or time')}>
            <SlidersHorizontal aria-hidden /> Change slot / time
          </button>
          <button type="button" className="cx-btn cx-btn--danger cx-booking__cancel" onClick={() => soon('Cancelling a reservation')}>
            <CircleX aria-hidden /> Cancel reservation
          </button>
        </div>
        <p className="cx-booking__note">
          * Guaranteed spot held until {time.format(booking.end)}. Full refund if cancelled before {time.format(booking.start)}. Gate cameras recognise your plate on arrival.
        </p>
      </div>

      <aside className="cx-pass" aria-label="Terminal fastpass">
        <div className="cx-pass__head">
          <span className="cx-eyebrow"><ScanLine size={14} aria-hidden /> Terminal fastpass</span>
          <span className="cx-label"><span className="cx-dot cx-dot--teal" aria-hidden="true" style={{ display: 'inline-block', marginRight: 4 }} />ANPR synced</span>
        </div>
        <div className="cx-pass__frame">
          <PassPattern seed={booking.id} />
        </div>
        <span className="cx-label" style={{ textAlign: 'center' }}>Pass token</span>
        <span className="cx-pass__token cx-mono">XXIV-{booking.lotCode.split('-')[1] ?? 'HUB'}-{booking.id.replace(/\D/g, '')}-AUTH</span>
        <p className="cx-pass__hint">Hold your phone under the scanner, or arrive in the registered vehicle for automatic gate lift-off.</p>
      </aside>
    </section>
  )
}

/** /me/bookings: reservations and booking history. Demo data until the booking API exists. */
export default function CustomerBookingsPage() {
  const now = useNow(1000)
  const { data: vehicles = [] } = useVehicles()
  const [filter, setFilter] = useState<Filter>('ALL')
  const [query, setQuery] = useState('')

  const vehicleFor = (b: DemoBooking) => (vehicles.length ? vehicles[b.vehicleIndex % vehicles.length] : undefined)
  const matches = (b: DemoBooking) => {
    const q = query.trim().toLowerCase()
    const plate = vehicleFor(b)?.licensePlate.toLowerCase() ?? ''
    return (filter === 'ALL' || b.status === filter) && (!q || b.id.toLowerCase().includes(q) || plate.includes(q) || b.lotName.toLowerCase().includes(q))
  }

  const visible = demoBookings.filter(matches)
  const featured = visible.find((b) => b.status === 'CONFIRMED')
  const upcoming = visible.filter((b) => b.status === 'PENDING_DEPOSIT')
  const history = visible.filter((b) => b.status === 'COMPLETED' || b.status === 'CANCELLED')
  const count = (f: Filter) => (f === 'ALL' ? demoBookings.length : demoBookings.filter((b) => b.status === f).length)

  return (
    <>
      <header className="cx-page-head">
        <div>
          <span className="cx-eyebrow"><span className="cx-dot cx-dot--gold" aria-hidden="true" /> Sovereign terminal • Access desk</span>
          <h1 className="cx-page-title">My Bookings &amp; Reservations</h1>
          <p className="cx-page-lead">
            Track active reservations, check-in passes, arrival times and your booking history across Ho Chi Minh City hubs.
          </p>
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
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by plate or ID..." aria-label="Search bookings" />
        </label>
      </div>

      {featured && <FeaturedBooking booking={featured} vehicle={vehicleFor(featured)} now={now} />}

      {upcoming.length > 0 && (
        <section className="cx-section" aria-labelledby="upcoming-title">
          <div className="cx-section__head">
            <h2 className="cx-section__title" id="upcoming-title">
              <CalendarClock aria-hidden /> Upcoming reservations
            </h2>
            <span className="cx-label cx-mono">{upcoming.length} action required</span>
          </div>
          {upcoming.map((b) => {
            const vehicle = vehicleFor(b)
            const Icon = b.vehicleKind === 'motorbike' ? Bike : Car
            return (
              <article key={b.id} className="cx-card cx-upcoming">
                <span className="cx-upcoming__icon"><Icon aria-hidden /></span>
                <div className="cx-upcoming__text">
                  <p className="cx-upcoming__title">
                    {b.lotName} <span className="cx-chip cx-chip--gold">Pending deposit</span>
                    <span className="cx-mono cx-label">#{b.lotCode}</span>
                  </p>
                  <p className="cx-upcoming__meta">
                    <MapPin aria-hidden /> {b.address} • <strong>Bay {b.bay} ({b.bayType})</strong> •{' '}
                    <span className="cx-mono">{vehicle?.licensePlate ?? '—'}</span>
                  </p>
                  <p className="cx-upcoming__when">
                    {relativeDay(b.start, now)}, {time.format(b.start)} – {time.format(b.end)}
                  </p>
                </div>
                <div className="cx-upcoming__deposit">
                  <span className="cx-label">Deposit amount</span>
                  <strong>{vnd(b.deposit)}</strong>
                  <span className="cx-upcoming__due"><Timer aria-hidden /> Pay before check-in</span>
                </div>
                <button type="button" className="cx-btn cx-btn--gold" onClick={() => soon('Deposit payment')}>
                  <Wallet aria-hidden /> Pay deposit via VietQR / Card
                </button>
              </article>
            )
          })}
        </section>
      )}

      <section className="cx-section" id="history" aria-labelledby="history-title">
        <div className="cx-section__head">
          <div>
            <h2 className="cx-section__title" id="history-title">Booking History &amp; Archived Terminals</h2>
            <p className="cx-card__subtitle">Executed bookings, fee reconciliations and parking duration.</p>
          </div>
          <button type="button" className="cx-link" onClick={() => soon('Statement export')}>
            <Download size={15} aria-hidden style={{ verticalAlign: '-2px' }} /> Export statement (CSV/PDF)
          </button>
        </div>

        <div className="cx-card" style={{ padding: 0 }}>
          {history.length === 0 ? (
            <p className="cx-empty" style={{ margin: '1.25rem' }}>No bookings match this filter.</p>
          ) : (
            <div className="cx-table-wrap">
              <table className="cx-table">
                <thead>
                  <tr>
                    <th scope="col">Booking ID</th>
                    <th scope="col">Facility hub</th>
                    <th scope="col">Vehicle</th>
                    <th scope="col">Reserved slot</th>
                    <th scope="col">Date &amp; duration</th>
                    <th scope="col">Deposit / final fee</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="cx-table__right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((b) => {
                    const vehicle = vehicleFor(b)
                    const cancelled = b.status === 'CANCELLED'
                    return (
                      <tr key={b.id}>
                        <td className="cx-mono" style={{ color: cancelled ? 'var(--cx-muted)' : 'var(--cx-primary)', fontWeight: 700 }}>#{b.id}</td>
                        <td>
                          <strong>{b.lotName}</strong>
                          <span className="cx-table__sub">{b.address}</span>
                        </td>
                        <td>
                          <strong className="cx-mono">{vehicle?.licensePlate ?? '—'}</strong>
                          <span className="cx-table__sub">{b.bayType}</span>
                        </td>
                        <td><span className="cx-plate" style={{ fontSize: '0.75rem' }}>Bay {b.bay}</span></td>
                        <td>
                          {relativeDay(b.start, now)}
                          <span className="cx-table__sub">
                            {cancelled ? `${time.format(b.start)} (Cancelled)` : `${time.format(b.start)} – ${time.format(b.end)} (${duration(b.start, b.end)})`}
                          </span>
                        </td>
                        <td>
                          <strong className="cx-table__num" style={{ color: cancelled ? 'var(--cx-gold)' : undefined }}>{vnd(b.finalFee ?? b.deposit)}</strong>
                          <span className="cx-table__sub">{cancelled ? '100% refund credited' : `${vnd(b.deposit)} deposit applied`}</span>
                        </td>
                        <td>
                          <span className={`cx-chip ${cancelled ? 'cx-chip--muted' : ''}`}>{cancelled ? 'Cancelled' : 'Completed'}</span>
                        </td>
                        <td className="cx-table__right">
                          <button type="button" className="cx-btn cx-btn--sm" onClick={() => soon(cancelled ? 'Refund details' : 'E-receipts')}>
                            {cancelled ? <Info aria-hidden /> : <ReceiptText aria-hidden />} {cancelled ? 'Refund details' : 'View e-receipt'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <div className="cx-info-cards">
        {[
          { icon: ScanLine, title: 'Automatic ANPR check-in', text: 'Entrance barriers read your registered plate on approach. No paper tickets required.' },
          { icon: Zap, title: 'Direct deductible deposits', text: 'Reservation deposits are deducted from your parking fee at the exit gate.' },
          { icon: Headset, title: 'HCMC concierge', text: 'Running late or need another bay? Call the terminal operators from the dashboard.' },
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
