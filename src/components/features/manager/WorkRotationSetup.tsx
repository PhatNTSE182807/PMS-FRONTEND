import { useState, type FormEvent } from 'react'
import { workSchedulingApi } from '@/api/workScheduling.service'
import { getErrorMessage } from '@/api/apiError'
import { useScheduleMutation } from '@/hooks/useWorkScheduling'
import { useRotationSetup } from '@/hooks/useWorkRotation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, NativeSelect } from '@/components/ui/form-controls'
import { Spinner } from '@/components/ui/states'
import type { RotationGroup, RotationCycle, RosterStaff, WorkShiftTemplate } from '@/types/workScheduling.dto'

function GroupForm({ lotId, group, staff, close }: { lotId: string; group?: RotationGroup; staff: RosterStaff[]; close: () => void }) {
  const [value, setValue] = useState<Omit<RotationGroup, 'id'>>(group ?? { name: '', offsetDays: 0, isActive: true, revision: 0, members: [] })
  const save = useScheduleMutation()
  function submit(e: FormEvent) { e.preventDefault(); save.mutate(() => workSchedulingApi.saveRotationGroup(lotId, value, group?.id), { onSuccess: close }) }
  const people = [...staff, ...value.members.filter(m => !staff.some(s => s.employeeId === m.employeeId)).map(m => ({ employeeId: m.employeeId, fullName: `Unavailable Staff #${m.employeeId}`, userId: '', employeeCode: '' }))]
  return <form onSubmit={submit} className="space-y-4 rounded-lg bg-slate-50 p-4">
    <h3 className="font-semibold">{group ? 'Edit rotation group' : 'New rotation group'}</h3>
    <label className="grid gap-1 text-sm">Group name<Input aria-label="Rotation group name" required maxLength={100} value={value.name} onChange={e => setValue({ ...value, name: e.target.value })} /></label>
    <label className="grid gap-1 text-sm">Offset into cycle (days)<Input aria-label="Group cycle offset" type="number" min={0} max={365} required value={value.offsetDays} onChange={e => setValue({ ...value, offsetDays: Number(e.target.value) })} /></label>
    <p className="text-xs text-slate-600">Offset advances this group into the cycle at the chosen cycle start date. Group offsets do not guarantee sufficient staffing.</p>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.isActive} onChange={e => setValue({ ...value, isActive: e.target.checked })} />Active group</label>
    <div className="max-h-72 space-y-2 overflow-auto">{people.map(person => {
      const member = value.members.find(m => m.employeeId === person.employeeId)
      return <div key={person.employeeId} className="flex items-center gap-3"><label className="flex flex-1 items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(member)} onChange={e => setValue({ ...value, members: e.target.checked ? [...value.members, { employeeId: person.employeeId }] : value.members.filter(m => m.employeeId !== person.employeeId) })} />{person.fullName}</label></div>
    })}</div>
    {save.isError && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(save.error)}</p>}
    <div className="flex gap-2"><Button type="submit" disabled={save.isPending}>Save group</Button><Button variant="outline" onClick={close}>Cancel</Button></div>
  </form>
}

