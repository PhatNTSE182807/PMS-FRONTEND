import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { payrollApi } from '@/api/payroll.service'
import { getErrorMessage } from '@/api/apiError'
import { useAuth } from '@/hooks/useAuth'
import { payrollKeys, usePayrollMutation } from '@/hooks/usePayroll'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form-controls'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import WorkScheduleCalendar from '@/components/features/manager/WorkScheduleCalendar'
import { AttendanceBadge } from '@/components/features/manager/AssignmentAttendancePanel'
import { attendanceTime, attendanceLocalInput } from '@/lib/workAttendance'
import { calendarRange } from '@/lib/workScheduleCalendar'
import { payrollNumber } from '@/lib/payroll'
import type { PayrollComplaint, PayrollLine } from '@/types/payroll.dto'

export function PayrollLines({ lines, currency, onSource }: { lines: PayrollLine[]; currency: string; onSource?: (lineId: number) => void }) {
  return <div className="overflow-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead><tr>{['Date / item', 'Source', 'Quantity', 'Unit', 'Rate', 'Factor', `Amount ${currency}`, ''].map((x, i) => <th key={i} className="border-b p-2">{x}</th>)}</tr></thead><tbody>{lines.map((l, i) => <tr key={l.id || i}>
    <td className="border-b p-2">{l.workDate}<strong className="block">{l.description}</strong></td><td className="border-b p-2">{l.assignmentId ? `Assignment #${l.assignmentId} · attendance v${l.attendanceRevision}` : l.standbyId ? `Standby #${l.standbyId}` : l.managerDayId ? `Manager day #${l.managerDayId}` : l.adjustmentId ? `Adjustment #${l.adjustmentId}` : 'Locked month sources'}</td>
    <td className="border-b p-2">{payrollNumber(l.quantity)}</td><td className="border-b p-2">{l.unit}</td><td className="border-b p-2">{payrollNumber(l.unitRate)}</td><td className="border-b p-2">{payrollNumber(l.factor)}</td><td className="border-b p-2 font-semibold">{payrollNumber(l.amount)}</td><td className="border-b p-2">{onSource && <Button variant="outline" size="sm" onClick={() => onSource(l.id)}>{l.assignmentId ? 'View source on calendar' : 'Source explanation'}</Button>}</td>
  </tr>)}</tbody></table></div>
}

function FrozenSource({ slipId, lineId, close }: { slipId: number; lineId: number; close: () => void }) {
  const { user } = useAuth()
  const query = useQuery({ queryKey: [...payrollKeys, user?.userId, 'source', slipId, lineId], queryFn: () => payrollApi.source(slipId, lineId) })
  const source = query.data; const a = source?.assignment
  const [expanded, setExpanded] = useState(true)
  return <Dialog open onOpenChange={v => { if (!v) close() }}><DialogContent className="max-w-6xl"><DialogTitle>Frozen payroll source</DialogTitle><DialogDescription>Read-only evidence used by this payslip. Shift template changes do not change this explanation.</DialogDescription>
    {source && <div className="space-y-4"><p className="font-semibold">{source.line.description} · {source.line.quantity} {source.line.unit} × {source.line.unitRate} × {source.line.factor} = {source.line.amount}</p>
      {source.roster && a && <WorkScheduleCalendar rosters={[source.roster]} range={calendarRange(source.roster.fromDate, 'day')} search="" today="" onAssignment={() => setExpanded(v => !v)} />}
      {a && expanded && <div className="space-y-2 rounded border p-3 text-sm"><h3 className="font-semibold">{a.staffName} · {a.shiftName} · attendance revision {a.attendanceRevision}</h3><AttendanceBadge value={a.attendance} />
        <p>Planned: {attendanceTime(a.plannedStart, a.timeZoneId)} → {attendanceTime(a.plannedEnd, a.timeZoneId)}</p><p>Current / corrected at lock: {attendanceTime(a.actualStart, a.timeZoneId)} → {attendanceTime(a.actualEnd, a.timeZoneId)}</p>
        <p>This payroll line: {attendanceTime(source.line.startsAt, a.timeZoneId)} → {attendanceTime(source.line.endsAt, a.timeZoneId)}</p>
        <details><summary className="cursor-pointer font-semibold">Frozen attendance history</summary><ul className="max-h-48 space-y-2 overflow-auto text-xs">{(JSON.parse(a.attendanceHistoryJson) as { Id: number; Action: string; Reason: string; CreatedAt: string }[]).map(h => <li key={h.Id}>{attendanceTime(h.CreatedAt, a.timeZoneId)} · {h.Action} · {h.Reason}</li>)}</ul></details>
      </div>}
      <p className="text-xs text-slate-500">Attendance period source #{source.line.sourcePeriodLotId} · profile version #{source.line.profileId}. Each line retains the rate, factor and source interval used in calculation.</p>
    </div>}
    {query.isError && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(query.error)}</p>}
  </DialogContent></Dialog>
}

