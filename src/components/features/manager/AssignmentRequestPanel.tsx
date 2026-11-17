import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { workRequestsApi } from '@/api/workRequests.service'
import { getErrorMessage } from '@/api/apiError'
import { useAuth } from '@/hooks/useAuth'
import { useScheduleMutation, workSchedulingKeys } from '@/hooks/useWorkScheduling'
import { Button } from '@/components/ui/button'
import { Input, NativeSelect } from '@/components/ui/form-controls'
import { Spinner } from '@/components/ui/states'
import type { LeaveRequest, SwapRequest } from '@/types/workRequests.dto'
import { attendanceTime } from '@/lib/workAttendance'

export function RequestRows({ leaves, swaps, actorEmployeeId }: { leaves: LeaveRequest[]; swaps: SwapRequest[]; actorEmployeeId?: number }) {
  const { user } = useAuth(); const mutation = useScheduleMutation(); const [reason, setReason] = useState('')
  const manager = user?.role === 'MANAGER'
  const actLeave = (row: LeaveRequest, action: string) => mutation.mutate(() => workRequestsApi.leaveAction(row.id, { revision: row.revision, action, reason }))
  const actSwap = (row: SwapRequest, action: string) => mutation.mutate(() => workRequestsApi.swapAction(row.id, { revision: row.revision, action, reason }))
  return <div className="space-y-3">
    {manager && (leaves.some(l => l.status === 'Pending') || swaps.some(s => s.status === 'PendingManager')) && <label className="grid gap-1 text-sm">Decision reason (required)<Input aria-label="Request decision reason" maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>}
    {leaves.map(row => <div key={`leave-${row.id}`} className="space-y-2 rounded border border-slate-200 p-3 text-sm"><p className="font-semibold">Leave #{row.id} · {row.staffName} · {row.leaveDate} · {row.kind} · {row.status}</p><p>{row.reason}</p>{row.status === 'Approved' && <p>{row.isPaid ? 'Paid leave' : 'Unpaid leave'} · Original assignment retained as leave history</p>}{row.decisionReason && <p className="text-xs text-slate-500">Decision: {row.decisionReason}</p>}
      {row.status === 'Pending' && <div className="flex flex-wrap gap-2">{manager ? <><Button size="sm" disabled={mutation.isPending || !reason.trim()} onClick={() => actLeave(row, 'Approve')}>Approve leave</Button><Button size="sm" variant="outline" disabled={mutation.isPending || !reason.trim()} onClick={() => actLeave(row, 'Reject')}>Reject leave</Button></> : row.employeeId === actorEmployeeId && <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => actLeave(row, 'Cancel')}>Cancel pending leave</Button>}</div>}
    </div>)}
    {swaps.map(row => <div key={`swap-${row.id}`} className="space-y-2 rounded border border-slate-200 p-3 text-sm"><p className="font-semibold">Swap #{row.id} · {row.staffName} ↔ {row.otherStaffName} · {row.status}</p><p>Assignments #{row.assignmentId} ↔ #{row.otherAssignmentId} · {row.reason}</p>{row.decisionReason && <p className="text-xs text-slate-500">Decision: {row.decisionReason}</p>}
      <div className="flex flex-wrap gap-2">{!manager && row.status === 'AwaitingColleague' && row.otherEmployeeId === actorEmployeeId && <><Button size="sm" disabled={mutation.isPending} onClick={() => actSwap(row, 'Accept')}>Agree to swap</Button><Button variant="outline" size="sm" disabled={mutation.isPending} onClick={() => actSwap(row, 'Decline')}>Decline swap</Button></>}
        {manager && row.status === 'PendingManager' && <><Button size="sm" disabled={mutation.isPending || !reason.trim()} onClick={() => actSwap(row, 'Approve')}>Approve swap</Button><Button size="sm" variant="outline" disabled={mutation.isPending || !reason.trim()} onClick={() => actSwap(row, 'Reject')}>Reject swap</Button></>}
        {!manager && row.employeeId === actorEmployeeId && ['AwaitingColleague', 'PendingManager'].includes(row.status) && <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => actSwap(row, 'Cancel')}>Cancel swap</Button>}
      </div>
    </div>)}
    {mutation.isError && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(mutation.error)}</p>}
  </div>
}