function CycleForm({ lotId, cycle, templates, close }: { lotId: string; cycle?: RotationCycle; templates: WorkShiftTemplate[]; close: () => void }) {
  const [value, setValue] = useState<Omit<RotationCycle, 'id'>>(cycle ?? { name: '2–2–2–1', revision: 0, steps: [{ templateId: null, days: 2 }, { templateId: null, days: 2 }, { templateId: null, days: 2 }, { templateId: null, days: 1 }] })
  const save = useScheduleMutation()
  return <form className="space-y-4 rounded-lg bg-slate-50 p-4" onSubmit={e => { e.preventDefault(); save.mutate(() => workSchedulingApi.saveRotationCycle(lotId, value, cycle?.id), { onSuccess: close }) }}>
    <h3 className="font-semibold">{cycle ? 'Edit rotation cycle' : 'New rotation cycle'}</h3>
    <label className="grid gap-1 text-sm">Cycle name<Input aria-label="Rotation cycle name" required maxLength={100} value={value.name} onChange={e => setValue({ ...value, name: e.target.value })} /></label>
    <p className="text-sm text-slate-600">Default: 2 Morning → 2 Afternoon → 2 Night → 1 Rest. Select your lot's corresponding templates explicitly. Rest is not approved leave or standby.</p>
    {value.steps.map((step, index) => <div key={index} className="flex items-center gap-2">
      <span className="text-sm">{index + 1}.</span><NativeSelect aria-label={`Cycle block ${index + 1} shift`} value={step.templateId ?? ''} onChange={e => setValue({ ...value, steps: value.steps.map((s, i) => i === index ? { ...s, templateId: e.target.value ? Number(e.target.value) : null } : s) })}><option value="">Rest</option>{templates.filter(t => t.isActive || t.id === step.templateId).map(t => <option key={t.id} value={t.id}>{t.name}{!t.isActive && ' (inactive)'}</option>)}</NativeSelect>
      <Input className="w-24" aria-label={`Cycle block ${index + 1} days`} type="number" required min={1} max={31} value={step.days} onChange={e => setValue({ ...value, steps: value.steps.map((s, i) => i === index ? { ...s, days: Number(e.target.value) } : s) })} /><span className="text-sm">days</span>
      <Button variant="ghost" disabled={value.steps.length === 1} onClick={() => setValue({ ...value, steps: value.steps.filter((_, i) => i !== index) })}>Remove</Button>
    </div>)}
    <Button variant="outline" disabled={value.steps.length >= 93} onClick={() => setValue({ ...value, steps: [...value.steps, { templateId: null, days: 1 }] })}>Add block</Button>
    {save.isError && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(save.error)}</p>}
    <div className="flex gap-2"><Button type="submit" disabled={save.isPending}>Save cycle</Button><Button variant="outline" onClick={close}>Cancel</Button></div>
  </form>
}

export default function WorkRotationSetup({ lotId, templates, staff }: { lotId: string; templates: WorkShiftTemplate[]; staff: RosterStaff[] }) {
  const { groups, cycles } = useRotationSetup(lotId)
  const [group, setGroup] = useState<RotationGroup | 'new' | null>(null)
  const [cycle, setCycle] = useState<RotationCycle | 'new' | null>(null)
  if (groups.isPending || cycles.isPending) return <Spinner />
  if (groups.isError || cycles.isError) return <p role="alert">{getErrorMessage(groups.error ?? cycles.error)} <Button onClick={() => { void groups.refetch(); void cycles.refetch() }}>Retry</Button></p>
  return <div className="space-y-5">
    <Card className="space-y-4 p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Rotation groups</h2><Button onClick={() => setGroup('new')}>New group</Button></div>
      {group && <GroupForm key={group === 'new' ? 'new' : group.id} lotId={lotId} group={group === 'new' ? undefined : group} staff={staff} close={() => setGroup(null)} />}
      {groups.data.map(g => <div key={g.id} className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3"><p>{g.name} · offset +{g.offsetDays} days · {g.members.length} Staff · {g.isActive ? 'Active' : 'Inactive'}</p><Button variant="outline" size="sm" onClick={() => setGroup(g)}>Edit group</Button></div>)}
      {!groups.data.length && <p className="text-sm text-slate-500">Create Staff groups to rotate through the cycle.</p>}
    </Card>
    <Card className="space-y-4 p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Rotation cycles</h2><Button onClick={() => setCycle('new')}>New cycle</Button></div>
      {cycle && <CycleForm key={cycle === 'new' ? 'new' : cycle.id} lotId={lotId} cycle={cycle === 'new' ? undefined : cycle} templates={templates} close={() => setCycle(null)} />}
      {cycles.data.map(c => <div key={c.id} className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3"><div><p className="font-semibold">{c.name}</p><p className="text-sm text-slate-500">{c.steps.map(s => `${s.days} × ${templates.find(t => t.id === s.templateId)?.name ?? 'Rest'}`).join(' → ')} · {c.steps.reduce((sum, s) => sum + s.days, 0)} days</p></div><Button variant="outline" size="sm" onClick={() => setCycle(c)}>Edit cycle</Button></div>)}
    </Card>
  </div>
}
