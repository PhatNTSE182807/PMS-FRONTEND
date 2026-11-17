import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { payrollApi } from '@/api/payroll.service'
import { getErrorMessage } from '@/api/apiError'
import { useAuth } from '@/hooks/useAuth'
import { payrollKeys, usePayrollMutation } from '@/hooks/usePayroll'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, NativeSelect } from '@/components/ui/form-controls'
import type { PayrollAdjustment, PayrollPerson } from '@/types/payroll.dto'

export default function PayrollAdjustments({ lotId, month, people }: { lotId: string; month: string; people: PayrollPerson[] }) {
  const { user } = useAuth(); const save = usePayrollMutation()
  const [userId, setUser] = useState(''); const [kind, setKind] = useState<PayrollAdjustment['kind']>('Adjustment'); const [quantity, setQuantity] = useState(''); const [rate, setRate] = useState(''); const [reason, setReason] = useState(''); const [sourceId, setSource] = useState(''); const [carryId, setCarry] = useState('')
  const person = people.find(p => p.userId === userId)
  const query = useQuery({ queryKey: [...payrollKeys, user?.userId, 'adjustments', lotId, month], queryFn: () => payrollApi.adjustments(lotId, `${month}-01`) })
  const previous = useQuery({ queryKey: [...payrollKeys, user?.userId, 'slips', lotId, 'all'], queryFn: () => payrollApi.slips(lotId) })
  const carryList = useQuery({ queryKey: [...payrollKeys, user?.userId, 'carries', lotId], queryFn: () => payrollApi.carries(lotId) })
  const carries = carryList.data?.filter(c => c.employeeId === person?.employeeId) ?? []
  return <Card className="space-y-4 p-4"><h2 className="font-semibold">Subsequent-month adjustments and Manager allowances / bonuses</h2>
    <p className="text-sm text-slate-600">Entries are append-only. A negative correction needs an earlier approved/paid payslip or a locked hours carry. A carry valuation preserves its signed hours; Admin supplies the unit rate explicitly. Paid source payslips remain unchanged.</p>
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); if (!person) return; save.mutate(() => payrollApi.addAdjustment({ userId, role: person.role, parkingLotId: Number(lotId), payMonth: `${month}-01`, sourceSlipId: sourceId ? Number(sourceId) : null, sourceCarryId: carryId ? Number(carryId) : null, kind, quantity: Number(quantity), unitRate: Number(rate), reason }), { onSuccess: () => { setReason(''); setQuantity(''); setCarry('') } }) }}>
      <label className="grid gap-1 text-sm">Employee<NativeSelect aria-label="Payroll adjustment employee" required value={userId} onChange={e => { setUser(e.target.value); setSource(''); setCarry(''); setKind('Adjustment') }}><option value="">Choose employee</option>{people.map(p => <option key={p.userId} value={p.userId}>{p.name} · {p.role}</option>)}</NativeSelect></label>
      <label className="grid gap-1 text-sm">Item type<NativeSelect value={kind} onChange={e => setKind(e.target.value as PayrollAdjustment['kind'])}><option value="Adjustment">Traced correction</option>{person?.role === 'Manager' && <><option value="Allowance">Manager allowance</option><option value="Bonus">Manager bonus</option></>}</NativeSelect></label>
      <label className="grid gap-1 text-sm">Earlier source payslip<NativeSelect aria-label="Adjustment source payslip" value={sourceId} onChange={e => setSource(e.target.value)}><option value="">No source payslip</option>{previous.data?.filter(s => s.userId === userId && s.status !== 'Draft' && s.payMonth < `${month}-01`).map(s => <option key={s.id} value={s.id}>#{s.id} · {s.payMonth.slice(0, 7)} · {s.status}</option>)}</NativeSelect></label>
      <label className="grid gap-1 text-sm">Locked attendance hours carry<NativeSelect aria-label="Adjustment attendance carry" value={carryId} onChange={e => { const c = carries.find(c => c.id.toString() === e.target.value); setCarry(e.target.value); if (c) setQuantity(String(c.hours)) }}><option value="">No attendance carry</option>{carries.map(c => <option key={c.id} value={c.id}>#{c.id} · {c.hours} hours · {c.reason}</option>)}</NativeSelect></label>
      <label className="grid gap-1 text-sm">Signed quantity<Input aria-label="Payroll correction quantity" type="number" step="0.000001" required disabled={Boolean(carryId)} value={quantity} onChange={e => setQuantity(e.target.value)} /></label>
      <label className="grid gap-1 text-sm">Unit rate<Input aria-label="Payroll correction unit rate" type="number" min="0" step="0.000001" required value={rate} onChange={e => setRate(e.target.value)} /></label>
      <label className="grid gap-1 text-sm sm:col-span-2">Reason<Input aria-label="Payroll adjustment reason" maxLength={1000} required value={reason} onChange={e => setReason(e.target.value)} /></label>
      <Button type="submit" disabled={save.isPending || !person || !Number(quantity) || rate === '' || !reason.trim()}>Record for {month}</Button>
    </form>
    <ul className="space-y-2 text-sm">{query.data?.map(a => <li key={a.id} className="rounded border p-2">#{a.id} · {people.find(p => p.userId === a.userId)?.name ?? 'Employee'} · {a.kind} · {a.quantity} × {a.unitRate} · {a.reason}</li>)}</ul>
    {(query.isError || save.isError || carryList.isError) && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(query.error ?? save.error ?? carryList.error)}</p>}
  </Card>
}
