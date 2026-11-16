import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { attendancePeriodsApi as api } from '@/api/attendancePeriods.service'
import { getErrorMessage } from '@/api/apiError'
import { useAuth } from '@/hooks/useAuth'
import { useAttendanceRealtime, useScheduleMutation, workSchedulingKeys } from '@/hooks/useWorkScheduling'
import { Button } from '@/components/ui/button'
import { Input, NativeSelect } from '@/components/ui/form-controls'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { matchesReview, type AttendancePeriodReview, type ReviewFilter } from '@/types/attendancePeriods.dto'
import AssignmentAttendancePanel from './AssignmentAttendancePanel'

const hours = (n: number | null) => n == null ? 'Unknown' : n.toLocaleString('en-GB', { maximumFractionDigits: 2 })
const FILTERS: [ReviewFilter, string][] = [['All', 'All assignments'], ['Late', 'Late'], ['Absent', 'Absent'], ['AutoEnded', 'Forgotten checkout / auto-ended'], ['Adjusted', 'Adjusted'], ['OvertimePending', 'Unapproved overtime']]

export function HoursSummary({ data }: { data: AttendancePeriodReview }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[960px] text-left text-xs"><caption className="mb-2 text-left font-semibold">Employee hours · {data.period.fromDate} – {data.period.toDate} · {data.lot.lotName} ({data.lot.timeZoneId})</caption>
    <thead><tr>{['Staff', 'Scheduled h', 'Original actual h', 'Current / adjusted h', 'Approved h', 'Overtime h', 'Approved overtime h', 'Paid / unpaid leave days', 'Absent shifts', 'Carry h'].map(x => <th key={x} className="border-b p-2">{x}</th>)}</tr></thead>
    <tbody>{data.employees.map(e => <tr key={e.employeeId}>{[e.staffName, hours(e.scheduledHours), hours(e.actualHours), hours(e.adjustedHours), hours(e.approvedHours), hours(e.overtimeHours), hours(e.approvedOvertimeHours), `${e.paidLeaveDays} / ${e.unpaidLeaveDays}`, e.absentShifts, hours(e.carryHours)].map((x, i) => <td key={i} className="border-b p-2">{x}</td>)}</tr>)}</tbody>
  </table><p className="mt-2 text-xs text-slate-500">Original times come from Staff clock events; unknown history stays unknown. Current hours include corrections. Regular hours require individual review or lot confirmation; overtime requires an explicit decision. Overnight hours are split at local period boundaries. Leave is counted on its start date.</p></div>
}

