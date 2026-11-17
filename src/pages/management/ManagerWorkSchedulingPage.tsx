import { useState, type FormEvent, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Clock, History, Pencil, Plus, Users } from 'lucide-react'
import { workSchedulingApi } from '@/api/workScheduling.service'
import { getErrorMessage } from '@/api/apiError'
import { WithManagerLot } from '@/components/features/manager/ManagerBits'
import WorkScheduleCalendar, { ScheduleToolbar, type CalendarCell } from '@/components/features/manager/WorkScheduleCalendar'
import CalendarAssignmentDialog from '@/components/features/manager/CalendarAssignmentDialog'
import WorkRotationSetup from '@/components/features/manager/WorkRotationSetup'
import GenerateRotationPanel from '@/components/features/manager/GenerateRotationPanel'
import StandbyEditor from '@/components/features/manager/StandbyEditor'
import WorkRequestsBoard from '@/components/features/manager/WorkRequestsBoard'
import AttendancePeriodReviewPanel from '@/components/features/manager/AttendancePeriodReviewPanel'
import type { RotationPreview } from '@/types/workScheduling.dto'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, NativeSelect } from '@/components/ui/form-controls'
import { EmptyState, ErrorState, Spinner } from '@/components/ui/states'
import { useScheduleMutation, useWorkScheduling, workSchedulingKeys } from '@/hooks/useWorkScheduling'
import { useAuth } from '@/hooks/useAuth'
import { useManagerLot } from '@/hooks/useManagerLot'
import { calendarRange, type CalendarView } from '@/lib/workScheduleCalendar'
import { toIsoDate } from '@/lib/format'
import type { ManagedLot } from '@/types/lot-management.dto'
import type { DutyAssignment, DutyRoster, RosterShift, RosterStaff, WorkShiftTemplate, WorkShiftTemplateInput } from '@/types/workScheduling.dto'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium text-slate-700">{label}{children}</label>
}

function TemplateForm({ lotId, template, close }: { lotId: string; template?: WorkShiftTemplate; close: () => void }) {
  const save = useScheduleMutation()
  const [value, setValue] = useState<WorkShiftTemplateInput>(template ?? { name: '', startTime: '06:00:00', endTime: '14:00:00', minimumStaff: 2, isActive: true, revision: 0 })
  const patch = (change: Partial<WorkShiftTemplateInput>) => setValue(v => ({ ...v, ...change }))
  function submit(e: FormEvent) {
    e.preventDefault()
    save.mutate(() => workSchedulingApi.saveTemplate(lotId, value, template?.id), { onSuccess: close })
  }
  return <form onSubmit={submit} className="space-y-4 rounded-xl bg-slate-50 p-5 ring-1 ring-slate-200">
    <h3 className="font-semibold text-slate-950">{template ? 'Edit shift template' : 'New shift template'}</h3>
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Shift name"><Input required maxLength={100} value={value.name} onChange={e => patch({ name: e.target.value })} /></Field>
      <Field label="Starts at"><Input required type="time" step="60" value={value.startTime.slice(0, 5)} onChange={e => patch({ startTime: `${e.target.value}:00` })} /></Field>
      <Field label="Ends at"><Input required type="time" step="60" value={value.endTime.slice(0, 5)} onChange={e => patch({ endTime: `${e.target.value}:00` })} /></Field>
      <Field label="Minimum staff"><Input type="number" required min={0} max={100} value={value.minimumStaff} onChange={e => patch({ minimumStaff: Number(e.target.value) })} /></Field>
    </div>
    <p className="text-sm text-slate-600">End times before the start time finish on the next day. Equal times are not allowed. Existing dated shifts keep their saved hours and staffing needs.</p>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.isActive} onChange={e => patch({ isActive: e.target.checked })} />Available for new shifts</label>
    {save.isError && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(save.error)}</p>}
    <div className="flex gap-2"><Button type="submit" disabled={save.isPending}>{save.isPending && <Spinner />}Save template</Button><Button type="button" variant="outline" onClick={close}>Cancel</Button></div>
  </form>
}