export default function AssignmentRequestPanel({ assignmentId }: { assignmentId: number }) {
  const { user } = useAuth(); const mutation = useScheduleMutation()
  const query = useQuery({ queryKey: [...workSchedulingKeys, user?.userId, 'assignment-requests', assignmentId], queryFn: () => workRequestsApi.assignment(assignmentId), refetchInterval: 10_000, refetchOnReconnect: 'always' })
  const [mode, setMode] = useState<'leave' | 'swap' | null>(null); const [reason, setReason] = useState('')
  const [kind, setKind] = useState('Planned'); const [other, setOther] = useState('')
  if (query.isPending) return <Spinner />
  if (!query.data) return <p role="alert" className="text-sm text-rose-700">{getErrorMessage(query.error)} <button onClick={() => query.refetch()}>Retry</button></p>
  const data = query.data
  return <section aria-label="Assignment requests" className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
    <h3 className="font-semibold">Leave and shift swap</h3>
    <p className="text-xs text-slate-500">Assignment #{data.assignmentId} · {data.status}. Pending requests keep the original assignment in force.</p>
    <RequestRows leaves={data.leaves} swaps={data.swaps} actorEmployeeId={user?.role === 'STAFF' ? data.employeeId : undefined} />
    {data.canRequest && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setMode('leave'); setKind(new Date(data.startsAt).getTime() - Date.now() >= 24 * 3600_000 ? 'Planned' : 'Emergency') }}>Request leave</Button><Button size="sm" variant="outline" onClick={() => setMode('swap')}>Propose shift swap</Button></div>}
    {data.canRequest && mode && <form className="space-y-3 border-t border-slate-200 pt-3" onSubmit={e => {
      e.preventDefault(); mutation.mutate(() => mode === 'leave' ? workRequestsApi.leave({ assignmentId, kind, reason }) : workRequestsApi.swap({ assignmentId, otherAssignmentId: Number(other), reason }), { onSuccess: () => { setMode(null); setReason('') } })
    }}>
      {mode === 'leave' ? <>
        <label className="grid gap-1 text-sm">Leave type<NativeSelect aria-label="Leave type" value={kind} onChange={e => setKind(e.target.value)}><option value="Planned">Planned · at least 24 hours notice</option><option value="Emergency">Emergency · less than 24 hours</option></NativeSelect></label>
      </> : <label className="grid gap-1 text-sm">Colleague's Published assignment<NativeSelect aria-label="Swap with assignment" required value={other} onChange={e => setOther(e.target.value)}><option value="">Choose assignment</option>{data.swapCandidates.map(s => <option key={s.assignmentId} value={s.assignmentId}>{s.staffName} · {s.shiftName} · {attendanceTime(s.startsAt)} → {attendanceTime(s.endsAt)}</option>)}</NativeSelect><span className="text-xs text-slate-500">The colleague must agree, then the Manager approves both changes together. Eligibility is checked again on approval.</span></label>}
      <label className="grid gap-1 text-sm">Reason<textarea aria-label="New request reason" required maxLength={1000} rows={2} value={reason} onChange={e => setReason(e.target.value)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-900" /></label>
      <div className="flex gap-2"><Button size="sm" type="submit" disabled={mutation.isPending || !reason.trim() || (mode === 'swap' && !other)}>Submit request</Button><Button size="sm" variant="outline" onClick={() => setMode(null)}>Cancel form</Button></div>
    </form>}
    {mutation.isError && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(mutation.error)}</p>}
  </section>
}
