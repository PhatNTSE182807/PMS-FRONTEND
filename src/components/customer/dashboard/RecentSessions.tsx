import { useState } from 'react'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { parkingHistoryService } from '@/api/parkingHistory.service'
import { useParkingHistory } from '@/hooks/useParkingHistory'
import { formatNumber } from '@/lib/format'
import { formatDuration, showReceipt } from '@/lib/parkingReceipt'
import type { ParkingHistoryItemDTO } from '@/types/parkingHistory.dto'

const PAGE_SIZE = 5

const dateTime = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const STATUS: Record<ParkingHistoryItemDTO['status'], { label: string; className: string }> = {
  Completed: { label: 'Completed', className: '' },
  EmergencyExit: { label: 'Emergency exit', className: 'cx-chip--gold' },
  AbnormalClosed: { label: 'Closed by staff', className: 'cx-chip--muted' },
}

/** Opens the e-receipt of one session in a new tab, ready to print or save as PDF. */
function ReceiptButton({ item }: { item: ParkingHistoryItemDTO }) {
  const [loading, setLoading] = useState(false)

  const open = async () => {
    // Opened right away so pop-up blockers treat it as the click's own window
    const target = window.open('', '_blank')
    if (!target) return toast.error('Allow pop-ups for this site to open the receipt.')
    target.document.title = 'Loading receipt…'
    setLoading(true)
    try {
      showReceipt(target, await parkingHistoryService.getReceipt(item.sessionId))
    } catch (error) {
      target.close()
      toast.error(getErrorMessage(error, 'Could not load the receipt.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <button type="button" className="cx-btn cx-btn--sm" disabled={loading} onClick={() => void open()} aria-label={`PDF receipt ${item.receiptNumber}`}>
      {loading ? <Loader2 className="cx-spin" aria-hidden /> : <Download aria-hidden />} PDF receipt
    </button>
  )
}

/** The customer's finished parking sessions (GET /parking-sessions/history), newest first, with e-receipts. */
export function RecentSessions() {
  const [page, setPage] = useState(1)
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useParkingHistory({ page, pageSize: PAGE_SIZE })
  const items = data?.items ?? []
  const pages = data ? Math.max(1, Math.ceil(data.totalCount / data.pageSize)) : 1

  return (
    <section className="cx-card" id="history" aria-labelledby="history-title">
      <div className="cx-card__head">
        <div>
          <h2 className="cx-card__title" id="history-title">Recent Parking Sessions &amp; Receipts</h2>
          <p className="cx-card__subtitle">
            {data?.totalCount
              ? `${data.totalCount} finished ${data.totalCount === 1 ? 'session' : 'sessions'} • ${formatNumber(data.totalSpent)} VND in total`
              : 'Your finished parking sessions and e-receipts'}
          </p>
        </div>
      </div>

      {isPending ? (
        <div className="cx-skeleton" style={{ height: '12rem' }} />
      ) : isError ? (
        <div className="cx-empty">
          <p className="cx-error" role="alert">{getErrorMessage(error, 'Could not load your parking history.')}</p>
          <button type="button" className="cx-btn cx-btn--sm" onClick={() => void refetch()}>Try again</button>
        </div>
      ) : items.length === 0 ? (
        <p className="cx-empty">No finished sessions yet. They appear here once your vehicle leaves a lot.</p>
      ) : (
        <>
          <div className="cx-table-wrap" style={{ opacity: isPlaceholderData ? 0.6 : 1 }} aria-busy={isPlaceholderData}>
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
                {items.map((s) => {
                  const status = STATUS[s.status] ?? { label: s.status, className: 'cx-chip--muted' }
                  return (
                    <tr key={s.sessionId}>
                      <td>
                        {dateTime.format(new Date(s.exitTime ?? s.entryTime))}
                        <span className="cx-table__sub">In {dateTime.format(new Date(s.entryTime))}</span>
                      </td>
                      <td>
                        <strong>{s.lotName ?? 'Parking lot'}</strong>
                        <span className="cx-table__sub">
                          {[s.lotDistrict, s.slotCode ? `Stall ${s.slotCode}` : s.zoneName].filter(Boolean).join(' • ') || '—'}
                        </span>
                      </td>
                      <td className="cx-mono" style={{ color: 'var(--cx-primary)' }}>{s.plateNumber ?? '—'}</td>
                      <td>{formatDuration(s.durationMinutes)}</td>
                      <td className="cx-table__num">
                        {formatNumber(s.finalFee)} VND
                        {s.depositApplied > 0 && <span className="cx-table__sub">incl. {formatNumber(s.depositApplied)} deposit</span>}
                      </td>
                      <td><span className={`cx-chip ${status.className}`}>{status.label}</span></td>
                      <td className="cx-table__right"><ReceiptButton item={s} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <nav className="cx-pager" aria-label="History pages">
              <button type="button" className="cx-btn cx-btn--sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft aria-hidden /> Newer
              </button>
              <span>Page {page} of {pages}</span>
              <button type="button" className="cx-btn cx-btn--sm" disabled={page >= pages || isPlaceholderData} onClick={() => setPage((p) => p + 1)}>
                Older <ChevronRight aria-hidden />
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  )
}