function CreateRoster({ lotId, close, created }: { lotId: string; close: () => void; created: (r: DutyRoster) => void }) {
  const save = useScheduleMutation()
  const [name, setName] = useState('')
  const [fromDate, setFrom] = useState(toIsoDate(new Date()))
  const [toDate, setTo] = useState(toIsoDate(new Date()))
  return <form className="space-y-4 rounded-xl bg-slate-50 p-5 ring-1 ring-slate-200" onSubmit={e => {
    e.preventDefault()
    save.mutate(async () => { const r = await workSchedulingApi.createRoster(lotId, { name, fromDate, toDate }); created(r); return r }, { onSuccess: close })
  }}>
    <h3 className="font-semibold">New draft roster</h3>
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Roster name"><Input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></Field>
      <Field label="From date"><Input required type="date" value={fromDate} onChange={e => setFrom(e.target.value)} /></Field>
      <Field label="To date"><Input required type="date" min={fromDate} value={toDate} onChange={e => setTo(e.target.value)} /></Field>
    </div>
    <p className="text-sm text-slate-600">Up to 93 days. Staff cannot see this roster until you publish it.</p>
    {save.isError && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(save.error)}</p>}
    <div className="flex gap-2"><Button type="submit" disabled={save.isPending}>Create draft</Button><Button type="button" variant="outline" onClick={close}>Cancel</Button></div>
  </form>
}

function AssignmentForm({ staff, assignment, busy, save, close }: { staff: RosterStaff[]; assignment?: DutyAssignment; busy: boolean; save: (employeeId: number, notes: string) => void; close: () => void }) {
  const [employeeId, setEmployeeId] = useState(assignment?.employeeId.toString() ?? '')
  const [notes, setNotes] = useState(assignment?.notes ?? '')
  return <form className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={e => { e.preventDefault(); save(Number(employeeId), notes) }}>
    <Field label="Staff"><NativeSelect required value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
      <option value="">Choose active Staff</option>
      {staff.map(p => <option key={p.employeeId} value={p.employeeId}>{p.fullName} · {p.employeeCode}</option>)}
    </NativeSelect></Field>
    <Field label="Notes"><Input maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
    <div className="flex gap-2"><Button type="submit" disabled={busy || !employeeId} size="sm">Save</Button><Button type="button" size="sm" variant="outline" onClick={close}>Cancel</Button></div>
  </form>
}