function ComplaintDecision({ complaint }: { complaint: PayrollComplaint }) {
  const save = usePayrollMutation(); const [reason, setReason] = useState(''); const [month, setMonth] = useState(''); const [quantity, setQuantity] = useState(''); const [rate, setRate] = useState('')
  return <div className="space-y-2 rounded border p-3 text-sm"><p>Complaint #{complaint.id}: {complaint.reason}</p><label className="grid gap-1">Resolution reason<Input aria-label={`Complaint ${complaint.id} resolution reason`} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
    <div className="flex flex-wrap gap-2"><Input aria-label={`Complaint ${complaint.id} target month`} type="month" value={month} onChange={e => setMonth(e.target.value)} /><Input aria-label={`Complaint ${complaint.id} correction quantity`} type="number" step="0.000001" placeholder="Signed quantity" value={quantity} onChange={e => setQuantity(e.target.value)} /><Input aria-label={`Complaint ${complaint.id} correction rate`} type="number" step="0.000001" min="0" placeholder="Unit rate" value={rate} onChange={e => setRate(e.target.value)} /></div>
    <div className="flex gap-2"><Button variant="outline" size="sm" disabled={save.isPending || !reason.trim()} onClick={() => save.mutate(() => payrollApi.resolve(complaint.id, { revision: complaint.revision, action: 'Reject', reason }))}>Reject complaint</Button><Button size="sm" disabled={save.isPending || !reason.trim() || !month || !Number(quantity) || rate === ''} onClick={() => save.mutate(() => payrollApi.resolve(complaint.id, { revision: complaint.revision, action: 'Accept', reason, adjustment: { payMonth: `${month}-01`, quantity: Number(quantity), unitRate: Number(rate), reason } }))}>Accept and create subsequent-month adjustment</Button></div>
    {save.isError && <p role="alert" className="text-rose-700">{getErrorMessage(save.error)}</p>}
  </div>
}

