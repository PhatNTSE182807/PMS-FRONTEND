import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { attendancePeriodsApi as api } from '@/api/attendancePeriods.service'
import { getErrorMessage } from '@/api/apiError'
import { useAuth } from '@/hooks/useAuth'
import { useAttendanceRealtime, useScheduleMutation, workSchedulingKeys } from '@/hooks/useWorkScheduling'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, NativeSelect } from '@/components/ui/form-controls'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import type { AttendancePeriod, ManagerDayKind } from '@/types/attendancePeriods.dto'
import { HoursSummary } from './AttendancePeriodReviewPanel'

export default function AdminAttendancePeriods() {
  const { user } = useAuth(); const change = useScheduleMutation(); useAttendanceRealtime()
  const [open, setOpen] = useState(false); const [periodId, setPeriodId] = useState(''); const [lotId, setLotId] = useState('')
  const [name, setName] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [lotIds, setLotIds] = useState<number[]>([])
  const [lock, setLock] = useState<AttendancePeriod | null>(null); const [reason, setReason] = useState(''); const [ack, setAck] = useState(false)
  const [day, setDay] = useState(''); const [kind, setKind] = useState<ManagerDayKind>('Work'); const [dayReason, setDayReason] = useState(''); const [revision, setRevision] = useState(0)
  const directory = useQuery({ queryKey: [...workSchedulingKeys, user?.userId, 'period-directory'], queryFn: api.directory, enabled: open })
  const periods = useQuery({ queryKey: [...workSchedulingKeys, user?.userId, 'attendance-periods', 'admin'], queryFn: () => api.list(), enabled: open, refetchInterval: 10_000 })
  const period = periods.data?.find(p => String(p.id) === periodId)
  const selectedLot = period?.lots.find(l => String(l.parkingLotId) === lotId)
  const review = useQuery({ queryKey: [...workSchedulingKeys, user?.userId, 'attendance-review', lotId, periodId], queryFn: () => api.review(Number(periodId), lotId), enabled: open && Boolean(selectedLot), refetchInterval: 10_000, refetchOnReconnect: 'always' })
  const managerId = directory.data?.find(l => String(l.id) === lotId)?.managerUserId
  const recorded = review.data?.managerDays.find(d => d.workDate === day && d.managerUserId === managerId)
  return <Card className="space-y-4 p-4">
    <Button variant="outline" aria-expanded={open} onClick={() => setOpen(v => !v)}>Attendance periods and Manager workdays</Button>
    {open && <>
      <p className="text-sm text-slate-600">Admin creates the explicit period and lot scope, records Manager workdays / leave, and locks attendance. This does not create payroll or mark payments.</p>
      <details><summary className="cursor-pointer font-semibold">Create attendance period</summary><form className="mt-3 grid gap-3 sm:grid-cols-3" onSubmit={e => { e.preventDefault(); change.mutate(() => api.create({ name, fromDate: from, toDate: to, lotIds }), { onSuccess: p => { const result = p as AttendancePeriod; setPeriodId(String(result.id)); setLotId(String(result.lots[0].parkingLotId)); setName('') } }) }}>
        <label className="grid gap-1 text-sm">Name<Input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
        <label className="grid gap-1 text-sm">From (inclusive)<Input type="date" required value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label className="grid gap-1 text-sm">To (inclusive)<Input type="date" required min={from} value={to} onChange={e => setTo(e.target.value)} /></label>
        <fieldset className="sm:col-span-3"><legend className="text-sm font-semibold">Included lots</legend><div className="flex flex-wrap gap-3">{directory.data?.map(l => <label key={l.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={lotIds.includes(l.id)} onChange={e => setLotIds(e.target.checked ? [...lotIds, l.id] : lotIds.filter(id => id !== l.id))} />{l.name}</label>)}</div></fieldset>
        <Button type="submit" disabled={change.isPending || lotIds.length === 0}>Create period</Button>
      </form></details>
      <div className="flex flex-wrap gap-3"><label className="grid gap-1 text-sm">Period<NativeSelect aria-label="Admin attendance period" value={periodId} onChange={e => { const p = periods.data?.find(x => String(x.id) === e.target.value); setPeriodId(e.target.value); setLotId(p?.lots[0]?.parkingLotId.toString() ?? ''); setDay('') }}><option value="">Choose period</option>{periods.data?.map(p => <option key={p.id} value={p.id}>{p.name} · {p.fromDate} – {p.toDate} · {p.status}</option>)}</NativeSelect></label>
        <label className="grid gap-1 text-sm">Lot<NativeSelect aria-label="Admin attendance lot" value={lotId} onChange={e => { setLotId(e.target.value); setDay('') }}><option value="">Choose lot</option>{period?.lots.map(l => <option key={l.id} value={l.parkingLotId}>{l.lotName} · {l.status}</option>)}</NativeSelect></label>
      </div>
      {period && <div className="space-y-2"><p className="font-semibold">{period.name} · {period.fromDate} – {period.toDate} · {period.status}</p><p className="text-sm">{period.lots.map(l => `${l.lotName}: ${l.status}`).join(' / ')}</p>
        {period.lots.some(l => l.status === 'Open') && <p className="text-sm text-amber-800">Warning: some lots have not been confirmed by their Manager.</p>}
        <Button disabled={change.isPending || period.status === 'Locked' || periods.isFetching} onClick={() => { setLock(period); setAck(false); setReason('') }}>Review and lock {period.name}</Button></div>}
      {review.data && selectedLot && <>
        <HoursSummary data={review.data} />
        {review.data.warnings.length > 0 && <ul className="list-inside list-disc text-sm text-amber-900">{review.data.warnings.map(w => <li key={w}>{w}</li>)}</ul>}
        <form className="space-y-3 rounded border p-3" onSubmit={e => { e.preventDefault(); if (managerId) change.mutate(() => api.managerDay(lotId, { managerUserId: managerId, workDate: day, kind, reason: dayReason, revision }), { onSuccess: () => { setDay(''); setRevision(0); setDayReason('') } }) }}>
          <fieldset disabled={selectedLot.status === 'Locked' || change.isPending} className="flex flex-wrap items-end gap-3"><legend className="mb-2 font-semibold">Admin records Manager days · {selectedLot.status}</legend>
            <label className="grid gap-1 text-sm">Date<Input aria-label="Manager workday date" type="date" required min={period?.fromDate} max={period?.toDate} value={day} onChange={e => { const row = review.data.managerDays.find(d => d.workDate === e.target.value && d.managerUserId === managerId); setDay(e.target.value); setKind(row?.kind ?? 'Work'); setRevision(row?.revision ?? 0); setDayReason('') }} /></label>
            <label className="grid gap-1 text-sm">Type<NativeSelect value={kind} onChange={e => setKind(e.target.value as ManagerDayKind)}><option value="Work">Workday</option><option value="PaidLeave">Approved paid leave</option><option value="UnpaidLeave">Approved unpaid leave</option><option value="Absent">Absent (Admin verified)</option>{kind === 'Leave' && <option value="Leave">Approved leave (legacy record)</option>}</NativeSelect></label>
            <label className="grid gap-1 text-sm">Reason<Input aria-label="Manager workday reason" maxLength={1000} required value={dayReason} onChange={e => setDayReason(e.target.value)} /></label>
            <Button type="submit" disabled={!managerId || !day || !dayReason.trim() || (recorded?.revision ?? 0) !== revision}>Save Manager day</Button>
          </fieldset>
          {!managerId && <p className="text-xs text-amber-800">No current Manager assigned to this lot.</p>}
          <ul className="max-h-40 overflow-auto text-xs">{review.data.managerDays.map(d => <li key={d.id}>{d.workDate} · {d.kind} · {d.managerName || 'Manager'} · {d.reason}</li>)}</ul>
        </form>
        <details><summary className="cursor-pointer text-sm">Period audit history</summary><ul className="max-h-40 overflow-auto text-xs">{review.data.history.map(h => <li key={h.id}>{h.createdAt} · {h.action} · {h.actorId} · {h.reason}</li>)}</ul></details>
      </>}
      {(periods.isError || directory.isError || review.isError || change.isError) && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(periods.error ?? directory.error ?? review.error ?? change.error)}</p>}
    </>}
    <Dialog open={Boolean(lock)} onOpenChange={v => { if (!v) setLock(null) }}><DialogContent><DialogTitle>Lock attendance period</DialogTitle><DialogDescription>Direct changes will be rejected. Later corrections require a separate entry in a subsequent period.</DialogDescription>
      {lock && <div className="space-y-3"><p className="font-semibold">{lock.name} · {lock.fromDate} – {lock.toDate}</p><ul className="text-sm">{lock.lots.map(l => <li key={l.id}>{l.lotName} · {l.status} · {l.timeZoneId}</li>)}</ul>
        {lock.lots.some(l => l.status !== 'Confirmed') && <label className="flex items-start gap-2 text-sm text-amber-900"><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />I acknowledge the listed unconfirmed lots. Unresolved attendance warnings still prevent locking.</label>}
        <label className="grid gap-1 text-sm">Lock reason<Input aria-label="Attendance lock reason" required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
        <Button disabled={change.isPending || !reason.trim() || (lock.lots.some(l => l.status !== 'Confirmed') && !ack)} onClick={() => change.mutate(() => api.lock(lock.id, { revision: lock.revision, reason, acknowledgeUnconfirmed: ack }), { onSuccess: () => setLock(null) })}>Lock {lock.name}</Button>
        {change.isError && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(change.error)}</p>}
      </div>}
    </DialogContent></Dialog>
  </Card>
}