function ShiftForm({ roster, templates, shift, busy, save, close }: { roster: DutyRoster; templates: WorkShiftTemplate[]; shift?: RosterShift; busy: boolean; save: (date: string, template: number) => void; close: () => void }) {
  const [date, setDate] = useState(shift?.workDate ?? roster.fromDate)
  const [templateId, setTemplate] = useState(shift?.workShiftTemplateId.toString() ?? '')
  return <form className="space-y-3 rounded-lg bg-slate-50 p-4" onSubmit={e => { e.preventDefault(); save(date, Number(templateId)) }}>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Shift start date"><Input required type="date" min={roster.fromDate} max={roster.toDate} value={date} onChange={e => setDate(e.target.value)} /></Field>
      <Field label="Shift template"><NativeSelect required value={templateId} onChange={e => setTemplate(e.target.value)}><option value="">Choose template</option>{templates.filter(t => t.isActive).map(t => <option key={t.id} value={t.id}>{t.name} · {t.startTime.slice(0, 5)}–{t.endTime.slice(0, 5)}{t.endTime < t.startTime ? ' (+1 day)' : ''}</option>)}</NativeSelect></Field>
    </div>
    {shift && <p className="text-sm text-amber-800">Saving this shift applies the selected template's current hours and staffing needs. Its existing assignments will be checked again.</p>}
    {roster.attendanceLockedDates?.includes(date) && <p className="text-sm text-amber-900">Attendance period locked · read only.</p>}
    <div className="flex gap-2"><Button type="submit" disabled={busy || !templateId || roster.attendanceLockedDates?.includes(date)} size="sm">{shift ? 'Update dated shift' : 'Add dated shift'}</Button><Button type="button" variant="outline" size="sm" onClick={close}>Cancel</Button></div>
  </form>
}

function ShiftCard({ lotId, roster, shift, templates, staff, reason }: { lotId: string; roster: DutyRoster; shift: RosterShift; templates: WorkShiftTemplate[]; staff: RosterStaff[]; reason: string }) {
  const mutation = useScheduleMutation()
  const [editingShift, setEditingShift] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<DutyAssignment | 'new' | null>(null)
  const [removing, setRemoving] = useState(false)
  const input = { revision: roster.revision, reason }
  const disabled = mutation.isPending || Boolean(shift.attendanceLocked) || (roster.status === 'Published' && !reason.trim())
  const shortages = roster.shortages.filter(x => x.shiftId === shift.id)
  return <Card className="space-y-4 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-bold tracking-wide text-indigo-700">{shift.workDate}</p><h3 className="font-display text-xl font-semibold">{shift.name}</h3>
        <p className="flex items-center gap-1.5 text-sm text-slate-600"><Clock className="size-4" />{shift.startTime.slice(0, 5)}–{shift.endTime.slice(0, 5)}{shift.endTime < shift.startTime && ' · ends next day'}</p></div>
      <div className="flex gap-2"><Button variant="outline" size="sm" disabled={disabled} onClick={() => setEditingShift(v => !v)}><Pencil />Edit shift</Button><Button variant="ghost" size="sm" disabled={disabled} onClick={() => setRemoving(v => !v)}>Remove shift</Button></div>
    </div>
    <p className="text-xs text-slate-500">Local time: {shift.timeZoneId}. Staff: {shift.assigned} / {shift.minimumStaff}.</p>
    {shortages.length > 0 && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Staffing shortage: {shortages.map(x => `${x.assigned}/${x.required}`).join(' · ')}. Publishing is still allowed.</p>}
    {editingShift && <ShiftForm roster={roster} templates={templates} shift={shift} busy={disabled} close={() => setEditingShift(false)} save={(date, template) => mutation.mutate(() => workSchedulingApi.saveShift(lotId, roster.id, { ...input, workDate: date, workShiftTemplateId: template }, shift.id), { onSuccess: () => setEditingShift(false) })} />}
    {removing && <div className="flex flex-wrap items-center gap-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-900"><p>Remove this shift and all its assignments? Published Staff will be notified.</p><Button size="sm" disabled={disabled} onClick={() => mutation.mutate(() => workSchedulingApi.removeShift(lotId, roster.id, shift.id, input))}>Confirm removal</Button><Button variant="outline" size="sm" onClick={() => setRemoving(false)}>Keep shift</Button></div>}
    <ul className="divide-y divide-slate-100">{shift.assignments.map(a => <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span><strong>{a.staffName}</strong></span><div className="flex gap-1"><Button size="sm" variant="ghost" disabled={disabled} onClick={() => setEditingAssignment(a)}>Edit</Button><Button size="sm" variant="ghost" disabled={disabled} onClick={() => mutation.mutate(() => workSchedulingApi.removeAssignment(lotId, roster.id, shift.id, a.id, input))}>Remove</Button></div></li>)}</ul>
    {shift.assignments.length === 0 && <p className="text-sm text-slate-500">No Staff assigned yet.</p>}
    {editingAssignment ? <AssignmentForm key={editingAssignment === 'new' ? 'new' : editingAssignment.id} staff={staff} assignment={editingAssignment === 'new' ? undefined : editingAssignment} busy={disabled} close={() => setEditingAssignment(null)} save={(employeeId, notes) => mutation.mutate(() => workSchedulingApi.saveAssignment(lotId, roster.id, shift.id, { ...input, employeeId, notes }, editingAssignment === 'new' ? undefined : editingAssignment.id), { onSuccess: () => setEditingAssignment(null) })} />
      : <Button variant="outline" size="sm" disabled={disabled || staff.length === 0} onClick={() => setEditingAssignment('new')}><Users />Assign Staff</Button>}
    {mutation.isError && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(mutation.error)}</p>}
  </Card>
}

const HISTORY_ACTION: Record<string, string> = {
  Created: 'Roster created', Published: 'Roster published', ShiftAdded: 'Dated shift added',
  ShiftUpdated: 'Dated shift changed', ShiftRemoved: 'Dated shift removed',
  AssignmentAdded: 'Staff assigned', AssignmentUpdated: 'Assignment changed', AssignmentRemoved: 'Assignment removed',
  RotationGenerated: 'Rotation draft generated', StandbyChanged: 'Standby updated',
  LeaveApproved: 'Leave approved', SwapApproved: 'Swap approved', ReplacementConfirmed: 'Replacement confirmed', OpenShiftCreated: 'Open shift created',
}

