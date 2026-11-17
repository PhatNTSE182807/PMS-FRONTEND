import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { workRequestsApi } from '@/api/workRequests.service'
import { getErrorMessage } from '@/api/apiError'
import { useAuth } from '@/hooks/useAuth'
import { useScheduleMutation, workSchedulingKeys } from '@/hooks/useWorkScheduling'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input, NativeSelect } from '@/components/ui/form-controls'
import { Spinner } from '@/components/ui/states'
import { attendanceTime } from '@/lib/workAttendance'
import type { RequestCommand } from '@/types/workRequests.dto'

export default function OpenShiftDialog({ id, close }: { id: number; close: () => void }) {
  const { user } = useAuth(); const manager = user?.role === 'MANAGER'; const save = useScheduleMutation()
  const [reason, setReason] = useState(''); const [employee, setEmployee] = useState(''); const [overtime, setOvertime] = useState(false)
  const query = useQuery({ queryKey: [...workSchedulingKeys, user?.userId, 'open-shift', id], queryFn: () => workRequestsApi.openShift(id), refetchInterval: 10_000, refetchOnReconnect: 'always' })
  const data = query.data
  const act = (action: string, extra: Partial<RequestCommand> = {}) => data && save.mutate(() => workRequestsApi.openShiftAction(id, { revision: data.slot.revision, action, reason, ...extra }))
  return <Dialog open onOpenChange={open => { if (!open) close() }}><DialogContent className="max-w-2xl"><DialogTitle>Open shift #{id}</DialogTitle><DialogDescription>Only Manager confirmation creates a replacement assignment.</DialogDescription>
    {query.isPending ? <Spinner /> : !data ? <p role="alert">{getErrorMessage(query.error)}</p> : <div className="space-y-4">
      <p className="font-semibold">{data.slot.shiftName} · {data.slot.workDate} · {data.slot.status}</p>
      <p className="text-sm">{attendanceTime(data.slot.startsAt)} → {attendanceTime(data.slot.endsAt)}</p>
      <p className="text-sm">Stage: <strong>{data.slot.stage}</strong>{data.slot.targetEmployeeId && ` · targeted Staff #${data.slot.targetEmployeeId}`}{data.slot.deadlineAt && ` · deadline ${attendanceTime(data.slot.deadlineAt)}`}</p>
      {data.slot.originalAssignmentId && <p className="text-sm">Original assignment: #{data.slot.originalAssignmentId}. Retained in leave/swap history.</p>}
      {data.slot.replacementAssignmentId && <p className="text-sm font-semibold">Replacement assignment: #{data.slot.replacementAssignmentId}</p>}
      {manager && <>
        <p className="text-sm">Standby: {data.standby.map(s => s.staffName).join(', ') || 'None available on this date'}</p>
        <details><summary className="cursor-pointer text-sm font-semibold">Eligible candidates ({data.candidates.length})</summary><p className="text-sm">{data.candidates.map(s => s.fullName).join(', ') || 'None satisfy current constraints'}</p></details>
        {data.slot.status === 'Open' && <label className="grid gap-1 text-sm">Decision reason (required)<Input aria-label="Open shift decision reason" maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>}
      </>}
      <div className="space-y-2">{data.claims.map(claim => <div key={claim.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 p-2 text-sm"><span>{claim.staffName} · {claim.status}</span>
        {data.slot.status === 'Open' && claim.status === 'Claimed' && (manager ? <div className="flex gap-2"><Button size="sm" disabled={save.isPending || !reason.trim()} onClick={() => act('Confirm', { claimId: claim.id })}>Confirm replacement</Button><Button size="sm" variant="outline" disabled={save.isPending || !reason.trim()} onClick={() => act('RejectClaim', { claimId: claim.id })}>Reject claim</Button></div> : <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => act('Withdraw')}>Withdraw claim</Button>)}
      </div>)}</div>
      {!manager && data.slot.status === 'Open' && ['Proposed', 'Standby', 'Public'].includes(data.slot.stage) && data.claims.length === 0 && <div className="flex gap-2"><Button disabled={save.isPending} onClick={() => act('Claim')}>Accept / request this shift</Button>{data.slot.targetEmployeeId && <Button variant="outline" disabled={save.isPending} onClick={() => act('Decline')}>Decline offer</Button>}</div>}
      {manager && data.slot.status === 'Open' && data.slot.stage === 'Manual' && <div className="space-y-3 rounded-lg bg-slate-50 p-3">
        <p className="text-sm">Response windows have ended. Assign Staff or record Manager coverage.</p>
        <label className="grid gap-1 text-sm">Staff<NativeSelect aria-label="Direct replacement Staff" value={employee} onChange={e => setEmployee(e.target.value)}><option value="">Choose Staff</option>{data.staff.map(s => <option key={s.employeeId} value={s.employeeId}>{s.fullName}{!data.candidates.some(c => c.employeeId === s.employeeId) && ' · review constraints'}</option>)}</NativeSelect></label>
        <p className="text-xs text-slate-500">Active membership, overlap, approved leave, rest and weekly hours are checked again on confirmation.</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={overtime} onChange={e => setOvertime(e.target.checked)} />Allow weekly-hours exception with the recorded reason; tag for overtime review</label>
        <div className="flex flex-wrap gap-2"><Button disabled={save.isPending || !reason.trim() || !employee} onClick={() => act('Assign', { employeeId: Number(employee), allowWeeklyOvertime: overtime })}>Assign directly</Button><Button variant="outline" disabled={save.isPending || !reason.trim()} onClick={() => act('ManagerCover')}>Manager covers this shift</Button></div>
      </div>}
      {manager && data.slot.status === 'Open' && <Button variant="outline" disabled={save.isPending || !reason.trim()} onClick={() => act('Close')}>Close open slot</Button>}
      {manager && <details><summary className="cursor-pointer font-semibold">Offer and confirmation history ({data.history.length})</summary><ol className="max-h-60 space-y-2 overflow-auto text-sm">{data.history.map(event => <li key={event.id} className="border-l-2 border-slate-200 pl-2">{event.action} · {attendanceTime(event.createdAt)}<p>{event.reason}</p></li>)}</ol></details>}
    </div>}
    {save.isError && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(save.error)}</p>}
    <Button variant="outline" onClick={close}>Close details</Button>
  </DialogContent></Dialog>
}

export function CreateOpenShiftDialog({ lotId, shiftId, close }: { lotId: string; shiftId: number; close: () => void }) {
  const [reason, setReason] = useState(''); const mutation = useScheduleMutation()
  return <Dialog open onOpenChange={open => { if (!open) close() }}><DialogContent><DialogTitle>Find replacement Staff</DialogTitle><DialogDescription>Open one missing Staff place on this Published dated shift. The backend checks existing coverage and offers.</DialogDescription>
    <form className="space-y-3" onSubmit={e => { e.preventDefault(); mutation.mutate(() => workRequestsApi.createOpenShift(lotId, { shiftId, reason }), { onSuccess: close }) }}>
      <p>Shift #{shiftId}</p><label className="grid gap-1 text-sm">Reason<Input aria-label="Open shift creation reason" required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
      {mutation.isError && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(mutation.error)}</p>}
      <Button type="submit" disabled={mutation.isPending || !reason.trim()}>Create open slot</Button>
    </form>
  </DialogContent></Dialog>
}
