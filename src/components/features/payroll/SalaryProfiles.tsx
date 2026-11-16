import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { payrollApi } from '@/api/payroll.service'
import { getErrorMessage } from '@/api/apiError'
import { useAuth } from '@/hooks/useAuth'
import { payrollKeys, usePayrollMutation } from '@/hooks/usePayroll'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, NativeSelect } from '@/components/ui/form-controls'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import type { PayrollPerson, SalaryProfile } from '@/types/payroll.dto'

function ProfileEditor({ people, profile, close }: { people: PayrollPerson[]; profile?: SalaryProfile; close: () => void }) {
  const save = usePayrollMutation()
  const [userId, setUser] = useState(profile?.userId ?? '')
  const [date, setDate] = useState(profile?.effectiveFrom ?? '')
  const [reason, setReason] = useState('')
  const person = people.find(p => p.userId === userId)
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries([
    'hourlyRate', 'monthlyRate', 'nightStart', 'nightEnd', 'nightFactor', 'holidayFactor', 'overtimeFactor', 'standbyDailyAllowance', 'standardWorkDays', 'managerProration', 'managerUnpaidLeavePolicy', 'currency', 'moneyDecimals', 'roundingMode',
  ].map(key => [key, profile?.[key as keyof SalaryProfile]?.toString() ?? ''])))
  const set = (key: string, value: string) => setValues(v => ({ ...v, [key]: value }))
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!person) return
    const fields = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value === '' ? null : ['nightStart', 'nightEnd'].includes(key) ? (value.length === 5 ? `${value}:00` : value) : ['currency', 'roundingMode', 'managerProration', 'managerUnpaidLeavePolicy'].includes(key) ? value : Number(value)]))
    save.mutate(() => payrollApi.saveProfile({ ...fields, userId, role: person.role, effectiveFrom: date, reason, revision: profile?.revision ?? 0 }, profile?.id), { onSuccess: close })
  }
  const numeric = (key: string, label: string, step = '0.000001') => <label className="grid gap-1 text-sm" key={key}>{label}<Input aria-label={label} type="number" min="0" step={step} placeholder="Not configured" value={values[key]} onChange={e => set(key, e.target.value)} /></label>
  return <Dialog open onOpenChange={v => { if (!v) close() }}><DialogContent className="max-w-3xl"><DialogTitle>{profile ? 'Edit effective salary version' : 'New effective salary version'}</DialogTitle><DialogDescription>Admin only. Blank fields remain unconfigured; calculation reports missing inputs. Approved and Paid payroll cannot be repriced.</DialogDescription>
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm">Employee<NativeSelect aria-label="Salary profile employee" required disabled={Boolean(profile)} value={userId} onChange={e => setUser(e.target.value)}><option value="">Choose Staff or Manager</option>{people.map(p => <option key={p.userId} value={p.userId}>{p.name} · {p.role}{p.isActive ? '' : ' · inactive'}</option>)}</NativeSelect></label>
        <label className="grid gap-1 text-sm">Effective from<Input aria-label="Salary effective date" type="date" required disabled={Boolean(profile)} value={date} onChange={e => setDate(e.target.value)} /></label></div>
      {person?.role === 'Staff' && <>
        <div className="grid gap-3 sm:grid-cols-3">{numeric('hourlyRate', 'Hourly rate')}{numeric('nightFactor', 'Night factor')}{numeric('holidayFactor', 'Holiday factor')}{numeric('overtimeFactor', 'Overtime factor')}{numeric('standbyDailyAllowance', 'Standby allowance per day')}</div>
        <div className="grid gap-3 sm:grid-cols-2">{['nightStart', 'nightEnd'].map(key => <label key={key} className="grid gap-1 text-sm">{key === 'nightStart' ? 'Night window starts' : 'Night window ends'}<Input aria-label={key === 'nightStart' ? 'Night window starts' : 'Night window ends'} type="time" step="1" value={values[key]} onChange={e => set(key, e.target.value)} /></label>)}</div>
        <p className="rounded bg-slate-50 p-3 text-xs">Night + holiday uses the higher factor. Approved overtime multiplies that higher factor by the overtime factor. Paid leave uses scheduled leave hours × ordinary hourly rate. There are no Late or cash shortage penalties.</p>
      </>}
      {person?.role === 'Manager' && <>
        <div className="grid gap-3 sm:grid-cols-2">{numeric('monthlyRate', 'Monthly salary')}{numeric('standardWorkDays', 'Standard workdays', '0.000001')}</div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm">Mid-month salary change policy<NativeSelect aria-label="Manager salary proration" value={values.managerProration} onChange={e => set('managerProration', e.target.value)}><option value="">Not agreed / not configured</option><option value="WholeMonthOnly">Require one monthly rate</option><option value="CalendarDays">Split base by effective calendar days</option></NativeSelect></label>
          <label className="grid gap-1 text-sm">Manager unpaid leave policy<NativeSelect aria-label="Manager unpaid leave policy" value={values.managerUnpaidLeavePolicy} onChange={e => set('managerUnpaidLeavePolicy', e.target.value)}><option value="">Not agreed / not configured</option><option value="NoDeduction">Retain monthly base</option><option value="DeductDaily">Deduct monthly rate / standard days</option></NativeSelect></label></div>
        <p className="text-xs text-slate-600">Only explicit locked Absent days reduce the base. Approved paid leave retains salary. Missing day records are not inferred as absences.</p>
      </>}
      <div className="grid gap-3 sm:grid-cols-3"><label className="grid gap-1 text-sm">Currency (3 letters)<Input aria-label="Payroll currency" maxLength={3} placeholder="Not configured" value={values.currency} onChange={e => set('currency', e.target.value.toUpperCase())} /></label>
        {numeric('moneyDecimals', 'Money decimal places', '1')}
        <label className="grid gap-1 text-sm">Rounding per line<NativeSelect aria-label="Payroll rounding mode" value={values.roundingMode} onChange={e => set('roundingMode', e.target.value)}><option value="">Not configured</option><option value="ToEven">Half to even</option><option value="AwayFromZero">Half away from zero</option></NativeSelect></label></div>
      <label className="grid gap-1 text-sm">Reason<Input aria-label="Salary profile reason" required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
      <Button type="submit" disabled={save.isPending || !person || !date || !reason.trim()}>Save effective version</Button>
      {save.isError && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(save.error)}</p>}
    </form>
  </DialogContent></Dialog>
}

