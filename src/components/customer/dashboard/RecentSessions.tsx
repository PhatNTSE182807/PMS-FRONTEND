import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import { demoRecentSessions } from '@/mocks/customerActivity.mock'

const dateTime = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** Past sessions. Demo rows until the parking history API exists; plates are the customer's own. */
export function RecentSessions({ plates }: { plates: string[] }) {
  return (
    <section className="cx-card" id="history" aria-labelledby="history-title">
      <div className="cx-card__head">
        <div>
          <h2 className="cx-card__title" id="history-title">
            Recent Parking Sessions &amp; Receipts <span className="cx-demo-tag">Demo</span>
          </h2>
          <p className="cx-card__subtitle">Validated automated terminal exits across Ho Chi Minh City</p>
        </div>
      </div>

      <div className="cx-table-wrap">
        <table className="cx-table">
          <thead>
            <tr>
              <th scope="col">Timeline</th>
              <th scope="col">Terminal &amp; stall</th>
              <th scope="col">Vehicle</th>
              <th scope="col">Duration</th>
              <th scope="col">Amount</th>
              <th scope="col">Status</th>
              <th scope="col" className="cx-table__right">E-receipt</th>
            </tr>
          </thead>
          <tbody>
            {demoRecentSessions.map((s, i) => (
              <tr key={s.id}>
                <td>{dateTime.format(s.endedAt)}</td>
                <td>
                  <strong>{s.lotName}</strong>
                  <span className="cx-table__sub">{s.area} • Stall {s.stall}</span>
                </td>
                <td className="cx-mono" style={{ color: 'var(--cx-primary)' }}>
                  {plates.length ? plates[i % plates.length] : '—'}
                </td>
                <td>{Math.floor(s.durationMinutes / 60)}h {s.durationMinutes % 60}m</td>
                <td className="cx-table__num">{formatNumber(s.amount)} VND</td>
                <td><span className="cx-chip">Completed</span></td>
                <td className="cx-table__right">
                  <button
                    type="button"
                    className="cx-btn cx-btn--sm"
                    onClick={() => toast.info('PDF receipts will be available with the payment service.')}
                  >
                    <Download aria-hidden /> PDF receipt
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
