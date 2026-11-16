import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { workRequestsApi } from '@/api/workRequests.service'
import { getErrorMessage } from '@/api/apiError'
import { useAuth } from '@/hooks/useAuth'
import { useScheduleMutation, workSchedulingKeys } from '@/hooks/useWorkScheduling'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, NativeSelect } from '@/components/ui/form-controls'

export default function AdminLeaveBalances() {
  const { user } = useAuth(); const mutation = useScheduleMutation()
  const [open, setOpen] = useState(false); const [year, setYear] = useState(new Date().getFullYear())
  const [id, setId] = useState(''); const [days, setDays] = useState(12); const [reason, setReason] = useState(''); const [revision, setRevision] = useState(0)
  const query = useQuery({ queryKey: [...workSchedulingKeys, user?.userId, 'admin-leave', year], queryFn: () => workRequestsApi.adminBalances(year), enabled: open && user?.role === 'ADMIN' && year >= 1900 && year <= 9998 })
  const current = query.data?.find(b => b.employeeId.toString() === id)
  return <Card className="space-y-3 p-4"><Button variant="outline" onClick={() => setOpen(v => !v)}>Annual Staff leave entitlements</Button>{open && <form className="space-y-3" onSubmit={e => { e.preventDefault(); mutation.mutate(() => workRequestsApi.setBalance(Number(id), year, { revision, entitledDays: days, reason }), { onSuccess: () => { setId(''); setReason('') } }) }}>
    <p className="text-sm text-slate-500">Admin can adjust annual entitlement with an audit reason. Existing paid/unpaid approvals are preserved.</p>
    <label className="grid gap-1 text-sm">Year<Input aria-label="Admin leave year" type="number" min={1900} max={9998} value={year} onChange={e => { setYear(Number(e.target.value)); setId('') }} /></label>
    <label className="grid gap-1 text-sm">Staff<NativeSelect aria-label="Leave entitlement Staff" value={id} onChange={e => { const row = query.data?.find(b => b.employeeId.toString() === e.target.value); setId(e.target.value); setDays(row?.entitledDays ?? 12); setRevision(row?.revision ?? 0) }}><option value="">Choose Staff</option>{query.data?.map(b => <option key={b.employeeId} value={b.employeeId}>{b.staffName} · {b.paidDaysUsed} paid days used</option>)}</NativeSelect></label>
    <label className="grid gap-1 text-sm">Paid-day entitlement<Input aria-label="Paid leave entitlement" type="number" min={current?.paidDaysUsed ?? 0} max={366} required value={days} onChange={e => setDays(Number(e.target.value))} /></label>
    <label className="grid gap-1 text-sm">Reason<Input aria-label="Leave entitlement reason" required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
    <Button type="submit" disabled={!id || !reason.trim() || mutation.isPending || current?.revision !== revision}>Save entitlement</Button>
    {(query.isError || mutation.isError) && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(query.error ?? mutation.error)}</p>}
  </form>}</Card>
}
