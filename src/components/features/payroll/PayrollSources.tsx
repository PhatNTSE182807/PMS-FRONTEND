import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { payrollApi } from '@/api/payroll.service'
import { getErrorMessage } from '@/api/apiError'
import { useAuth } from '@/hooks/useAuth'
import { payrollKeys, usePayrollMutation } from '@/hooks/usePayroll'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, NativeSelect } from '@/components/ui/form-controls'
import type { PayrollPerson, PayrollSource } from '@/types/payroll.dto'

function SealSource({ source, people }: { source: PayrollSource; people: PayrollPerson[] }) {
  const save = usePayrollMutation(); const [reason, setReason] = useState(''); const [manager, setManager] = useState(source.managerUserId ?? '')
  return <div className="space-y-2 rounded border p-3"><h3 className="font-semibold">{source.name} · {source.fromDate} – {source.toDate}</h3>
    {source.sealed ? <p className="break-all text-xs">Sealed · {source.hash}</p> : <>
      <p className="text-xs text-slate-600">This legacy attendance period predates payroll source snapshots. Sealing verifies approved totals and retains its source times, paid leave and holidays without editing locked attendance.</p>
      {!source.managerUserId && <label className="grid gap-1 text-sm">Historical Manager (explicit Admin confirmation)<NativeSelect aria-label={`Historical Manager for source ${source.periodLotId}`} value={manager} onChange={e => setManager(e.target.value)}><option value="">Select the Manager for this locked period</option>{people.filter(p => p.role === 'Manager').map(p => <option key={p.userId} value={p.userId}>{p.name}</option>)}</NativeSelect></label>}
      <label className="grid gap-1 text-sm">Seal reason<Input aria-label={`Payroll source ${source.periodLotId} reason`} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
      <Button size="sm" disabled={save.isPending || !reason.trim() || !manager} onClick={() => save.mutate(() => payrollApi.seal(source.periodLotId, { reason, managerUserId: manager }))}>Seal verified payroll source</Button>
    </>}
    {save.isError && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(save.error)}</p>}
  </div>
}
export default function PayrollSources({ lotId, people }: { lotId: string; people: PayrollPerson[] }) {
  const { user } = useAuth()
  const query = useQuery({ queryKey: [...payrollKeys, user?.userId, 'sources', lotId], queryFn: () => payrollApi.sources(lotId) })
  return <Card className="space-y-3 p-4"><h2 className="font-semibold">Locked attendance sources</h2><p className="text-sm text-slate-600">The full payroll calendar month needs locked attendance coverage. Newly locked periods capture payroll sources automatically; legacy periods must be explicitly verified and sealed.</p>
    {query.data?.map(s => <SealSource key={s.periodLotId} source={s} people={people} />)}
    {query.data?.length === 0 && <p>No locked attendance periods at this lot.</p>}
    {query.isError && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(query.error)}</p>}
  </Card>
}
