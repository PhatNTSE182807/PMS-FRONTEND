import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { workSchedulingApi } from '@/api/workScheduling.service'
import { getErrorMessage } from '@/api/apiError'
import { useScheduleMutation } from '@/hooks/useWorkScheduling'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, NativeSelect } from '@/components/ui/form-controls'
import { useRotationSetup } from '@/hooks/useWorkRotation'
import type { DutyRoster, RotationGeneration, RotationPreview } from '@/types/workScheduling.dto'

export default function GenerateRotationPanel({ lotId, roster, onPreview }: { lotId: string; roster: DutyRoster; onPreview: (preview: RotationPreview | null) => void }) {
  const { groups, cycles } = useRotationSetup(lotId)
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState<RotationGeneration>({ fromDate: roster.fromDate, toDate: roster.toDate, cycleStartDate: roster.fromDate, cycleId: 0, groupIds: [], replaceGenerated: false, includeStandby: false, standbyGroupIds: [], revision: roster.revision })
  const [result, setResult] = useState<RotationPreview | null>(null)
  const [submitted, setSubmitted] = useState<RotationGeneration | null>(null)
  const preview = useMutation({ mutationFn: (value: RotationGeneration) => workSchedulingApi.previewRotation(lotId, roster.id, value), onSuccess: data => { setResult(data); onPreview(data) } })
  const save = useScheduleMutation()
  const update = (patch: Partial<RotationGeneration>) => { setInput(v => ({ ...v, ...patch })); setResult(null); onPreview(null) }
  const stale = submitted && submitted.revision !== roster.revision
  const busy = preview.isPending || save.isPending
  return <Card className="space-y-4 p-5">
    <div className="flex items-center justify-between"><div><h3 className="font-semibold">Rotation generation</h3><p className="text-sm text-slate-500">Generate into this Draft roster. Calendar modes do not change its period.</p></div><Button disabled={busy || roster.status !== 'Draft'} onClick={() => { setOpen(v => !v); if (open) { setResult(null); onPreview(null) } }}>Sinh lịch</Button></div>
    {open && <>
      {(groups.isError || cycles.isError) && <p role="alert">{getErrorMessage(groups.error ?? cycles.error)} <Button onClick={() => { void groups.refetch(); void cycles.refetch() }}>Retry</Button></p>}
      <fieldset disabled={busy} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-sm">From<Input aria-label="Generate from date" type="date" min={roster.fromDate} max={roster.toDate} value={input.fromDate} onChange={e => update({ fromDate: e.target.value })} /></label>
          <label className="grid gap-1 text-sm">Through<Input aria-label="Generate through date" type="date" min={input.fromDate} max={roster.toDate} value={input.toDate} onChange={e => update({ toDate: e.target.value })} /></label>
          <label className="grid gap-1 text-sm">Cycle start date<Input aria-label="Rotation cycle start date" type="date" value={input.cycleStartDate} onChange={e => update({ cycleStartDate: e.target.value })} /></label>
          <label className="grid gap-1 text-sm">Cycle<NativeSelect aria-label="Generation cycle" value={input.cycleId || ''} onChange={e => update({ cycleId: Number(e.target.value) })}><option value="">Choose cycle</option>{cycles.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></label>
        </div>
        <fieldset className="flex flex-wrap gap-4"><legend className="mb-2 text-sm font-semibold">Rotation groups</legend>{groups.data?.filter(g => g.isActive).map(g => <label key={g.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={input.groupIds.includes(g.id)} onChange={e => update({ groupIds: e.target.checked ? [...input.groupIds, g.id] : input.groupIds.filter(id => id !== g.id) })} />{g.name} (+{g.offsetDays} days)</label>)}</fieldset>
        {(!groups.data?.length || !cycles.data?.length) && <p className="text-sm text-amber-800">Configure groups and cycles in Rotation setup first.</p>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={input.replaceGenerated} onChange={e => update({ replaceGenerated: e.target.checked })} />Replace untouched generated assignments in the selected range/groups. Manual edits and attendance are always retained.</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={input.includeStandby} onChange={e => update({ includeStandby: e.target.checked })} />Schedule one standby per day from the selected pool</label>
        {input.includeStandby && <fieldset className="flex flex-wrap gap-4"><legend className="mb-2 text-sm font-semibold">Standby pool (free throughout the local day)</legend>{groups.data?.filter(g => g.isActive).map(g => <label key={g.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={input.standbyGroupIds.includes(g.id)} onChange={e => update({ standbyGroupIds: e.target.checked ? [...input.standbyGroupIds, g.id] : input.standbyGroupIds.filter(id => id !== g.id) })} />{g.name}</label>)}</fieldset>}
      </fieldset>
      <Button disabled={busy || !input.cycleId || !input.groupIds.length || (input.includeStandby && !input.standbyGroupIds.length)} onClick={() => { const value = { ...input, revision: roster.revision }; setSubmitted(value); preview.mutate(value) }}>Preview on calendar</Button>
      {preview.isError && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(preview.error)}</p>}
      {result && <div className="space-y-3 border-t border-slate-200 pt-3" aria-label="Rotation preview summary">
        <p className="font-semibold">Preview · {result.proposedAssignments} proposed additions · {result.roster.shifts.filter(s => s.workDate >= input.fromDate && s.workDate <= input.toDate).reduce((sum, s) => sum + s.assignments.length, 0)} direct assignments after save · {result.roster.shortages.filter(s => s.workDate >= input.fromDate && s.workDate <= input.toDate).length} position shortages · {result.issues.filter(i => i.blocking).length} conflicts/exclusions · {result.unassigned.length} Staff without direct work in this range</p>
        <p className="text-sm text-slate-600">Minimum rest: {result.minimumRestHours ?? 'unconfigured'} hours. Maximum planned hours: {result.maximumWeeklyHours ?? 'unconfigured'}/week, Monday–Sunday in the lot time zone. Standby is separate from direct staffing.</p>
        <p className="text-sm text-indigo-800">The calendar below shows this unsaved preview. Save as Draft, then adjust through the existing calendar before publishing.</p>
        <details open={result.issues.length > 0}><summary className="cursor-pointer font-medium">Violations and warnings ({result.issues.length})</summary><ul className="max-h-48 space-y-1 overflow-auto text-sm">{result.issues.map((issue, i) => <li key={i} className={issue.blocking ? 'text-rose-800' : 'text-amber-800'}>{issue.blocking ? 'Excluded/conflict' : 'Warning'} · {issue.date} {issue.employeeId ? `Staff #${issue.employeeId}` : ''} · {issue.message}</li>)}</ul></details>
        <details><summary className="cursor-pointer font-medium">Keep / add / replace ({result.changes.length})</summary><ul className="max-h-64 space-y-1 overflow-auto text-sm">{result.changes.map((change, i) => <li key={i}><strong>{change.kind}</strong> · {change.date} · {change.staffName} · {change.detail}</li>)}</ul></details>
        <details><summary className="cursor-pointer font-medium">Staff without direct work ({result.unassigned.length})</summary><p className="text-sm">{result.unassigned.map(s => s.fullName).join(', ') || 'None'}</p></details>
        {stale && <p role="alert" className="text-sm text-amber-800">Roster changed. Preview again before saving.</p>}
        {save.isError && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(save.error)}</p>}
        <div className="flex gap-2"><Button disabled={busy || Boolean(stale)} onClick={() => submitted && save.mutate(() => workSchedulingApi.applyRotation(lotId, roster.id, { ...submitted, previewToken: result.token }), { onSuccess: () => { setResult(null); onPreview(null); setOpen(false) } })}>Save preview as Draft</Button><Button variant="outline" disabled={busy} onClick={() => { setResult(null); onPreview(null) }}>Discard preview</Button></div>
      </div>}
    </>}
  </Card>
}
