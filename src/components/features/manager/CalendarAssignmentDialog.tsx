import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { workSchedulingApi } from '@/api/workScheduling.service'
import { getErrorMessage } from '@/api/apiError'
import { Button } from '@/components/ui/button'
import { Input, NativeSelect } from '@/components/ui/form-controls'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/states'
import { useAuth } from '@/hooks/useAuth'
import { useScheduleMutation, workSchedulingKeys } from '@/hooks/useWorkScheduling'
import { shiftEndDate } from '@/lib/workScheduleCalendar'
import type { DutyRoster, EligibleStaffQuery } from '@/types/workScheduling.dto'
import { AssignmentDetails, type CalendarCell } from './WorkScheduleCalendar'
import AssignmentAttendancePanel from './AssignmentAttendancePanel'

export default function CalendarAssignmentDialog({ lotId, roster, cell, reason: initialReason, close }: {
  lotId: string; roster: DutyRoster; cell: CalendarCell; reason: string; close: () => void
}) {
  const { user } = useAuth()
  const item = cell.assignment
  const initialShift = item?.shift ?? cell.occurrence?.shift
  const [targetId, setTargetId] = useState(initialShift?.id.toString() ?? 'new')
  const [employeeId, setEmployeeId] = useState((item?.assignment.employeeId ?? cell.employeeId)?.toString() ?? '')
  const [notes, setNotes] = useState(item?.assignment.notes ?? '')
  const [reason, setReason] = useState(initialReason)
  // Preserve the version the user opened; polling must never silently authorize overwriting a newer version.
  const [revision] = useState(roster.revision)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const mutation = useScheduleMutation()
  const target = roster.shifts.find(s => s.id.toString() === targetId)
  const query: EligibleStaffQuery = target ? { shiftId: target.id } : { workDate: cell.day, workShiftTemplateId: cell.group.templateId }
  if (item) query.excludeAssignmentId = item.assignment.id
  const eligible = useQuery({
    queryKey: [...workSchedulingKeys, user?.userId, lotId, roster.id, 'eligible', query, roster.revision],
    queryFn: () => workSchedulingApi.eligibleStaff(lotId, roster.id, query), staleTime: 0,
  })
  const employeeEligible = eligible.data?.some(e => e.employeeId.toString() === employeeId) ?? false
  const needsReason = roster.status === 'Published'
  const stale = roster.revision !== revision
  const locked = Boolean(initialShift?.attendanceLocked || target?.attendanceLocked)
  const blocked = locked || mutation.isPending || stale || (needsReason && !reason.trim())
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!employeeEligible || blocked) return
    const input = { employeeId: Number(employeeId), notes, reason, revision }
    mutation.mutate(() => item
      ? workSchedulingApi.saveAssignment(lotId, roster.id, item.shift.id, { ...input, targetShiftId: target?.id }, item.assignment.id)
      : workSchedulingApi.assignFromCalendar(lotId, roster.id, { ...input, shiftId: target?.id,
        workDate: cell.day, workShiftTemplateId: target ? undefined : cell.group.templateId }), { onSuccess: close })
  }
  return <Dialog open onOpenChange={open => { if (!open && !mutation.isPending) close() }}><DialogContent className="max-w-xl">
    <DialogTitle>{item ? 'Edit assignment' : 'Assign Staff'}</DialogTitle>
    <DialogDescription>{roster.name} · {roster.status}. {needsReason ? 'Changes are recorded and affected Staff are notified.' : 'Draft assignments are visible only to the Manager.'}</DialogDescription>
    {item && <div className="rounded-lg bg-slate-50 p-3"><AssignmentDetails item={item} /></div>}
    {item && <AssignmentAttendancePanel assignmentId={item.assignment.id} />}
    {locked && <p role="status" className="text-sm font-semibold text-amber-900">Attendance period locked · assignment is read only.</p>}
    <form onSubmit={submit} className="space-y-4"><fieldset disabled={locked} className="space-y-4">
      <label className="grid gap-1.5 text-sm font-medium text-slate-700">Dated shift
        <NativeSelect aria-label="Assignment dated shift" value={targetId} onChange={e => setTargetId(e.target.value)} disabled={mutation.isPending}>
          {!initialShift && <option value="new">{cell.day} · {cell.group.name} · create dated shift</option>}
          {roster.shifts.map(s => <option key={s.id} value={s.id}>{s.workDate} · {s.name} · {s.startTime.slice(0, 5)}–{s.endTime.slice(0, 5)}{s.endTime < s.startTime ? ` (ends ${shiftEndDate(s)})` : ''}</option>)}
        </NativeSelect>
      </label>
      {!target && <p className="text-xs text-slate-600">A dated shift will be created from the current template only after a valid assignment is saved. {cell.group.startTime.slice(0, 5)}–{cell.group.endTime.slice(0, 5)}{cell.group.endTime < cell.group.startTime && ' · ends next day'}.</p>}
      <label className="grid gap-1.5 text-sm font-medium text-slate-700">Eligible Staff
        <NativeSelect aria-label="Eligible assignment Staff" required value={employeeId} onChange={e => setEmployeeId(e.target.value)} disabled={eligible.isPending || mutation.isPending || eligible.isError}>
          <option value="">Choose eligible Staff</option>
          {employeeId && !employeeEligible && !eligible.isPending && <option value={employeeId} disabled>Current selection is unavailable for this shift</option>}
          {(eligible.data ?? []).map(e => <option key={e.employeeId} value={e.employeeId}>{e.fullName} · {e.employeeCode}</option>)}
        </NativeSelect>
      </label>
      {eligible.isPending && <p className="flex items-center gap-2 text-xs text-slate-500"><Spinner />Checking lot membership, active status and overlapping shifts…</p>}
      {eligible.isError && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(eligible.error)} <button type="button" className="underline" onClick={() => eligible.refetch()}>Retry</button></p>}
      {eligible.isSuccess && eligible.data.length === 0 && <p role="status" className="text-sm text-amber-800">No eligible Staff for this shift. Existing assignments, including drafts and overnight shifts, can block availability.</p>}
      <label className="grid gap-1.5 text-sm font-medium text-slate-700">Assignment notes
        <textarea aria-label="Assignment notes" maxLength={1000} rows={3} value={notes} onChange={e => setNotes(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900" />
      </label>
      {needsReason && <label className="grid gap-1.5 text-sm font-medium text-slate-700">Reason for changing published roster
        <Input aria-label="Published assignment change reason" required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} />
      </label>}
      {stale && <p role="alert" className="text-sm text-amber-800">This roster changed while you were editing. Close this dialog and reopen the assignment to review the latest version.</p>}
      {mutation.isError && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(mutation.error)}</p>}
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={blocked || !employeeEligible || eligible.isFetching}>{mutation.isPending && <Spinner />}Save assignment</Button><Button variant="outline" onClick={close} disabled={mutation.isPending}>Cancel</Button>
        {item && <Button variant="ghost" onClick={() => setConfirmRemove(v => !v)} disabled={blocked}>Remove assignment</Button>}
      </div>
      {item && confirmRemove && <div className="space-y-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-900"><p>Remove this assignment? Its history is retained.{needsReason && ' The Staff member will be notified.'}</p><Button variant="destructive" disabled={blocked} onClick={() => mutation.mutate(() => workSchedulingApi.removeAssignment(lotId, roster.id, item.shift.id, item.assignment.id, { revision, reason }), { onSuccess: close })}>Confirm removal</Button></div>}
    </fieldset></form>
  </DialogContent></Dialog>
}