export default function AttendancePeriodReviewPanel({ lotId, onFilter }: { lotId: string; onFilter: (ids: ReadonlySet<number> | undefined) => void }) {
  const { user } = useAuth(); const mutation = useScheduleMutation()
  useAttendanceRealtime(lotId)
  const [open, setOpen] = useState(false); const [periodId, setPeriodId] = useState(''); const [filter, setFilter] = useState<ReviewFilter>('All')
  const [reason, setReason] = useState(''); const [detailId, setDetailId] = useState<number | null>(null)
  const [carrySource, setCarrySource] = useState(''); const [employee, setEmployee] = useState(''); const [carryHours, setCarryHours] = useState('')
  const periods = useQuery({ queryKey: [...workSchedulingKeys, user?.userId, 'attendance-periods', lotId], queryFn: () => api.list(lotId), refetchInterval: 10_000 })
  const review = useQuery({ queryKey: [...workSchedulingKeys, user?.userId, 'attendance-review', lotId, periodId], queryFn: () => api.review(Number(periodId), lotId), enabled: open && Boolean(periodId), refetchInterval: 10_000, refetchOnReconnect: 'always' })
  const sourcePeriod = periods.data?.find(p => p.lots.some(l => String(l.id) === carrySource))
  const sourceReview = useQuery({ queryKey: [...workSchedulingKeys, user?.userId, 'attendance-review', lotId, String(sourcePeriod?.id)], queryFn: () => api.review(sourcePeriod!.id, lotId), enabled: open && Boolean(sourcePeriod) })
  const rows = useMemo(() => review.data?.rows.filter(r => matchesReview(r, filter)) ?? [], [review.data, filter])
  const ids = useMemo(() => open && periodId ? new Set(rows.map(r => r.assignmentId)) : undefined, [open, periodId, rows])
  useEffect(() => { onFilter(ids) }, [ids, onFilter])
  const data = review.data; const locked = data?.lot.status === 'Locked'
  return <section className="space-y-3 border-y border-slate-200 bg-slate-50 p-4" aria-label="Attendance period review">
    <Button variant="outline" aria-expanded={open} onClick={() => setOpen(v => !v)}>{open ? 'Close attendance review' : 'Review attendance by period'}</Button>
    {open && <>
      <p className="text-xs text-slate-600">Select a period explicitly. Calendar Day / Week / Month changes the view only. The calendar retains its dates and scroll position; review totals cover all published rosters in the selected period and lot.</p>
      <div className="flex flex-wrap gap-3"><label className="grid gap-1 text-sm">Attendance period<NativeSelect aria-label="Review attendance period" value={periodId} onChange={e => { setPeriodId(e.target.value); setReason('') }}><option value="">Select period</option>{periods.data?.map(p => <option key={p.id} value={p.id}>{p.name} · {p.fromDate} – {p.toDate} · {p.lots.find(l => String(l.parkingLotId) === lotId)?.status}</option>)}</NativeSelect></label>
        <label className="grid gap-1 text-sm">Review filter<NativeSelect aria-label="Attendance review filter" value={filter} onChange={e => setFilter(e.target.value as ReviewFilter)}>{FILTERS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</NativeSelect></label></div>
      {periods.data?.length === 0 && <p className="text-sm">No attendance period for this lot. Admin creates the explicit period and lot scope.</p>}
      {data && <>
        <p className="font-semibold">{data.lot.lotName} · {data.period.name} · {data.period.fromDate} – {data.period.toDate} · {data.lot.status}{locked && ' · Read only'}</p>
        {data.warnings.length > 0 && <ul className="list-inside list-disc rounded bg-amber-50 p-3 text-sm text-amber-900">{data.warnings.map(w => <li key={w}>{w}</li>)}</ul>}
        <HoursSummary data={data} />
        <details><summary className="cursor-pointer text-sm font-semibold">Matching assignments across this period ({rows.length})</summary><div className="mt-2 flex max-h-52 flex-wrap gap-2 overflow-auto">{rows.map(r => <button key={r.assignmentId} className="rounded border bg-white p-2 text-left text-xs" onClick={() => setDetailId(r.assignmentId)}>{r.workDate} · {r.staffName} · {r.shiftName} · {r.attendance.status}{r.attendance.isLate && ' · Late'}{r.attendance.autoEnded && ' · Auto-ended'}{r.pay.hasAdjustments && ' · Adjusted'}{r.pay.overtimeStatus === 'Pending' && ' · Overtime pending'}</button>)}</div></details>
        {!locked && <>
          <label className="grid gap-1 text-sm">Review / adjustment reason<Input aria-label="Period review reason" value={reason} maxLength={1000} onChange={e => setReason(e.target.value)} /></label>
          <Button disabled={mutation.isPending || review.isFetching || !reason.trim() || data.warnings.length > 0 || data.lot.status === 'Confirmed'} onClick={() => mutation.mutate(() => api.confirm(data.period.id, lotId, { revision: data.lot.revision, reason }))}>Confirm {data.period.name} · {data.lot.lotName}</Button>
          <details><summary className="cursor-pointer text-sm font-semibold">Approve an adjustment from a locked earlier period</summary><div className="mt-2 flex flex-wrap items-end gap-2">
            <NativeSelect aria-label="Carry adjustment source period" value={carrySource} onChange={e => setCarrySource(e.target.value)}><option value="">Locked source period</option>{periods.data?.filter(p => p.status === 'Locked' && p.toDate < data.period.fromDate).flatMap(p => p.lots.filter(l => String(l.parkingLotId) === lotId).map(l => <option key={l.id} value={l.id}>{p.name}</option>))}</NativeSelect>
            <NativeSelect aria-label="Carry adjustment Staff" value={employee} onChange={e => setEmployee(e.target.value)}><option value="">Staff in locked source</option>{sourceReview.data?.employees.map(e => <option key={e.employeeId} value={e.employeeId}>{e.staffName}</option>)}</NativeSelect>
            <Input aria-label="Carry adjustment hours" type="number" step="0.0001" placeholder="Hours (+ / −)" value={carryHours} onChange={e => setCarryHours(e.target.value)} />
            <Button variant="outline" disabled={mutation.isPending || review.isFetching || !carrySource || !sourceReview.data?.employees.some(e => String(e.employeeId) === employee) || !Number(carryHours) || !reason.trim()} onClick={() => mutation.mutate(() => api.carry(data.lot.id, { revision: data.lot.revision, sourcePeriodLotId: Number(carrySource), employeeId: Number(employee), hours: Number(carryHours), reason }), { onSuccess: () => setCarryHours('') })}>Approve carry adjustment</Button>
          </div><p className="text-xs text-slate-500">The locked source remains unchanged; this invalidates confirmation of the target period. Add a compensating entry to correct a previous carry adjustment.</p></details>
        </>}
        {data.adjustments.length > 0 && <ul className="text-xs">{data.adjustments.map(a => <li key={a.id}>Adjustment #{a.id} · Staff #{a.employeeId} · {hours(a.hours)} h · {a.reason}</li>)}</ul>}
        <details><summary className="cursor-pointer text-sm">Period audit history ({data.history.length})</summary><ul className="max-h-44 overflow-auto text-xs">{data.history.map(h => <li key={h.id}>{h.createdAt} · {h.action} · {h.actorId} · {h.reason}</li>)}</ul></details>
      </>}
      {(review.isError || periods.isError || mutation.isError) && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(review.error ?? periods.error ?? mutation.error)}</p>}
      {review.isFetching && <p role="status" className="text-xs">Refreshing attendance review…</p>}
    </>}
    <Dialog open={detailId !== null} onOpenChange={v => { if (!v) setDetailId(null) }}><DialogContent className="max-w-xl"><DialogTitle>Review assignment attendance</DialogTitle><DialogDescription>Inspect evidence, corrections and overtime for this published assignment.</DialogDescription>{detailId !== null && <AssignmentAttendancePanel assignmentId={detailId} />}</DialogContent></Dialog>
  </section>
}
