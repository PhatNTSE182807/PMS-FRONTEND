import { useState } from 'react'
import { BadgeDollarSign, Download } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox, Input, Label, NativeSelect } from '@/components/ui/form-controls'
import { EmptyState, ErrorState, Spinner } from '@/components/ui/states'
import { usePayAdjustment, usePayAll, usePayrollReport } from '@/hooks/usePayroll'
import { useParkingLots } from '@/hooks/useParking'
import { EMPLOYMENT_LABEL, monthLabel } from '@/lib/duty'
import { formatDate, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PayKind, PaySlip, PayStatus } from '@/types/payroll.dto'
import { PayslipDetail, SlipStatus } from './PayslipDetail'
import { t, tMaybe } from '@/i18n'

function previousMonth(): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function downloadCsv(month: string, slips: PaySlip[]) {
  const header = ['Name', 'Code', 'Lot', 'Type', 'Base', 'Deductions', 'Extra', 'Adjustments', 'Net', 'Status', 'Paid on']
  const rows = slips.map((s) => [s.employeeName, s.employeeCode, s.lotName, EMPLOYMENT_LABEL[s.kind], s.baseAmount, s.deductions, s.overtime,
    s.adjustments, s.netAmount, s.isSimulated ? 'Simulated' : s.status, s.paidAt ? formatDate(s.paidAt) : ''])
  const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([String.fromCharCode(0xfeff) + csv], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `payroll-${month}.csv` })
  a.click()
  URL.revokeObjectURL(url)
}

function AdjustmentForm({ slip }: { slip: PaySlip }) {
  const adjust = usePayAdjustment()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [nextMonth] = useState(() => {
    const [y, m] = slip.month.split('-').map(Number)
    return slip.status === 'Paid' && !slip.isSimulated ? `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01` : slip.month
  })
  if (slip.isSimulated) return null
  return (
    <form className="space-y-2 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200" onSubmit={(e) => {
      e.preventDefault()
      adjust.mutate({ employeeId: slip.employeeId, month: nextMonth, amount: Number(amount), reason }, { onSuccess: () => { setAmount(''); setReason('') } })
    }}>
      <p className="text-sm font-semibold text-slate-800">{t('Add an adjustment to')}{' '}{tMaybe(monthLabel(nextMonth))}</p>
      <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
        <Input type="number" step={1000} placeholder={t('± amount')} aria-label={t('Adjustment amount')} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input maxLength={500} placeholder={t('Reason')} aria-label={t('Adjustment reason')} value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button type="submit" size="sm" className="h-9" disabled={adjust.isPending || !Number(amount) || !reason.trim()}>{t('Add')}</Button>
      </div>
    </form>
  )
}