function HistorySnapshot({ json }: { json: string | null }) {
  if (!json) return <p className="text-slate-500">New roster</p>
  type SavedRoster = { Status: string; Shifts: { Id: number; WorkDate: string; Name: string; StartTime: string; EndTime: string;
    MinimumStaff?: number; MinimumEntryStaff?: number; MinimumExitStaff?: number; MinimumCounterStaff?: number;
    Assignments: { StaffName: string; Notes?: string }[] }[] }
  let saved: SavedRoster
  try { saved = JSON.parse(json) as SavedRoster } catch { return <p>History details unavailable.</p> }
  return <div className="max-h-80 space-y-3 overflow-auto rounded-lg bg-slate-50 p-3">
    <p className="font-medium">{saved.Status}</p>
    {saved.Shifts.length === 0 && <p>No dated shifts</p>}
    {saved.Shifts.map(s => <div key={s.Id} className="border-t border-slate-200 pt-2">
      <p className="font-semibold">{s.WorkDate} · {s.Name}</p>
      <p>{s.StartTime.slice(0, 5)}–{s.EndTime.slice(0, 5)}{s.EndTime < s.StartTime && ' · ends next day'}</p>
      <p className="text-xs text-slate-600">Minimum staff: {s.MinimumStaff ?? (s.MinimumEntryStaff ?? 0) + (s.MinimumExitStaff ?? 0) + (s.MinimumCounterStaff ?? 0)}</p>
      {s.Assignments.length ? <ul>{s.Assignments.map((a, i) => <li key={i}>{a.StaffName}{a.Notes && <p className="whitespace-pre-wrap break-words text-xs">{a.Notes}</p>}</li>)}</ul> : <p>No Staff assigned</p>}
    </div>)}
  </div>
}

function RosterHistory({ lotId, rosterId }: { lotId: string; rosterId: number }) {
  const { user } = useAuth()
  const query = useQuery({ queryKey: [...workSchedulingKeys, user?.userId, lotId, 'history', rosterId], queryFn: () => workSchedulingApi.history(lotId, rosterId) })
  if (query.isPending) return <Spinner />
  if (query.isError) return <ErrorState message={getErrorMessage(query.error)} onRetry={() => query.refetch()} />
  return <Card className="p-5">
    <h3 className="mb-3 font-semibold">Roster history</h3>
    <ol className="space-y-3">{query.data.map(h => <li key={h.id} className="border-l-2 border-indigo-200 pl-3 text-sm">
      <p className="font-semibold">Version {h.revision} · {HISTORY_ACTION[h.action] ?? 'Roster changed'}</p>
      <p className="text-slate-600">{new Date(h.changedAt).toLocaleString()} · {h.changedByName}</p>
      {h.reason && <p>{h.reason}</p>}
      <details className="mt-1"><summary className="cursor-pointer text-indigo-700">View saved before and after</summary>
        <div className="mt-2 grid gap-3 lg:grid-cols-2">{[h.beforeJson, h.afterJson].map((json, i) => <div key={i}>
          <p className="mb-1 font-semibold">{i ? 'After' : 'Before'}</p><HistorySnapshot json={json} />
        </div>)}</div>
      </details>
    </li>)}</ol>
  </Card>
}

function ManagerRosterCalendar({ lotId, roster, templates, reason, preview = false }: { lotId: string; roster: DutyRoster; templates: WorkShiftTemplate[]; reason: string; preview?: boolean }) {
  const { lots, setLotId } = useManagerLot()
  const today = toIsoDate(new Date())
  const [anchor, setAnchor] = useState(today >= roster.fromDate && today <= roster.toDate ? today : roster.fromDate)
  const [view, setView] = useState<CalendarView>('week')
  const [search, setSearch] = useState('')
  const [cell, setCell] = useState<CalendarCell | null>(null)
  const [reviewIds, setReviewIds] = useState<ReadonlySet<number>>()
  const range = calendarRange(anchor, view)
  return <Card className="min-w-0 overflow-hidden">
    <ScheduleToolbar anchor={anchor} view={view} search={search} today={today} onAnchor={setAnchor} onView={setView} onSearch={setSearch}
      lots={lots.data ?? []} lotId={lotId} onLot={setLotId} />
    {!preview && <AttendancePeriodReviewPanel lotId={lotId} onFilter={setReviewIds} />}
    <WorkScheduleCalendar rosters={[roster]} range={range} search={search} today={today} templates={preview ? [] : templates} onCell={preview ? undefined : setCell} preview={preview} reviewIds={reviewIds} />
    {cell && <CalendarAssignmentDialog lotId={lotId} roster={roster} cell={cell} reason={reason} close={() => setCell(null)} />}
  </Card>
}

