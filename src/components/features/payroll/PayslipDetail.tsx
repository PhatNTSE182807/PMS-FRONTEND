import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { EMPLOYMENT_LABEL, monthLabel } from '@/lib/duty'
import { formatDate, formatVnd } from '@/lib/format'
import { payLineLabel } from '@/lib/payrollLabels'
import { cn } from '@/lib/utils'
import type { PaySlip } from '@/types/payroll.dto'
import type { ReactNode } from 'react'
import { t, tMaybe } from '@/i18n'


export function SlipStatus({ slip }: { slip: PaySlip }) {
  if (slip.isSimulated) return <Badge tone="violet">{t('Simulated')}</Badge>
  if (slip.status === 'Paid') return <Badge tone="emerald">{t('Paid')}</Badge>
  if (slip.status === 'Estimate') return <Badge tone="sky">{t('Estimate')}</Badge>
  return <Badge tone="amber">{t('Unpaid')}</Badge>
}

/** One payslip line by line: base salary, deductions with their dates, extra hours with their shifts. */
export function PayslipDetail({ slip, onClose, children }: { slip: PaySlip; onClose: () => void; children?: ReactNode }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <div>
          <p className="text-xs font-bold tracking-wide text-indigo-700 uppercase">{tMaybe(monthLabel(slip.month))}</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">{tMaybe(slip.employeeName)}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <SlipStatus slip={slip} />
            <span>{tMaybe(EMPLOYMENT_LABEL[slip.kind])}{slip.lotName ? ` · ${slip.lotName}` : ''}</span>
            {slip.paidAt && <span>{t('· Received {paidAt}', { paidAt: formatDate(slip.paidAt) })}</span>}
          </div>
        </div>
        <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
          {slip.lines.map((line, i) => (
            <li key={i} className="px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm text-slate-800">{payLineLabel(line.label)}</span>
                <span className={cn('text-sm font-semibold whitespace-nowrap tabular-nums', line.amount < 0 ? 'text-rose-700' : 'text-slate-950')}>
                  {line.amount > 0 && line.kind !== 'Base' && line.kind !== 'NetFloor' ? '+' : ''}{formatVnd(line.amount)}
                </span>
              </div>
              {line.details.length > 0 && <p className="mt-1 text-xs text-slate-500">{line.details.map(payLineLabel).join(' · ')}</p>}
            </li>
          ))}
          {slip.lines.length === 0 && <li className="px-3 py-2.5 text-sm text-slate-600">{t('Nothing earned this month.')}</li>}
        </ul>
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-3 ring-1 ring-slate-200">
          <span className="font-semibold text-slate-800">{t('Net pay')}</span>
          <span className="text-lg font-bold text-slate-950 tabular-nums">{formatVnd(slip.netAmount)}</span>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  )
}