/** Admin: payslips of everyone for a month, paying a finished month in one action, and the payment history. */
export function AdminPayroll() {
  const [month, setMonth] = useState(previousMonth)
  const [lotId, setLotId] = useState('')
  const [kind, setKind] = useState<PayKind | ''>('')
  const [status, setStatus] = useState<PayStatus | ''>('')
  const [includeSimulated, setIncludeSimulated] = useState(true)
  const [open, setOpen] = useState<PaySlip | null>(null)
  const lots = useParkingLots()
  const report = usePayrollReport({
    month: `${month}-01`, lotId: lotId ? Number(lotId) : undefined, kind: kind || undefined, status: status || undefined, includeSimulated,
  })
  const payAll = usePayAll()
  const data = report.data
  const openSlip = open && data ? data.slips.find((s) => s.id === open.id && s.isSimulated === open.isSimulated) ?? open : open

  return (
    <div className="space-y-6">
      <PageHeader title={t('Payroll')}
        actions={<BadgeDollarSign className="size-9 text-indigo-700" />} />

      <Card className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[10rem_1fr_10rem_10rem_auto] lg:items-end">
        <Label className="grid gap-1">{t('Month')}<Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></Label>
        <Label className="grid gap-1">{t('Parking lot')}
          <NativeSelect value={lotId} onChange={(e) => setLotId(e.target.value)}>
            <option value="">{t('All lots')}</option>
            {(lots.data ?? []).map((l) => <option key={l.id} value={l.id}>{tMaybe(l.name)}</option>)}
          </NativeSelect>
        </Label>
        <Label className="grid gap-1">{t('Type')}
          <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as PayKind | '')}>
            <option value="">{t('Everyone')}</option><option value="FullTime">{t('Full-time Staff')}</option><option value="Backup">{t('Backup Staff')}</option><option value="Manager">{t('Managers')}</option>
          </NativeSelect>
        </Label>
        <Label className="grid gap-1">{t('Status')}
          <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as PayStatus | '')}>
            <option value="">{t('Any')}</option><option value="Unpaid">{t('Unpaid')}</option><option value="Paid">{t('Paid')}</option>
          </NativeSelect>
        </Label>
        <Label className="flex h-9 items-center gap-2"><Checkbox checked={includeSimulated} onChange={(e) => setIncludeSimulated(e.target.checked)} />{t('Include simulated')}</Label>
      </Card>

      {data && data.monthEnded && data.unpaidCount > 0 && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
          <p className="min-w-0 flex-1 text-sm font-semibold text-amber-900">
            {tMaybe(monthLabel(data.month))}{' '}{t('payroll is ready · {unpaidCount} people · {unpaidTotal}', { unpaidCount: data.unpaidCount, unpaidTotal: formatVnd(data.unpaidTotal) })}
          </p>
          <Button variant="success" disabled={payAll.isPending} onClick={() => payAll.mutate(`${month}-01`)}>{payAll.isPending && <Spinner />}{t('Pay all')}</Button>
        </div>
      )}
      {data && !data.monthEnded && (
        <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-200">{tMaybe(monthLabel(data.month))}{' '}{t('has not ended: amounts are estimates so far.')}</p>
      )}

      <Card className="overflow-hidden">
        {report.isPending ? <div className="p-6"><Spinner /></div> : report.isError ? (
          <ErrorState message={tMaybe(getErrorMessage(report.error))} onRetry={() => report.refetch()} />
        ) : data!.slips.length === 0 ? (
          <EmptyState icon={BadgeDollarSign} title={t('No payslips')} description={t('Nobody matches these filters for this month.')} />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <p className="text-sm text-slate-700">
                {t('Paid')}{' '}<strong>{formatVnd(data!.paidTotal)}</strong>{' '}{t('· Unpaid')}{' '}<strong>{formatVnd(data!.unpaidTotal)}</strong>
                {includeSimulated && <>{' '}{t('· Simulated')}{' '}<strong>{formatVnd(data!.simulatedTotal)}</strong></>}
              </p>
              <Button size="sm" variant="outline" onClick={() => downloadCsv(month, data!.slips)}><Download />{t('Export CSV')}</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                  <tr>{['Name', 'Lot', 'Type', 'Base', 'Deductions', 'Extra', 'Adjust.', 'Net', 'Status', 'Paid on'].map((h) => (
                    <th key={h} scope="col" className={cn('px-4 py-2', ['Base', 'Deductions', 'Extra', 'Adjust.', 'Net'].includes(h) && 'text-right')}>{tMaybe(h)}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data!.slips.map((s) => (
                    <tr key={`${s.isSimulated ? 's' : 'r'}${s.id || s.employeeId}`} className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen(s)}>
                      <td className="px-4 py-2.5 font-semibold whitespace-nowrap text-slate-900">{tMaybe(s.employeeName)}<span className="block text-xs font-normal text-slate-500">{tMaybe(s.employeeCode)}</span></td>
                      <td className="px-4 py-2.5 text-slate-700">{tMaybe(s.lotName) ?? '—'}</td>
                      <td className="px-4 py-2.5 text-slate-700">{tMaybe(EMPLOYMENT_LABEL[s.kind])}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatVnd(s.baseAmount)}</td>
                      <td className="px-4 py-2.5 text-right text-rose-700 tabular-nums">{s.deductions ? `−${formatVnd(s.deductions)}` : '—'}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{s.overtime ? formatVnd(s.overtime) : '—'}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{s.adjustments ? formatVnd(s.adjustments) : '—'}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-950 tabular-nums">{formatVnd(s.netAmount)}</td>
                      <td className="px-4 py-2.5"><SlipStatus slip={s} /></td>
                      <td className="px-4 py-2.5 text-slate-700">{s.paidAt ? formatDate(s.paidAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
      {openSlip && (
        <PayslipDetail slip={openSlip} onClose={() => setOpen(null)}>
          {openSlip.status !== 'Estimate' && <AdjustmentForm key={openSlip.id} slip={openSlip} />}
        </PayslipDetail>
      )}
    </div>
  )
}