function RosterEditor({ lotId, roster, templates, staff }: { lotId: string; roster: DutyRoster; templates: WorkShiftTemplate[]; staff: RosterStaff[] }) {
  const mutation = useScheduleMutation()
  const [reason, setReason] = useState('')
  const [adding, setAdding] = useState(false)
  const [history, setHistory] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [preview, setPreview] = useState<RotationPreview | null>(null)
  const published = roster.status === 'Published'
  const disabled = mutation.isPending || (published && !reason.trim())
  return <div className="space-y-4">
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-2xl font-semibold">{roster.name}</h2><p className="text-sm text-slate-600">{roster.fromDate} – {roster.toDate} · <strong className={published ? 'text-emerald-700' : 'text-amber-700'}>{roster.status}</strong> · version {roster.revision}</p></div><Button variant="outline" size="sm" onClick={() => setHistory(v => !v)}><History />History</Button></div>
      {published ? <Field label="Reason for changes to this published roster"><Input maxLength={500} required placeholder="Explain the change to affected Staff" value={reason} onChange={e => setReason(e.target.value)} /></Field> : <p className="text-sm text-slate-600">Draft: only your management view can see these shifts.</p>}
      {roster.shortages.length > 0 && <details className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><summary className="cursor-pointer"><strong>{roster.shortages.length} understaffed shifts.</strong> Publishing is allowed. View all shortages</summary><ul className="mt-2 max-h-48 space-y-1 overflow-auto">{roster.shortages.map(x => <li key={x.shiftId}>{x.workDate} {x.shiftName}: {x.assigned}/{x.required}</li>)}</ul></details>}
      {(roster.rotationIssues?.length ?? 0) > 0 && <ul className="max-h-48 overflow-auto rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{roster.rotationIssues?.map((issue, i) => <li key={i}>{issue.blocking ? 'Violation' : 'Warning'} · {issue.date} · {issue.message}</li>)}</ul>}
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={disabled || Boolean(preview) || !templates.some(t => t.isActive)} onClick={() => setAdding(v => !v)}><Plus />Add dated shift</Button>{!published && <Button disabled={mutation.isPending || Boolean(preview) || roster.shifts.length === 0 || roster.rotationIssues?.some(i => i.blocking)} onClick={() => mutation.mutate(() => workSchedulingApi.publish(lotId, roster.id, { revision: roster.revision }))}>{roster.shortages.length ? 'Publish with staffing shortages' : 'Publish roster'}</Button>}</div>
      {mutation.isError && <p role="alert" className="text-sm text-rose-700">{getErrorMessage(mutation.error)}</p>}
      {!templates.some(t => t.isActive) && <p className="text-sm text-amber-800">Create an active shift template to add dated shifts.</p>}
      {staff.length === 0 && <p className="text-sm text-amber-800">No active Staff available at this lot. You can still prepare unfilled shifts.</p>}
      {adding && <ShiftForm roster={roster} templates={templates} busy={disabled} close={() => setAdding(false)} save={(date, template) => mutation.mutate(() => workSchedulingApi.saveShift(lotId, roster.id, { revision: roster.revision, reason, workDate: date, workShiftTemplateId: template }), { onSuccess: () => setAdding(false) })} />}
    </Card>
    {history && <RosterHistory lotId={lotId} rosterId={roster.id} />}
    {!published && <GenerateRotationPanel lotId={lotId} roster={roster} onPreview={setPreview} />}
    <ManagerRosterCalendar lotId={lotId} roster={preview?.roster ?? roster} templates={templates} reason={reason} preview={Boolean(preview)} />
    <Button variant="outline" aria-expanded={showDetails} onClick={() => setShowDetails(v => !v)}>{showDetails ? 'Hide dated shift controls' : 'Dated shift controls'}</Button>
    {showDetails && <div className="space-y-4">{roster.shifts.map(shift => <ShiftCard key={shift.id} lotId={lotId} roster={roster} shift={shift} templates={templates} staff={staff} reason={reason} />)}</div>}
    {showDetails && !preview && <StandbyEditor lotId={lotId} roster={roster} staff={staff} reason={reason} />}
  </div>
}

function Scheduling({ lot }: { lot: ManagedLot }) {
  const { templates, staff, rosters } = useWorkScheduling(lot.id)
  const [tab, setTab] = useState<'rosters' | 'templates' | 'rotation'>('rosters')
  const [templateForm, setTemplateForm] = useState<WorkShiftTemplate | 'new' | null>(null)
  const [creating, setCreating] = useState(false)
  const [selectedId, setSelected] = useState<number>()
  const selected = rosters.data?.find(r => r.id === selectedId) ?? rosters.data?.[0]
  const templateList = templates.data ?? []
  const staffList = staff.data ?? []
  const rosterList = rosters.data ?? []
  const failed = [templates, staff, rosters].find(q => q.isError && !q.data)
  return <div className="space-y-6">
    <PageHeader title="Work schedules" description="Create shift templates, build a manual roster and publish it to your Staff." eyebrow={lot.name} actions={<CalendarDays className="size-9 text-indigo-700" />} />
    <div className="flex flex-wrap gap-2"><Button variant={tab === 'rosters' ? 'default' : 'outline'} onClick={() => setTab('rosters')}>Duty rosters</Button><Button variant={tab === 'templates' ? 'default' : 'outline'} onClick={() => setTab('templates')}>Shift templates</Button><Button variant={tab === 'rotation' ? 'default' : 'outline'} onClick={() => setTab('rotation')}>Rotation setup</Button></div>
    {failed ? <Card><ErrorState message={getErrorMessage(failed.error)} onRetry={() => { void templates.refetch(); void staff.refetch(); void rosters.refetch() }} /></Card> : templates.isPending || staff.isPending || rosters.isPending ? <Spinner /> : <>
      {tab === 'rotation' ? <WorkRotationSetup lotId={lot.id} templates={templateList} staff={staffList} /> : tab === 'templates' ? <>
        <div className="flex justify-end"><Button onClick={() => setTemplateForm('new')}><Plus />New template</Button></div>
        {templateForm && <TemplateForm key={templateForm === 'new' ? 'new' : templateForm.id} lotId={lot.id} template={templateForm === 'new' ? undefined : templateForm} close={() => setTemplateForm(null)} />}
        {templateList.length === 0 && <Card><EmptyState title="No shift templates" description="Start by creating your lot's shift hours and minimum staffing needs." /></Card>}
        <div className="grid gap-4 lg:grid-cols-2">{templateList.map(t => <Card key={t.id} className="space-y-2 p-5"><div className="flex items-start justify-between gap-3"><h2 className="font-display text-xl font-semibold">{t.name}</h2><Button size="sm" variant="outline" onClick={() => setTemplateForm(t)}><Pencil />Edit</Button></div><p>{t.startTime.slice(0, 5)}–{t.endTime.slice(0, 5)}{t.endTime < t.startTime && ' · ends next day'}</p><p className="text-sm text-slate-600">Minimum staff: {t.minimumStaff}</p><p className="text-xs font-semibold text-slate-500">{t.isActive ? 'Available' : 'Inactive'} · version {t.revision}</p></Card>)}</div>
      </> : <>
        <div className="flex flex-wrap items-end gap-3"><div className="min-w-64 flex-1"><Field label="Roster period"><NativeSelect value={selected?.id ?? ''} onChange={e => setSelected(Number(e.target.value))}><option value="" disabled>Select roster</option>{rosterList.map(r => <option key={r.id} value={r.id}>{r.name} · {r.fromDate} – {r.toDate} · {r.status}</option>)}</NativeSelect></Field></div><Button onClick={() => setCreating(v => !v)}><Plus />New roster</Button></div>
        {creating && <CreateRoster lotId={lot.id} close={() => setCreating(false)} created={r => setSelected(r.id)} />}
        <WorkRequestsBoard lotId={lot.id} />
        {selected ? <RosterEditor key={selected.id} lotId={lot.id} roster={selected} templates={templateList} staff={staffList} /> : <Card><EmptyState title="No duty rosters" description="Create a draft roster, add dated shifts and assign active Staff." /></Card>}
      </>}
    </>}
  </div>
}

export default function ManagerWorkSchedulingPage() {
  return <WithManagerLot>{lot => <Scheduling key={lot.id} lot={lot} />}</WithManagerLot>
}
