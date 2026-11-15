import { useState, type FormEvent } from 'react'
import { Activity, CircleCheck, CircleX, Clock, Flag, Play } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { workSchedulingApi } from '@/api/workScheduling.service'
import { getErrorMessage } from '@/api/apiError'
import { useAuth } from '@/hooks/useAuth'
import { useAttendanceDetail, useAttendanceMutation, useAttendanceRealtime, workSchedulingKeys } from '@/hooks/useWorkScheduling'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/form-controls'
import { Spinner } from '@/components/ui/states'
import { ATTENDANCE_LABEL, attendanceLocalInput, attendanceTime } from '@/lib/workAttendance'
import { cn } from '@/lib/utils'
import { POSITION_LABEL, type AttendanceDetail, type AttendanceState } from '@/types/workScheduling.dto'

export function AttendanceBadge({ value }: { value?: AttendanceState }) {
  if (!value) return <span className="block text-[11px] text-slate-500">Attendance unavailable</span>
  const Icon = value.status === 'Working' ? Activity : value.status === 'Completed' ? CircleCheck : value.status === 'Absent' ? CircleX : value.status === 'StartWindow' ? Play : Clock
  return <span className="mt-1 block space-y-1 text-[11px]">
    <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-semibold', value.status === 'Absent' ? 'border-rose-200 bg-rose-50 text-rose-800' : value.status === 'Working' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-700')}><Icon className="size-3" />{ATTENDANCE_LABEL[value.status]}</span>
    {value.isLate && <span className="block font-semibold text-amber-800"><Flag className="mr-1 inline size-3" />Late</span>}
    {value.autoEnded && <span className="block font-semibold text-amber-800"><Flag className="mr-1 inline size-3" />Auto-ended · review</span>}
  </span>
}

function StaffAttendanceActions({ detail }: { detail: AttendanceDetail }) {
  const { user } = useAuth()
  const change = useAttendanceMutation()
  if (user?.role !== 'STAFF') return null
  const command = { revision: detail.attendance.revision, rosterRevision: detail.rosterRevision }
  return <div className="flex flex-wrap items-center gap-2">
    {detail.attendance.canStart && <Button size="sm" disabled={change.isPending} onClick={() => change.mutate(() => workSchedulingApi.startShift(detail.assignmentId, command))}><Play />Start shift</Button>}
    {detail.attendance.canEnd && <Button size="sm" disabled={change.isPending} onClick={() => change.mutate(() => workSchedulingApi.endShift(detail.assignmentId, command))}><CircleCheck />End shift</Button>}
    {change.isPending && <Spinner />}
    {change.isError && <p role="alert" className="w-full text-xs text-rose-700">{getErrorMessage(change.error)}</p>}
  </div>
}

function AttendanceHistoryTimes({ json, zone }: { json: string; zone: string }) {
  try {
    const state = JSON.parse(json) as { Status: AttendanceState['status']; CheckInAt: string | null; CheckOutAt: string | null; IsLate: boolean; AutoEnded: boolean }
    return <p className="text-xs text-slate-600">{ATTENDANCE_LABEL[state.Status]} · In: {attendanceTime(state.CheckInAt, zone)} · Out: {attendanceTime(state.CheckOutAt, zone)}{state.IsLate && ' · Late'}{state.AutoEnded && ' · Auto-ended'}</p>
  } catch { return <p className="text-xs text-slate-500">Details unavailable</p> }
}

const ACTION: Record<string, string> = { Started: 'Staff started shift', Ended: 'Staff ended shift', Absent: 'Start deadline passed', AutoEnded: 'Automatically ended', Reopened: 'Manager reopened shift', Adjusted: 'Manager corrected actual times' }

