import { useState } from 'react'
import { workSchedulingApi } from '@/api/workScheduling.service'
import { getErrorMessage } from '@/api/apiError'
import { useScheduleMutation } from '@/hooks/useWorkScheduling'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, NativeSelect } from '@/components/ui/form-controls'
import type { DutyRoster, RosterStaff, StandbyAssignment } from '@/types/workScheduling.dto'

export default function StandbyEditor({ lotId, roster, staff, reason }: { lotId: string; roster: DutyRoster; staff: RosterStaff[]; reason: string }) {
  const [editing, setEditing] = useState<StandbyAssignment | 'new' | null>(null)
  const [date, setDate] = useState(roster.fromDate)
  const [employee, setEmployee] = useState('')
  const save = useScheduleMutation()
  const [revision, setRevision] = useState(roster.revision)
  const blocked = save.isPending || (roster.status === 'Published' && !reason.trim())
  const command = { revision, reason, workDate: date, employeeId: Number(employee) }
  return <Card className="space-y-3 p-5">
    <div className="flex items-center justify-between"><div><h3 className="font-semibold">Standby controls</h3><p className="text-xs text-slate-500">One per lot/local day; no direct-work attendance or staffing count.</p></div><Button size="sm" variant="outline" disabled={blocked} onClick={() => { setEditing('new'); setRevision(roster.revision); setDate(roster.fromDate); setEmployee('') }}>Add standby</Button></div>
    <ul className="max-h-56 space-y-2 overflow-auto">{roster.standbys?.map(row => <li key={row.id} className="flex items-center justify-between gap-2 text-sm"><span>{row.workDate} · {row.staffName} · {row.source}</span><Button size="sm" variant="outline" disabled={blocked || roster.attendanceLockedDates?.includes(row.workDate)} onClick={() => { setEditing(row); setRevision(roster.revision); setDate(row.workDate); setEmployee(row.employeeId.toString()) }}>Edit standby</Button></li>)}</ul>
    {editing && <form className="space-y-3" onSubmit={e => { e.preventDefault(); save.mutate(() => workSchedulingApi.saveStandby(lotId, roster.id, command, editing === 'new' ? undefined : editing.id), { onSuccess: () => setEditing(null) }) }}>
      <label className="grid gap-1 text-sm">Standby date<Input aria-label="Standby date" type="date" min={roster.fromDate} max={roster.toDate} required value={date} onChange={e => setDate(e.target.value)} /></label>
      <label className="grid gap-1 text-sm">Staff<NativeSelect aria-label="Standby Staff" required value={employee} onChange={e => setEmployee(e.target.value)}><option value="">Choose Staff</option>{staff.map(s => <option key={s.employeeId} value={s.employeeId}>{s.fullName}</option>)}</NativeSelect></label>
      {revision !== roster.revision && <p role="alert" className="text-sm text-amber-800">Roster changed. Close and reopen this form.</p>}
      <div className="flex gap-2"><Button type="submit" disabled={blocked || roster.attendanceLockedDates?.includes(date) || revision !== roster.revision}>Save standby</Button><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>{editing !== 'new' && <Button variant="destructive" disabled={blocked || roster.attendanceLockedDates?.includes(date) || revision !== roster.revision} onClick={() => save.mutate(() => workSchedulingApi.saveStandby(lotId, roster.id, { ...command, employeeId: null }, editing.id), { onSuccess: () => setEditing(null) })}>Remove standby</Button>}</div>
    </form>}
    {save.isError && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(save.error)}</p>}
  </Card>
}
