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
      <p className="text-sm font-semibold text-slate-800">Add an adjustment to {monthLabel(nextMonth)}</p>
      <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
        <Input type="number" step={1000} placeholder="± amount" aria-label="Adjustment amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input maxLength={500} placeholder="Reason" aria-label="Adjustment reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button type="submit" size="sm" className="h-9" disabled={adjust.isPending || !Number(amount) || !reason.trim()}>Add</Button>
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
      <PageHeader title="Payroll"
        actions={<BadgeDollarSign className="size-9 text-indigo-700" />} />

      <Card className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[10rem_1fr_10rem_10rem_auto] lg:items-end">
        <Label className="grid gap-1">Month<Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></Label>
        <Label className="grid gap-1">Parking lot
          <NativeSelect value={lotId} onChange={(e) => setLotId(e.target.value)}>
            <option value="">All lots</option>
            {(lots.data ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </NativeSelect>
        </Label>
        <Label className="grid gap-1">Type
          <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as PayKind | '')}>
            <option value="">Everyone</option><option value="FullTime">Full-time Staff</option><option value="Backup">Backup Staff</option><option value="Manager">Managers</option>
          </NativeSelect>
        </Label>
        <Label className="grid gap-1">Status
          <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as PayStatus | '')}>
            <option value="">Any</option><option value="Unpaid">Unpaid</option><option value="Paid">Paid</option>
          </NativeSelect>
        </Label>
        <Label className="flex h-9 items-center gap-2"><Checkbox checked={includeSimulated} onChange={(e) => setIncludeSimulated(e.target.checked)} />Include simulated</Label>
      </Card>

      {data && data.monthEnded && data.unpaidCount > 0 && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
          <p className="min-w-0 flex-1 text-sm font-semibold text-amber-900">
            {monthLabel(data.month)} payroll is ready · {data.unpaidCount} people · {formatVnd(data.unpaidTotal)}
          </p>
          <Button variant="success" disabled={payAll.isPending} onClick={() => payAll.mutate(`${month}-01`)}>{payAll.isPending && <Spinner />}Pay all</Button>
        </div>
      )}
      {data && !data.monthEnded && (
        <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-200">{monthLabel(data.month)} has not ended: amounts are estimates so far.</p>
      )}

      <Card className="overflow-hidden">
        {report.isPending ? <div className="p-6"><Spinner /></div> : report.isError ? (
          <ErrorState message={getErrorMessage(report.error)} onRetry={() => report.refetch()} />
        ) : data!.slips.length === 0 ? (
          <EmptyState icon={BadgeDollarSign} title="No payslips" description="Nobody matches these filters for this month." />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <p className="text-sm text-slate-700">
                Paid <strong>{formatVnd(data!.paidTotal)}</strong> · Unpaid <strong>{formatVnd(data!.unpaidTotal)}</strong>
                {includeSimulated && <> · Simulated <strong>{formatVnd(data!.simulatedTotal)}</strong></>}
              </p>
              <Button size="sm" variant="outline" onClick={() => downloadCsv(month, data!.slips)}><Download />Export CSV</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                  <tr>{['Name', 'Lot', 'Type', 'Base', 'Deductions', 'Extra', 'Adjust.', 'Net', 'Status', 'Paid on'].map((h) => (
                    <th key={h} scope="col" className={cn('px-4 py-2', ['Base', 'Deductions', 'Extra', 'Adjust.', 'Net'].includes(h) && 'text-right')}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data!.slips.map((s) => (
                    <tr key={`${s.isSimulated ? 's' : 'r'}${s.id || s.employeeId}`} className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen(s)}>
                      <td className="px-4 py-2.5 font-semibold whitespace-nowrap text-slate-900">{s.employeeName}<span className="block text-xs font-normal text-slate-500">{s.employeeCode}</span></td>
                      <td className="px-4 py-2.5 text-slate-700">{s.lotName ?? '—'}</td>
                      <td className="px-4 py-2.5 text-slate-700">{EMPLOYMENT_LABEL[s.kind]}</td>
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
