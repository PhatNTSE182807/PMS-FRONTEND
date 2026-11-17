import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { workRequestsApi } from '@/api/workRequests.service'
import { getErrorMessage } from '@/api/apiError'
import { useAuth } from '@/hooks/useAuth'
import { useAttendanceRealtime, workSchedulingKeys } from '@/hooks/useWorkScheduling'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/form-controls'
import { Spinner } from '@/components/ui/states'
import { RequestRows } from './AssignmentRequestPanel'
import OpenShiftDialog from './OpenShiftDialog'

export default function WorkRequestsBoard({ lotId }: { lotId: string }) {
  const { user } = useAuth(); useAttendanceRealtime(lotId)
  const [year, setYear] = useState(new Date().getFullYear()); const [slot, setSlot] = useState<number | null>(null)
  const [all, setAll] = useState(false)
  const query = useQuery({ queryKey: [...workSchedulingKeys, user?.userId, lotId, 'requests', year], queryFn: () => workRequestsApi.board(lotId, year), refetchInterval: 10_000, refetchOnReconnect: 'always', enabled: Boolean(lotId && year >= 1900 && year <= 9998) })
  const data = query.data; const manager = user?.role === 'MANAGER'
  const leaves = (data?.leaves ?? []).filter(l => all || l.status === 'Pending')
  const swaps = (data?.swaps ?? []).filter(s => all || ['AwaitingColleague', 'PendingManager'].includes(s.status))
  const slots = (data?.openShifts ?? []).filter(s => all || s.status === 'Open')
  return <Card className="space-y-4 p-5" aria-label="Leave swap and replacement requests">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Leave, swaps and replacement Staff</h2><Button size="sm" variant="outline" onClick={() => setAll(v => !v)}>{all ? 'Show pending only' : 'Show recent history'}</Button></div>
    <details><summary className="cursor-pointer text-sm font-semibold">Annual leave balances</summary><label className="mt-2 flex items-center gap-2 text-sm">Year<Input aria-label="Leave balance year" className="w-28" type="number" min={1900} max={9998} value={year} onChange={e => setYear(Number(e.target.value))} /></label>
      <p className="my-2 text-xs text-slate-500">Charged once per person/start date in the lot's time zone. Paid entitlement exhausted → unpaid leave; no payroll calculated.</p>
      <ul className="max-h-48 overflow-auto text-sm">{data?.balances.map(b => <li key={b.employeeId}>{b.staffName}: {b.entitledDays - b.paidDaysUsed} paid days remaining / {b.entitledDays} · {b.unpaidDays} unpaid days</li>)}</ul>
    </details>
    {query.isPending && <Spinner />}
    {query.isError && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(query.error)} <button className="underline" onClick={() => query.refetch()}>Retry</button></p>}
    {data && <>
      <p className="text-xs text-slate-500">Pending leave keeps the assignment active. Accepted offers wait for Manager confirmation and do not count towards staffing. Cut-off: {data.options.cutoffHoursBeforeStart ?? 'unconfigured'} hours before the shift; public offer maximum: {(data.options.publicClaimMinutes ?? 0) / 60} hours.</p>
      <RequestRows leaves={leaves} swaps={swaps} actorEmployeeId={!manager ? data.balances[0]?.employeeId : undefined} />
      <div className="grid gap-3 md:grid-cols-2">{slots.map(s => <button key={s.id} className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-950" onClick={() => setSlot(s.id)}><p className="font-semibold">{s.workDate} · {s.shiftName}</p><p>{s.status} · {s.stage}</p><p className="text-xs">View offer, claims and {manager ? 'confirm replacement' : 'respond'}</p></button>)}</div>
      {!leaves.length && !swaps.length && !slots.length && <p className="text-sm text-slate-500">No {all ? 'recent' : 'pending'} requests or visible open shifts. Open your assignment details to request leave or propose a swap.</p>}
    </>}
    {slot !== null && <OpenShiftDialog id={slot} close={() => setSlot(null)} />}
  </Card>
}
