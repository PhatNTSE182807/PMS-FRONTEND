import { useState } from 'react'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { parkingHistoryService } from '@/api/parkingHistory.service'
import { useParkingHistory } from '@/hooks/useParkingHistory'
import { formatNumber } from '@/lib/format'
import { formatDuration, showReceipt } from '@/lib/parkingReceipt'
import type { ParkingHistoryItemDTO } from '@/types/parkingHistory.dto'
import { t, tMaybe, localDateFormat } from '@/i18n'

const PAGE_SIZE = 5

const dateTime = localDateFormat({ day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

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
    if (!target) return toast.error(t('Allow pop-ups for this site to open the receipt.'))
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
    <button type="button" className="cx-btn cx-btn--sm" disabled={loading} onClick={() => void open()} aria-label={t('PDF receipt {receiptNumber}', { receiptNumber: item.receiptNumber })}>
      {loading ? <Loader2 className="cx-spin" aria-hidden /> : <Download aria-hidden />}{' '}{t('PDF receipt')}
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
          <h2 className="cx-card__title" id="history-title">{t('Recent Parking Sessions & Receipts')}</h2>
          <p className="cx-card__subtitle">
            {data?.totalCount
              ? t('{totalCount} finished {v} • {v2} VND in total', { totalCount: data.totalCount, v: data.totalCount === 1 ? 'session' : 'sessions', v2: formatNumber(data.totalSpent) })
              : t('Your finished parking sessions and e-receipts')}
          </p>
        </div>
      </div>

      {isPending ? (
        <div className="cx-skeleton" style={{ height: '12rem' }} />
      ) : isError ? (
        <div className="cx-empty">
          <p className="cx-error" role="alert">{tMaybe(getErrorMessage(error, 'Could not load your parking history.'))}</p>
          <button type="button" className="cx-btn cx-btn--sm" onClick={() => void refetch()}>{t('Try again')}</button>
        </div>
      ) : items.length === 0 ? (
        <p className="cx-empty">{t('No finished sessions yet. They appear here once your vehicle leaves a lot.')}</p>
      ) : (
        <>
          <div className="cx-table-wrap" style={{ opacity: isPlaceholderData ? 0.6 : 1 }} aria-busy={isPlaceholderData}>
            <table className="cx-table">
              <thead>
                <tr>
                  <th scope="col">{t('Timeline')}</th>
                  <th scope="col">{t('Terminal & stall')}</th>
                  <th scope="col">{t('Vehicle')}</th>
                  <th scope="col">{t('Duration')}</th>
                  <th scope="col">{t('Amount')}</th>
                  <th scope="col">{t('Status')}</th>
                  <th scope="col" className="cx-table__right">{t('E-receipt')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => {
                  const status = STATUS[s.status] ?? { label: s.status, className: 'cx-chip--muted' }
                  return (
                    <tr key={s.sessionId}>
                      <td>
                        {dateTime.format(new Date(s.exitTime ?? s.entryTime))}
                        <span className="cx-table__sub">{t('In {v}', { v: dateTime.format(new Date(s.entryTime)) })}</span>
                      </td>
                      <td>
                        <strong>{tMaybe(s.lotName) ?? t('Parking lot')}</strong>
                        <span className="cx-table__sub">
                          {[s.lotDistrict, s.slotCode ? `Stall ${s.slotCode}` : s.zoneName].filter(Boolean).join(' • ') || '—'}
                        </span>
                      </td>
                      <td className="cx-mono" style={{ color: 'var(--cx-primary)' }}>{tMaybe(s.plateNumber) ?? '—'}</td>
                      <td>{formatDuration(s.durationMinutes)}</td>
                      <td className="cx-table__num">
                        {t('{finalFee} VND', { finalFee: formatNumber(s.finalFee) })}
                        {s.depositApplied > 0 && <span className="cx-table__sub">{t('incl. {depositApplied} deposit', { depositApplied: formatNumber(s.depositApplied) })}</span>}
                      </td>
                      <td><span className={`cx-chip ${status.className}`}>{tMaybe(status.label)}</span></td>
                      <td className="cx-table__right"><ReceiptButton item={s} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <nav className="cx-pager" aria-label={t('History pages')}>
              <button type="button" className="cx-btn cx-btn--sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft aria-hidden />{' '}{t('Newer')}
              </button>
              <span>{t('Page {page} of {pages}', { page, pages })}</span>
              <button type="button" className="cx-btn cx-btn--sm" disabled={page >= pages || isPlaceholderData} onClick={() => setPage((p) => p + 1)}>
                {t('Older')}{' '}<ChevronRight aria-hidden />
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  )
}