export default function AssignmentAttendancePanel({ assignmentId }: { assignmentId: number }) {
  const { user } = useAuth()
  const query = useAttendanceDetail(assignmentId)
  const change = useAttendanceMutation()
  const [reason, setReason] = useState('')
  const [edit, setEdit] = useState<{ start: string; end: string; revision: number; rosterRevision: number } | null>(null)
  if (query.isPending) return <p className="flex items-center gap-2 text-sm"><Spinner />Loading attendance…</p>
  if (!query.data) return <p role="alert" className="text-sm text-rose-700">{getErrorMessage(query.error)} <button className="underline" onClick={() => query.refetch()}>Retry</button></p>
  const detail = query.data
  const state = detail.attendance
  const stale = Boolean(edit && (edit.revision !== state.revision || edit.rosterRevision !== detail.rosterRevision))
  function save(e: FormEvent) {
    e.preventDefault()
    if (!edit || stale || !edit.start || !reason.trim()) return
    change.mutate(() => workSchedulingApi.adjustAttendance(assignmentId, {
      revision: edit.revision, rosterRevision: edit.rosterRevision, reason,
      checkInAt: new Date(edit.start).toISOString(), checkOutAt: edit.end ? new Date(edit.end).toISOString() : null,
    }), { onSuccess: () => { setEdit(null); setReason('') } })
  }
  return <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-3" aria-label="Assignment attendance">
    <h3 className="font-semibold text-slate-950">Attendance</h3>
    <AttendanceBadge value={state} />
    <dl className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
      <div><dt className="text-xs text-slate-500">Planned start</dt><dd>{attendanceTime(detail.plannedStart, detail.timeZoneId)}</dd></div>
      <div><dt className="text-xs text-slate-500">Planned end</dt><dd>{attendanceTime(detail.plannedEnd, detail.timeZoneId)}</dd></div>
      <div><dt className="text-xs text-slate-500">Actual in</dt><dd>{attendanceTime(state.checkInAt, detail.timeZoneId)}</dd></div>
      <div><dt className="text-xs text-slate-500">{state.autoEnded ? 'Recorded out (automatic, for review)' : 'Actual out'}</dt><dd>{attendanceTime(state.checkOutAt, detail.timeZoneId)}</dd></div>
    </dl>
    <p className="text-xs text-slate-500">Times shown in {detail.timeZoneId}. Start window opens {attendanceTime(state.windowOpensAt, detail.timeZoneId)}; missed-start deadline {attendanceTime(state.absentAfterAt, detail.timeZoneId)}.</p>
    {state.status === 'Untracked' && <p className="text-xs text-amber-800">This assignment predates attendance tracking or was published/assigned after its start deadline. It has not been marked absent; the Manager can record actual times.</p>}
    {state.autoEnded && <p className="text-xs text-amber-800">The scheduled end was used automatically after the grace period. This is not a Staff check-out; the Manager should review it.</p>}
    {query.isError && <p role="status" className="text-xs text-amber-800">Connection interrupted. Showing the last loaded record; it will refresh when reconnected.</p>}
    <StaffAttendanceActions detail={detail} />
    {user?.role === 'MANAGER' && detail.rosterStatus === 'Published' && <div className="space-y-3 border-t border-slate-200 pt-3">
      {!edit && <Button variant="outline" size="sm" onClick={() => setEdit({ start: attendanceLocalInput(state.checkInAt), end: attendanceLocalInput(state.checkOutAt), revision: state.revision, rosterRevision: detail.rosterRevision })}>Correct actual times</Button>}
      {(edit || state.canReopen) && <label className="grid gap-1 text-sm text-slate-700">Reason (required)<Input aria-label="Attendance change reason" required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>}
      {edit && <form onSubmit={save} className="space-y-3">
        <p className="text-xs text-slate-500">Enter actual times in your device's time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).</p>
        <label className="grid gap-1 text-sm text-slate-700">Actual in<Input aria-label="Corrected actual in" type="datetime-local" step="1" required value={edit.start} onChange={e => setEdit({ ...edit, start: e.target.value })} /></label>
        <label className="grid gap-1 text-sm text-slate-700">Actual out<Input aria-label="Corrected actual out" type="datetime-local" step="1" value={edit.end} onChange={e => setEdit({ ...edit, end: e.target.value })} /></label>
        {stale && <p role="alert" className="text-xs text-amber-800">Attendance or the roster changed. Cancel and reopen the correction to review the current values.</p>}
        <div className="flex gap-2"><Button type="submit" size="sm" disabled={change.isPending || stale || !reason.trim()}>Save correction</Button><Button size="sm" variant="outline" onClick={() => setEdit(null)}>Cancel correction</Button></div>
      </form>}
      {state.canReopen && !edit && <Button size="sm" disabled={!reason.trim() || change.isPending} onClick={() => change.mutate(() => workSchedulingApi.reopenShift(assignmentId, { revision: state.revision, rosterRevision: detail.rosterRevision, reason }), { onSuccess: () => setReason('') })}>Reopen and record start now</Button>}
    </div>}
    {change.isError && <p role="alert" className="text-xs text-rose-700">{getErrorMessage(change.error)}</p>}
    <details><summary className="cursor-pointer text-sm font-semibold text-indigo-700">Attendance and adjustment history ({detail.history.length})</summary>
      <ol className="mt-2 max-h-64 space-y-3 overflow-auto">{detail.history.map(event => <li key={event.id} className="space-y-1 border-l-2 border-slate-200 pl-3">
        <p className="text-sm font-semibold">{ACTION[event.action] ?? event.action}</p>
        <p className="text-xs text-slate-500">{attendanceTime(event.createdAt, detail.timeZoneId)} · {event.actorName}</p>
        {event.reason && <p className="break-words text-xs">{event.reason}</p>}
        <p className="text-xs font-medium">Before</p><AttendanceHistoryTimes json={event.beforeJson} zone={detail.timeZoneId} />
        <p className="text-xs font-medium">After</p><AttendanceHistoryTimes json={event.afterJson} zone={detail.timeZoneId} />
      </li>)}</ol>
      {detail.history.length === 0 && <p className="mt-2 text-xs text-slate-500">No attendance events recorded.</p>}
    </details>
  </section>
}

