import { useState } from 'react'
import { AlertTriangle, Siren } from 'lucide-react'
import { dutyApi } from '@/api/duty.service'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/form-controls'
import { Spinner } from '@/components/ui/states'
import { useDutyCandidates, useDutyMutation } from '@/hooks/useDuty'
import { EMPLOYMENT_LABEL, clock, shiftLabel } from '@/lib/duty'
import { cn } from '@/lib/utils'
import type { DutyCell, DutyScope } from '@/types/duty.dto'

/**
 * Manager: who works one shift.
 * - Only this day = emergency replacement: backup Staff only, possible until the shift ends (someone working is taken off now).
 * - This and following weeks = the weekly pattern: full-time Staff only, for shifts that have not begun.
 */
export function DutyCellDialog({ lotId, cell, onClose }: { lotId: string; cell: DutyCell; onClose: () => void }) {
  const started = new Date(cell.startsAt).getTime() <= Date.now()
  const canChange = !cell.isPast
  const candidates = useDutyCandidates(lotId, cell.date, cell.slot, cell.employeeId ?? undefined, canChange)
  const save = useDutyMutation(started ? 'Replacement saved.' : 'Duty board saved.')
  const [scope, setScope] = useState<DutyScope>('Day')
  const [choice, setChoice] = useState<number | 'empty' | null>(null)
  const [reason, setReason] = useState('')
  const wanted = scope === 'Day' ? 'Backup' : 'FullTime'
  const list = (candidates.data ?? []).filter((c) => c.employmentType === wanted)

  const pickScope = (value: DutyScope) => {
    setScope(value)
    setChoice(null)
  }

  const submit = () => {
    if (choice == null) return
    save.mutate(() => dutyApi.setCell(lotId, {
      date: cell.date, slot: cell.slot, employeeId: choice === 'empty' ? null : choice, scope, reason: reason.trim() || undefined,
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
            {cell.attendanceStatus === 'Absent' && <Badge tone="rose">Absent</Badge>}
            {cell.isLate && <Badge tone="amber">Late · {clock(cell.checkInAt)}</Badge>}
            {cell.attendanceStatus === 'Working' && !cell.isLate && <Badge tone="emerald">On shift · {clock(cell.checkInAt)}</Badge>}
          </div>
        </div>

        {canChange ? (
          <div className="space-y-4">
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="mb-1 text-sm font-semibold text-slate-800">What to do</legend>
              <label className={cn('flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2 ring-1 ring-slate-200', scope === 'Day' && 'bg-rose-50 ring-rose-300')}>
                <input type="radio" name="scope" className="mt-1" checked={scope === 'Day'} onChange={() => pickScope('Day')} />
                <span>
                  <span className="flex items-center gap-1 text-sm font-semibold text-slate-900"><Siren className="size-4 text-rose-600" />Emergency replacement</span>
                  <span className="block text-xs text-slate-600">This day only, with a backup Staff member.{started && cell.employeeId ? ' The person on shift is taken off now.' : ''}</span>
                </span>
              </label>
              <label className={cn('flex items-start gap-2 rounded-lg px-3 py-2 ring-1 ring-slate-200', started ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                scope === 'Following' && 'bg-indigo-50 ring-indigo-300')}>
                <input type="radio" name="scope" className="mt-1" disabled={started} checked={scope === 'Following'} onChange={() => pickScope('Following')} />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">Change the weekly pattern</span>
                  <span className="block text-xs text-slate-600">{started ? 'Not for a shift that has begun.' : 'This and following weeks, with a full-time Staff member.'}</span>
                </span>
              </label>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-semibold text-slate-800">{scope === 'Day' ? 'Backup Staff' : 'Full-time Staff'}</legend>
              {candidates.isPending ? <Spinner /> : (
                <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
                  {list.map((c) => (
                    <li key={c.employeeId}>
                      <label className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ring-1 ring-slate-200',
                        choice === c.employeeId && 'bg-indigo-50 ring-indigo-300', !c.eligible && 'cursor-not-allowed opacity-60')}>
                        <input type="radio" name="person" disabled={!c.eligible} checked={choice === c.employeeId} onChange={() => setChoice(c.employeeId)} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">{c.fullName}</span>
                          <span className="block text-xs text-slate-600">{c.shiftsThisWeek} shift(s) this week{c.blockedReason ? ` · ${c.blockedReason}` : ''}</span>
                        </span>
                        {c.warning && <Badge tone="amber">{c.warning}</Badge>}
                      </label>
                    </li>
                  ))}
                  {list.length === 0 && <li className="text-sm text-slate-600">Nobody available.</li>}
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

            <Label className="grid gap-1">Note (optional)
              <Input maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Sick, called in a backup" />
            </Label>
            <div className="flex flex-wrap gap-2">
              <Button variant={scope === 'Day' ? 'destructive' : 'default'} onClick={submit} disabled={choice == null || save.isPending}>
                {save.isPending && <Spinner />}{scope === 'Day' ? 'Replace now' : 'Save pattern'}
              </Button>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </div>
        ) : (
          <p className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            This shift is over.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