export default function PayrollSlipDialog({ id, close }: { id: number; close: () => void }) {
  const { user } = useAuth(); const save = usePayrollMutation(); const admin = user?.role === 'ADMIN'
  const [reason, setReason] = useState(''); const [paidAt, setPaidAt] = useState(''); const [transaction, setTransaction] = useState(''); const [sourceLine, setSourceLine] = useState<number | null>(null)
  const query = useQuery({ queryKey: [...payrollKeys, user?.userId, 'detail', id], queryFn: () => payrollApi.detail(id), refetchOnReconnect: 'always' })
  const data = query.data; const slip = data?.slip
  return <Dialog open onOpenChange={v => { if (!v) close() }}><DialogContent className="max-w-6xl"><DialogTitle>Payslip details</DialogTitle><DialogDescription>Explainable salary from locked attendance and effective salary profiles.</DialogDescription>
    {data && slip && <div className="space-y-4"><div><h3 className="text-xl font-semibold">{slip.employeeName} · {slip.role} · {slip.payMonth.slice(0, 7)}</h3><p>{slip.status} · revision {slip.revision} · <strong>{payrollNumber(slip.total)} {slip.currency}</strong></p>{slip.paidAt && <p>External payment: {slip.paidAt} · transaction {slip.transactionReference}</p>}</div>
      {data.stale && <p role="alert" className="rounded bg-amber-50 p-3 text-sm text-amber-900">Salary inputs changed. Recalculate this Draft before approving.</p>}
      <PayrollLines lines={data.lines} currency={slip.currency} onSource={setSourceLine} />
      {admin && slip.status !== 'Paid' && <div className="space-y-3 rounded border p-3"><label className="grid gap-1 text-sm">Action reason<Input aria-label="Payroll action reason" required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
        {slip.status === 'Draft' ? <Button disabled={save.isPending || query.isFetching || data.stale || !reason.trim()} onClick={() => save.mutate(() => payrollApi.action(id, 'approve', { revision: slip.revision, reason }))}>Approve frozen payslip</Button> : <>
          <p className="text-xs text-slate-600">Record a completed external transfer. This action does not transfer money. Date/time uses your device time zone.</p>
          <label className="grid gap-1 text-sm">External payment date/time<Input aria-label="External payroll payment time" type="datetime-local" step="1" required value={paidAt} onChange={e => setPaidAt(e.target.value)} /></label>
          <Button variant="outline" size="sm" onClick={() => setPaidAt(attendanceLocalInput(new Date().toISOString()))}>Use current payment time</Button>
          <label className="grid gap-1 text-sm">Transaction reference<Input aria-label="Payroll transaction reference" required maxLength={200} value={transaction} onChange={e => setTransaction(e.target.value)} /></label>
          <Button disabled={save.isPending || query.isFetching || !reason.trim() || !paidAt || !transaction.trim()} onClick={() => save.mutate(() => payrollApi.action(id, 'paid', { revision: slip.revision, reason, paidAt: new Date(paidAt).toISOString(), transactionReference: transaction }))}>Mark external payment as Paid</Button>
        </>}
      </div>}
      {slip.status === 'Paid' && <p className="rounded border p-3 text-sm font-semibold">Paid · amounts and source explanations are immutable. Corrections are separate entries in subsequent months.</p>}
      {!admin && slip.userId === user?.userId && !data.complaints.some(c => c.status === 'Open') && <form className="space-y-2" onSubmit={e => { e.preventDefault(); save.mutate(() => payrollApi.complain(id, reason), { onSuccess: () => setReason('') }) }}><label className="grid gap-1 text-sm">Explain your payroll complaint<Input aria-label="Payroll complaint reason" required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label><Button type="submit" disabled={save.isPending || !reason.trim()}>Submit payroll complaint</Button></form>}
      {data.complaints.map(c => admin && c.status === 'Open' ? <ComplaintDecision key={c.id} complaint={c} /> : <p key={c.id} className="rounded border p-3 text-sm">Complaint #{c.id} · {c.status} · {c.reason}{c.resolutionReason && ` · ${c.resolutionReason}`}{c.adjustmentId && ` · adjustment #${c.adjustmentId}`}</p>)}
      {admin && <details><summary className="cursor-pointer text-sm font-semibold">Payroll audit history</summary><ul className="max-h-48 space-y-2 overflow-auto text-xs">{data.history.map(h => <li key={h.id}>{h.createdAt} · {h.action} · {h.reason}</li>)}</ul></details>}
    </div>}
    {(query.isError || save.isError) && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(query.error ?? save.error)}</p>}
    {sourceLine !== null && <FrozenSource slipId={id} lineId={sourceLine} close={() => setSourceLine(null)} />}
  </DialogContent></Dialog>
}