export function CurrentShiftPanel({ lotId }: { lotId?: string }) {
  const { user } = useAuth()
  useAttendanceRealtime(lotId)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const query = useQuery({ queryKey: [...workSchedulingKeys, user?.userId, 'current'], queryFn: workSchedulingApi.currentShifts,
    enabled: Boolean(user?.role === 'STAFF'), refetchInterval: 10_000, refetchOnReconnect: 'always' })
  const items = (query.data ?? []).filter(item => item.parkingLotId.toString() === lotId)
  return <Card className="mb-5 space-y-3 p-4" aria-label="Current shift">
    <h2 className="font-semibold text-slate-950">Current shift</h2>
    {query.isPending && <Spinner />}
    {query.isError && <p role="status" className="text-xs text-amber-800">Could not refresh the current shift. <button className="underline" onClick={() => query.refetch()}>Retry</button></p>}
    {!query.isPending && !query.isError && items.length === 0 && <p className="text-sm text-slate-500">No recent or upcoming published shift at this lot in the next 48 hours.</p>}
    <div className="grid gap-3 lg:grid-cols-2">{items.map(item => <div key={item.assignmentId} className="space-y-2 rounded-lg border border-slate-200 p-3">
      <p className="font-semibold text-slate-950">{item.shiftName} · {POSITION_LABEL[item.position]}</p>
      <p className="text-sm font-medium text-slate-800">{attendanceTime(item.plannedStart, item.timeZoneId)} → {attendanceTime(item.plannedEnd, item.timeZoneId)}</p>
      <AttendanceBadge value={item.attendance} />
      <div className="flex flex-wrap items-center gap-2"><StaffAttendanceActions detail={item} /><Button size="sm" variant="outline" onClick={() => setSelectedId(item.assignmentId)}>Shift details</Button></div>
    </div>)}</div>
    <Dialog open={selectedId !== null} onOpenChange={open => { if (!open) setSelectedId(null) }}><DialogContent className="max-w-xl"><DialogTitle>My shift attendance</DialogTitle><DialogDescription>Start or end your shift and review recorded times.</DialogDescription>{selectedId !== null && <AssignmentAttendancePanel assignmentId={selectedId} />}</DialogContent></Dialog>
  </Card>
}
