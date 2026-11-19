import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { dutyApi } from '@/api/duty.service'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/form-controls'
import { Spinner } from '@/components/ui/states'
import { useDutyCandidates, useDutyMutation } from '@/hooks/useDuty'
import { EMPLOYMENT_LABEL, shiftLabel } from '@/lib/duty'
import { cn } from '@/lib/utils'
import type { DutyCell, DutyScope } from '@/types/duty.dto'

/** datetime-local value (viewer's time) of an ISO instant. */
function localInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function AttendanceForm({ lotId, cell, onDone }: { lotId: string; cell: DutyCell; onDone: () => void }) {
  const save = useDutyMutation('Attendance saved.')
  const [checkIn, setCheckIn] = useState(localInput(cell.checkInAt))
  const [checkOut, setCheckOut] = useState(localInput(cell.checkOutAt))
  const [reason, setReason] = useState('')
  return (
    <form className="space-y-3 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200" onSubmit={(e) => {
      e.preventDefault()
      save.mutate(() => dutyApi.adjustAttendance(lotId, {
        date: cell.date, slot: cell.slot, employeeId: cell.employeeId!, reason,
        checkInAt: checkIn ? new Date(checkIn).toISOString() : null, checkOutAt: checkOut ? new Date(checkOut).toISOString() : null,
      }), { onSuccess: onDone })
    }}>
      <p className="text-sm font-semibold text-slate-900">Correct attendance of {cell.employeeName}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">Check-in<Input type="datetime-local" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} /></Label>
        <Label className="grid gap-1">Check-out<Input type="datetime-local" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} /></Label>
      </div>
      <p className="text-xs text-slate-600">Leave both empty to mark the shift absent.</p>
      <Label className="grid gap-1">Reason<Input required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Forgot to start the shift" /></Label>
      <Button type="submit" size="sm" disabled={save.isPending || !reason.trim()}>{save.isPending && <Spinner />}Save attendance</Button>
    </form>
  )
}

/** Manager: who works one shift. Pick a person (or nobody) for this day only or for every week from this day. */
export function DutyCellDialog({ lotId, cell, onClose }: { lotId: string; cell: DutyCell; onClose: () => void }) {
  const started = new Date(cell.startsAt).getTime() <= Date.now()
  const checkedIn = Boolean(cell.checkInAt)
  const canChange = !cell.isPast && !checkedIn
  const candidates = useDutyCandidates(lotId, cell.date, cell.slot, cell.employeeId ?? undefined, canChange)
  const save = useDutyMutation('Duty board saved.')
  const [choice, setChoice] = useState<number | 'empty' | null>(null)
  const [scope, setScope] = useState<DutyScope>('Day')
  const [reason, setReason] = useState('')
  const [correcting, setCorrecting] = useState(false)
  const chosen = typeof choice === 'number' ? candidates.data?.find((c) => c.employeeId === choice) : undefined
  const followingBlocked = chosen?.employmentType === 'Backup'

  const submit = () => {
    if (choice == null) return
    save.mutate(() => dutyApi.setCell(lotId, {
      date: cell.date, slot: cell.slot, employeeId: choice === 'empty' ? null : choice,
      scope: followingBlocked ? 'Day' : scope, reason: reason.trim() || undefined,
    }), { onSuccess: onClose })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <div>
          <p className="text-xs font-bold tracking-wide text-indigo-700 uppercase">{shiftLabel(cell.date, cell.slot)}</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">{cell.employeeName ?? 'No staff on this shift'}</h2>
          <div className="mt-2 flex flex-wrap gap-1">
            {cell.employmentType && <Badge tone={cell.employmentType === 'Backup' ? 'violet' : 'neutral'}>{EMPLOYMENT_LABEL[cell.employmentType]}</Badge>}
            {cell.onLeaveName && <Badge tone="amber">{cell.onLeaveName} on leave</Badge>}
            {cell.leavePending && <Badge tone="amber">Leave pending</Badge>}
            {cell.attendanceStatus && <Badge tone={cell.attendanceStatus === 'Absent' ? 'rose' : 'emerald'}>{cell.attendanceStatus}</Badge>}
          </div>
        </div>

        {canChange ? (
          <div className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-semibold text-slate-800">{cell.employeeId ? 'Replace with' : 'Put on this shift'}</legend>
              {candidates.isPending ? <Spinner /> : (
                <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
                  {(candidates.data ?? []).map((c) => (
                    <li key={c.employeeId}>
                      <label className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ring-1 ring-slate-200',
                        choice === c.employeeId && 'bg-indigo-50 ring-indigo-300', !c.eligible && 'cursor-not-allowed opacity-60')}>
                        <input type="radio" name="person" disabled={!c.eligible} checked={choice === c.employeeId} onChange={() => setChoice(c.employeeId)} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">{c.fullName}</span>
                          <span className="block text-xs text-slate-600">{c.shiftsThisWeek} shift(s) this week{c.blockedReason ? ` · ${c.blockedReason}` : ''}</span>
                        </span>
                        {c.employmentType === 'Backup' && <Badge tone="violet">Backup</Badge>}
                        {c.warning && <Badge tone="amber">{c.warning}</Badge>}
                      </label>
                    </li>
                  ))}
                  {cell.employeeId && (
                    <li>
                      <label className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ring-1 ring-slate-200', choice === 'empty' && 'bg-rose-50 ring-rose-300')}>
                        <input type="radio" name="person" checked={choice === 'empty'} onChange={() => setChoice('empty')} />
                        <span className="text-sm font-semibold text-rose-700">Leave this shift empty</span>
                      </label>
                    </li>
                  )}
                </ul>
              )}
            </fieldset>

            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="mb-1 text-sm font-semibold text-slate-800">Apply to</legend>
              {(['Day', 'Following'] as const).map((value) => (
                <label key={value} className={cn('flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2 ring-1 ring-slate-200',
                  scope === value && !(value === 'Following' && followingBlocked) && 'bg-indigo-50 ring-indigo-300',
                  value === 'Following' && followingBlocked && 'cursor-not-allowed opacity-50')}>
                  <input type="radio" name="scope" className="mt-1" disabled={value === 'Following' && followingBlocked}
                    checked={value === 'Day' ? scope === 'Day' || followingBlocked : scope === 'Following' && !followingBlocked}
                    onChange={() => setScope(value)} />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{value === 'Day' ? 'Only this day' : 'This and following weeks'}</span>
                    <span className="block text-xs text-slate-600">
                      {value === 'Day' ? 'The weekly pattern stays the same.' : followingBlocked ? 'Backup Staff are not in the weekly pattern.' : 'Changes the weekly pattern.'}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            <Label className="grid gap-1">Note (optional)
              <Input maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Shown in the shift history" />
            </Label>
            <div className="flex flex-wrap gap-2">
              <Button onClick={submit} disabled={choice == null || save.isPending}>{save.isPending && <Spinner />}Save</Button>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </div>
        ) : (
          <p className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            {cell.isPast ? 'This shift is over.' : 'The Staff on this shift has already started it.'}
          </p>
        )}

        {started && cell.employeeId && (
          correcting
            ? <AttendanceForm lotId={lotId} cell={cell} onDone={onClose} />
            : <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setCorrecting(true)}>Correct attendance</Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