export default function SalaryProfiles({ lotId, people = [] }: { lotId?: string; people?: PayrollPerson[] }) {
  const { user } = useAuth(); const admin = user?.role === 'ADMIN'
  const query = useQuery({ queryKey: [...payrollKeys, user?.userId, 'profiles', lotId], queryFn: () => payrollApi.profiles(lotId) })
  const [edit, setEdit] = useState<SalaryProfile | 'new' | null>(null)
  return <Card className="space-y-4 p-4">
    <div className="flex flex-wrap justify-between gap-3"><h2 className="font-semibold">Effective salary profiles</h2>{admin && <Button onClick={() => setEdit('new')}>New effective version</Button>}</div>
    {!admin && <p className="text-sm text-slate-600">Read-only Staff rates in this lot. This access is audited. Manager salaries are not included.</p>}
    <div className="overflow-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr>{['Employee', 'Role', 'Effective', 'Rate', 'Night / holiday / overtime', 'Standby', 'Rounding', ''].map((x, i) => <th key={i} className="border-b p-2">{x}</th>)}</tr></thead><tbody>{query.data?.map(p => <tr key={p.id}>
      <td className="border-b p-2">{people.find(u => u.userId === p.userId)?.name ?? p.employeeName ?? `Profile #${p.id}`}</td><td className="border-b p-2">{p.role}</td><td className="border-b p-2">{p.effectiveFrom}</td><td className="border-b p-2">{p.role === 'Staff' ? p.hourlyRate ?? 'Not configured' : p.monthlyRate ?? 'Not configured'} {p.currency}</td>
      <td className="border-b p-2">{p.nightFactor ?? '—'} / {p.holidayFactor ?? '—'} / {p.overtimeFactor ?? '—'}<span className="block text-xs">{p.nightStart ?? '?'} – {p.nightEnd ?? '?'}</span></td><td className="border-b p-2">{p.standbyDailyAllowance ?? 'Not configured'}</td><td className="border-b p-2">{p.moneyDecimals ?? '?'} · {p.roundingMode ?? 'Not configured'}</td><td className="border-b p-2">{admin && <Button size="sm" variant="outline" onClick={() => setEdit(p)}>Edit uncommitted version</Button>}</td>
    </tr>)}</tbody></table></div>
    {query.isError && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(query.error)}</p>}
    {edit && <ProfileEditor people={people} profile={edit === 'new' ? undefined : edit} close={() => setEdit(null)} />}
  </Card>
}
