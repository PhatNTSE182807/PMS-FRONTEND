import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { payrollApi } from '@/api/payroll.service'
import { getErrorMessage } from '@/api/apiError'
import { useAuth } from '@/hooks/useAuth'
import { payrollKeys, usePayrollMutation, usePayrollRealtime } from '@/hooks/usePayroll'
import { WithManagerLot } from '@/components/features/manager/ManagerBits'
import { useManagerLot } from '@/hooks/useManagerLot'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, NativeSelect } from '@/components/ui/form-controls'
import SalaryProfiles from '@/components/features/payroll/SalaryProfiles'
import PayrollAdjustments from '@/components/features/payroll/PayrollAdjustments'
import PayrollSlipDialog, { PayrollLines } from '@/components/features/payroll/PayrollSlipDialog'
import { payrollNumber } from '@/lib/payroll'
import type { PayrollDirectory, PayrollRole } from '@/types/payroll.dto'

function Workspace({ lotId, directory, lotControl, personal = false }: { lotId?: string; directory?: PayrollDirectory; lotControl?: React.ReactNode; personal?: boolean }) {
  const { user } = useAuth(); const admin = user?.role === 'ADMIN'; const manager = user?.role === 'MANAGER'
  usePayrollRealtime(lotId)
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); const [tab, setTab] = useState('slips'); const [selected, setSelected] = useState<number | null>(null)
  const [role, setRole] = useState<PayrollRole | ''>(''); const [reason, setReason] = useState('')
  const [employee, setEmployee] = useState('')
  const save = usePayrollMutation()
  const preview = useMutation({ mutationFn: () => payrollApi.preview({ parkingLotId: Number(lotId), payMonth: `${month}-01`, role: role || undefined, userId: employee || undefined }) })
  const slips = useQuery({ queryKey: [...payrollKeys, user?.userId, 'slips', lotId, month, personal], queryFn: () => payrollApi.slips(lotId, `${month}-01`, personal), enabled: Boolean(month), refetchInterval: 15_000, refetchOnReconnect: 'always' })
  const audit = useQuery({ queryKey: [...payrollKeys, user?.userId, 'audit', lotId], queryFn: () => payrollApi.audit(lotId), enabled: admin && tab === 'audit' })
  const people = directory?.people ?? []
  const immutableSelection = slips.data?.some(s => s.status !== 'Draft' && (!role || s.role === role) && (!employee || s.userId === employee)) ?? false
  return <div className="space-y-5"><PageHeader title={admin ? 'Payroll' : manager && !personal ? 'Staff payroll in this lot' : 'My payslips'} description={admin ? 'Calculate monthly payroll from the locked attendance month, review explanations, approve and record external payments.' : 'Approved and Paid payslips. Review frozen sources and submit a complaint about your own payslip.'} />
    <div className="flex flex-wrap items-end gap-3">{lotControl}<label className="grid gap-1 text-sm">Payroll month<Input aria-label="Payroll month" type="month" value={month} onChange={e => { if (e.target.value) { setMonth(e.target.value); preview.reset() } }} /></label></div>
    {(admin || (manager && !personal)) && <div className="flex flex-wrap gap-2">{['slips', 'profiles', ...(admin ? ['adjustments', 'audit'] : [])].map(key => <Button key={key} variant={tab === key ? 'default' : 'outline'} onClick={() => setTab(key)}>{key[0].toUpperCase() + key.slice(1)}</Button>)}</div>}
    {tab === 'profiles' ? <SalaryProfiles lotId={manager ? lotId : undefined} people={people} /> : tab === 'adjustments' && lotId ? <PayrollAdjustments lotId={lotId} month={month} people={people} /> : tab === 'audit' ? <Card className="space-y-2 p-4"><h2 className="font-semibold">Salary access and change audit</h2><ul className="max-h-[60vh] space-y-2 overflow-auto text-xs">{audit.data?.map(a => <li key={a.id}>{a.createdAt} · {a.action} · {a.actorId} · {a.payrollSlipId ? `payslip #${a.payrollSlipId}` : ''} · {a.reason}</li>)}</ul>{audit.isError && <p role="alert">{getErrorMessage(audit.error)}</p>}</Card> : <>
      {admin && lotId && <Card className="space-y-3 p-4"><h2 className="font-semibold">Calculate {month} · {directory?.lots.find(l => l.id.toString() === lotId)?.name}</h2><p className="text-sm text-slate-600">Lock this month's attendance first. Preview is read-only. Saving recalculates on the server and only updates Draft payslips. Approved / Paid amounts stay fixed.</p>
        <label className="grid gap-1 text-sm">Employees to calculate<NativeSelect aria-label="Payroll calculation role" value={role} onChange={e => { setRole(e.target.value as PayrollRole | ''); setEmployee(''); preview.reset() }}><option value="">Staff and Manager</option><option value="Staff">Staff only</option><option value="Manager">Manager only</option></NativeSelect></label>
        <label className="grid gap-1 text-sm">Employee scope<NativeSelect aria-label="Payroll calculation employee" value={employee} onChange={e => { setEmployee(e.target.value); preview.reset() }}><option value="">All employees in selected role with locked evidence</option>{people.filter(p => !role || p.role === role).map(p => <option key={p.userId} value={p.userId}>{p.name} · {p.role}</option>)}</NativeSelect></label>
        <label className="grid gap-1 text-sm">Calculation reason<Input aria-label="Payroll calculation reason" required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
        {immutableSelection && <p className="text-sm text-amber-900">This selection includes Approved/Paid payroll. Select an employee whose payslip is still Draft or has not been created.</p>}
        <div className="flex gap-2"><Button variant="outline" disabled={preview.isPending || save.isPending} onClick={() => preview.mutate()}>Preview payroll</Button><Button disabled={save.isPending || preview.isPending || immutableSelection || !reason.trim()} onClick={() => save.mutate(() => payrollApi.generate({ parkingLotId: Number(lotId), payMonth: `${month}-01`, role: role || undefined, userId: employee || undefined, reason }), { onSuccess: () => preview.reset() })}>Calculate / refresh Draft</Button></div>
        {preview.data?.map(p => <details key={p.userId}><summary className="cursor-pointer text-sm font-semibold">{p.employeeName} · {p.role} · {payrollNumber(p.total)} {p.currency}</summary><PayrollLines lines={p.lines} currency={p.currency} /></details>)}
        {(preview.isError || save.isError) && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(preview.error ?? save.error)}</p>}
      </Card>}
      <Card className="space-y-3 p-4"><h2 className="font-semibold">{month} payslips</h2><div className="overflow-auto"><table className="w-full min-w-[660px] text-left text-sm"><thead><tr>{['Employee', 'Role', 'Month', 'Status', 'Amount', ''].map((x, i) => <th key={i} className="border-b p-2">{x}</th>)}</tr></thead><tbody>{slips.data?.map(s => <tr key={s.id}><td className="border-b p-2">{s.employeeName}</td><td className="border-b p-2">{s.role}</td><td className="border-b p-2">{s.payMonth.slice(0, 7)}</td><td className="border-b p-2 font-semibold">{s.status}</td><td className="border-b p-2">{payrollNumber(s.total)} {s.currency}</td><td className="border-b p-2"><Button size="sm" variant="outline" onClick={() => setSelected(s.id)}>View payslip #{s.id}</Button></td></tr>)}</tbody></table></div>{slips.data?.length === 0 && <p className="text-sm text-slate-600">No visible payslips in this month.</p>}{slips.isError && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(slips.error)}</p>}</Card>
    </>}
    {selected !== null && <PayrollSlipDialog id={selected} close={() => setSelected(null)} />}
  </div>
}
function ManagerPayroll({ lotId }: { lotId: string }) {
  const { lots, setLotId } = useManagerLot()
  return <Workspace key={lotId} lotId={lotId} lotControl={<label className="grid gap-1 text-sm">Parking lot<NativeSelect aria-label="Payroll parking lot" value={lotId} onChange={e => setLotId(e.target.value)}>{lots.data?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</NativeSelect></label>} />
}
function AdminPayroll() {
  const { user } = useAuth(); const [lot, setLot] = useState('')
  const directory = useQuery({ queryKey: [...payrollKeys, user?.userId, 'directory'], queryFn: payrollApi.directory })
  const lotId = lot || directory.data?.lots[0]?.id.toString()
  return <><Workspace key={lotId} lotId={lotId} directory={directory.data} lotControl={<label className="grid gap-1 text-sm">Parking lot<NativeSelect aria-label="Payroll parking lot" value={lotId ?? ''} onChange={e => setLot(e.target.value)}><option value="">Select lot</option>{directory.data?.lots.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</NativeSelect></label>} />{directory.isError && <p role="alert">{getErrorMessage(directory.error)}</p>}</>
}
function ManagerPayrollHome() {
  const [personal, setPersonal] = useState(false)
  return <div className="space-y-4"><div className="flex flex-wrap gap-2"><Button variant={personal ? 'outline' : 'default'} onClick={() => setPersonal(false)}>Staff payroll by lot</Button><Button variant={personal ? 'default' : 'outline'} onClick={() => setPersonal(true)}>My payslips · all lots</Button></div>{personal ? <Workspace key="mine" personal /> : <WithManagerLot>{lot => <ManagerPayroll lotId={lot.id} />}</WithManagerLot>}</div>
}
export default function PayrollPage() {
  const { user } = useAuth()
  return user?.role === 'ADMIN' ? <AdminPayroll /> : user?.role === 'MANAGER' ? <ManagerPayrollHome /> : <Workspace personal />
}
