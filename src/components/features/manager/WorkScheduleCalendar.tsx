import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, CircleCheck, Plus, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, NativeSelect } from '@/components/ui/form-controls'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/states'
import { cn } from '@/lib/utils'
import { assignmentsForCell, buildShiftGroups, calendarRange, isCalendarWeekend, navigateCalendar, shiftEndDate,
  type AssignmentReference, type CalendarRange, type CalendarView, type ShiftGroup, type ShiftReference } from '@/lib/workScheduleCalendar'
import { POSITION_LABEL, type DutyRoster, type WorkShiftTemplate } from '@/types/workScheduling.dto'
import AssignmentAttendancePanel, { AttendanceBadge } from './AssignmentAttendancePanel'
import OpenShiftDialog, { CreateOpenShiftDialog } from './OpenShiftDialog'
import { useAuth } from '@/hooks/useAuth'

export interface CalendarCell {
  day: string
  group: ShiftGroup
  employeeId?: number
  occurrence?: ShiftReference
  assignment?: AssignmentReference
}

interface ToolbarProps {
  anchor: string; view: CalendarView; search: string; today: string
  onAnchor: (value: string) => void; onView: (value: CalendarView) => void; onSearch: (value: string) => void
  lots: { id: string; name: string }[]; lotId: string; onLot: (id: string) => void
}

export function ScheduleToolbar({ anchor, view, search, today, onAnchor, onView, onSearch, lots, lotId, onLot }: ToolbarProps) {
  const range = calendarRange(anchor, view)
  return <div className="flex flex-wrap items-end gap-3 rounded-t-xl border-b border-slate-200 bg-white p-4">
    <label className="grid min-w-44 gap-1 text-xs font-semibold text-slate-600">Parking lot
      <NativeSelect aria-label="Calendar parking lot" value={lotId} onChange={e => onLot(e.target.value)} disabled={lots.length < 2}>
        {lots.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
      </NativeSelect>
    </label>
    <label className="grid min-w-44 flex-1 gap-1 text-xs font-semibold text-slate-600">Find employee
      <Input aria-label="Find calendar employee" placeholder="Employee name" value={search} onChange={e => onSearch(e.target.value)} />
    </label>
    <label className="grid gap-1 text-xs font-semibold text-slate-600">{view === 'month' ? 'Month' : 'Date'}
      <Input aria-label="Calendar date" type={view === 'month' ? 'month' : 'date'} value={view === 'month' ? anchor.slice(0, 7) : anchor}
        onChange={e => { if (e.target.value) onAnchor(view === 'month' ? `${e.target.value}-01` : e.target.value) }} />
    </label>
    <div className="flex gap-1">
      <Button variant="outline" size="icon" aria-label={`Previous ${view}`} onClick={() => onAnchor(navigateCalendar(anchor, view, -1))}><ChevronLeft /></Button>
      <Button variant="outline" onClick={() => onAnchor(today)}>Today</Button>
      <Button variant="outline" size="icon" aria-label={`Next ${view}`} onClick={() => onAnchor(navigateCalendar(anchor, view, 1))}><ChevronRight /></Button>
    </div>
    <div role="group" aria-label="Calendar view" className="flex gap-1">
      {(['day', 'week', 'month'] as const).map(mode => <Button key={mode} variant={view === mode ? 'default' : 'outline'} aria-pressed={view === mode} onClick={() => onView(mode)}>{mode[0].toUpperCase() + mode.slice(1)}</Button>)}
    </div>
    <p className="w-full text-xs text-slate-500" aria-live="polite">Viewing {range.from}{range.to !== range.from && ` – ${range.to}`} · dates refer to the shift's start day.</p>
  </div>
}

export function AssignmentDetails({ item }: { item: AssignmentReference }) {
  const { roster, shift, assignment } = item
  return <div className="space-y-2 text-sm text-slate-700">
    <p className="font-semibold text-slate-950">{assignment.staffName} · {shift.name}</p>
    <p>{shift.workDate} {shift.startTime.slice(0, 5)} → {shiftEndDate(shift)} {shift.endTime.slice(0, 5)}</p>
    <p>{shift.timeZoneId} · {POSITION_LABEL[assignment.position]}</p>
    <p>Roster: <strong>{roster.status}</strong> · {roster.name}</p>
    <p>Assignment: <strong>Assigned</strong></p>
    {assignment.notes && <p className="whitespace-pre-wrap break-words">Notes: {assignment.notes}</p>}
    {assignment.originalAssignmentId && <p>{assignment.source === 'Swap' ? 'Swap from' : 'Replaces'} original assignment #{assignment.originalAssignmentId} · {assignment.replacementReason}</p>}
    {assignment.allowWeeklyOvertime && <p>Weekly-hours exception · overtime review required</p>}
  </div>
}

const NEEDS = [
  { label: 'Entry', required: 'minimumEntryStaff', assigned: 'entryAssigned' },
  { label: 'Exit', required: 'minimumExitStaff', assigned: 'exitAssigned' },
  { label: 'Counter', required: 'minimumCounterStaff', assigned: 'counterAssigned' },
] as const

export default function WorkScheduleCalendar({ rosters, range, search, today, templates = [], onCell, onAssignment, preview = false, reviewIds }: {
  rosters: DutyRoster[]; range: CalendarRange; search: string; today: string; templates?: WorkShiftTemplate[]
  onCell?: (cell: CalendarCell) => void; onAssignment?: (item: AssignmentReference) => void
  preview?: boolean
  reviewIds?: ReadonlySet<number>
}) {
  const { user } = useAuth()
  const [slotId, setSlotId] = useState<number | null>(null)
  const [originalId, setOriginalId] = useState<number | null>(null)
  const [vacancy, setVacancy] = useState<{ lotId: string; shiftId: number; position: string } | null>(null)
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()
  const standbyItems = rosters.flatMap(roster => (roster.standbys ?? []).filter(s => s.workDate >= range.from && s.workDate <= range.to && normalize(s.staffName).includes(normalize(search.trim()))).map(standby => ({ roster, standby })))
  const standbyPeople = [...new Map(standbyItems.map(x => [x.standby.employeeId, x.standby.staffName])).entries()]
  const groups = useMemo(() => buildShiftGroups(rosters, range, search, templates), [rosters, range, search, templates])
  const [detail, setDetail] = useState<AssignmentReference | null>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const scrollPosition = useRef({ left: 0, top: 0, range: `${range.from}:${range.to}` })
  useLayoutEffect(() => {
    const key = `${range.from}:${range.to}`
    if (scrollPosition.current.range !== key) scrollPosition.current = { left: 0, top: 0, range: key }
    const el = viewport.current
    if (el) { el.scrollLeft = scrollPosition.current.left; el.scrollTop = scrollPosition.current.top }
  }, [rosters, range.from, range.to])
  const carryOvers = rosters.flatMap(roster => roster.shifts
    .filter(s => s.workDate < range.from && shiftEndDate(s) >= range.from && s.endTime !== '00:00:00')
    .flatMap(shift => shift.assignments.map(assignment => ({ roster, shift, assignment }))))
  const editableRoster = rosters.length === 1 && onCell ? rosters[0] : undefined
  const validDay = (day: string) => Boolean(editableRoster && day >= editableRoster.fromDate && day <= editableRoster.toDate)
  const blankAction = (group: ShiftGroup, day: string, employeeId?: number): CalendarCell | undefined => {
    if (reviewIds || editableRoster?.attendanceLockedDates?.includes(day)) return undefined
    if (!validDay(day)) return undefined
    const occurrence = group.occurrences.find(x => x.shift.workDate === day)
    if (occurrence?.shift.attendanceLocked) return undefined
    // A changed/archived template cannot implicitly recreate an older snapshot on another date.
    if (!occurrence && (!group.template || editableRoster?.shifts.some(s => s.workDate === day && s.workShiftTemplateId === group.templateId))) return undefined
    return { day, group, employeeId, occurrence }
  }
  const cellBackground = (day: string) => cn(day === today ? 'bg-indigo-50/70' : isCalendarWeekend(day) ? 'bg-slate-50' : 'bg-white')
  const style = { '--shift-column': '142px', '--employee-column': '176px', overflowAnchor: 'none' } as CSSProperties
  return <>
    {carryOvers.length > 0 && <div className="space-y-2 border-b border-slate-200 bg-indigo-50 p-3 text-xs text-indigo-950">
      <p className="font-semibold">Overnight assignments continuing into {range.from} (shown under their start date):</p>
      {carryOvers.map(item => <button disabled={preview} key={`${item.shift.id}:${item.assignment.id}`} className="mr-2 rounded border border-indigo-200 bg-white px-2 py-1 text-left hover:underline" onClick={() => setDetail(item)}>
        {item.assignment.staffName} · {item.shift.name} · {item.shift.workDate} {item.shift.startTime.slice(0, 5)} → {shiftEndDate(item.shift)} {item.shift.endTime.slice(0, 5)}
      </button>)}
    </div>}
    <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-slate-200 bg-white px-4 py-3 text-xs text-slate-600" aria-label="Calendar legend">
      <span><CircleCheck className="mr-1 inline size-3.5 text-indigo-700" />Assigned = scheduled work</span>
      <span><TriangleAlert className="mr-1 inline size-3.5 text-amber-700" />Needs staff = below minimum</span>
      <span>— = no assignment, not an absence</span>
      <span>Draft / Published = roster visibility</span>
      <span>Attendance: Upcoming / Start window / Working / Completed / Absent</span>
      <span>Late and Auto-ended are flags</span>
      <span>Pending request ≠ approved leave · Open offer ≠ confirmed replacement</span>
    </div>
    <div key={`${range.from}:${range.to}`} ref={viewport} onScroll={event => { scrollPosition.current = { left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop, range: `${range.from}:${range.to}` } }} className="max-h-[70vh] overflow-auto overscroll-contain rounded-b-xl bg-white [scrollbar-gutter:stable]" role="region" aria-label="Work schedule calendar, scroll horizontally for more dates" tabIndex={0} style={style}>
      {groups.length === 0 && standbyItems.length === 0 ? <EmptyState icon={CalendarDays} title="No shifts in this period" description="Choose another date or roster. Only actual assignments are displayed." /> :
        <table className="w-full table-fixed border-separate border-spacing-0 text-sm" style={{ minWidth: 318 + range.days.length * 164 }}>
          <caption className="sr-only">Work schedule grouped by shift and employee. Staffing totals refer to the entire dated shift, even when searching or viewing your own assignments.</caption>
          <colgroup><col style={{ width: 'var(--shift-column)' }} /><col style={{ width: 'var(--employee-column)' }} />{range.days.map(day => <col key={day} style={{ width: 164 }} />)}</colgroup>
          <thead><tr>
            <th scope="col" className="sticky top-0 left-0 z-40 border-r border-b border-slate-200 bg-slate-100 p-3 text-left">Shift</th>
            <th scope="col" className="sticky top-0 left-[var(--shift-column)] z-40 border-r border-b border-slate-200 bg-slate-100 p-3 text-left">Employee</th>
            {range.days.map(day => <th key={day} scope="col" aria-current={day === today ? 'date' : undefined}
              className={cn('sticky top-0 z-30 border-r border-b border-slate-200 p-2 text-center', day === today ? 'bg-indigo-100 text-indigo-900' : isCalendarWeekend(day) ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-700')}>
              <span className="block text-xs">{new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })}{isCalendarWeekend(day) && ' · Weekend'}</span>
              <span className="block font-semibold">{day.slice(5)}</span>{day === today && <span className="text-xs font-bold">Today</span>}
            </th>)}
          </tr></thead>
          {groups.map(group => <tbody key={group.key} aria-label={`${group.name} ${group.startTime}–${group.endTime}`}>
            <tr>
              <th scope="rowgroup" rowSpan={group.employees.length + 1} className="sticky left-0 z-20 border-t-2 border-r border-b border-slate-200 bg-white p-3 text-left align-top">
                <div className="sticky top-20 space-y-1"><p className="font-semibold text-slate-950">{group.name}</p><p className="text-xs font-normal text-slate-600">{group.startTime.slice(0, 5)}–{group.endTime.slice(0, 5)}</p>{group.endTime < group.startTime && <p className="text-xs font-medium text-indigo-700">Ends next day ↗</p>}</div>
              </th>
              <th scope="row" className="sticky left-[var(--shift-column)] z-20 border-t-2 border-r border-b border-slate-200 bg-white p-3 text-left align-top"><p className="text-xs font-semibold">Staffing needs</p><p className="mt-1 text-[11px] font-normal text-slate-500">Assigned / minimum<br />All Staff, all positions</p></th>
              {range.days.map(day => {
                const occurrences = group.occurrences.filter(x => x.shift.workDate === day)
                const empty = blankAction(group, day)
                return <td key={day} className={cn('border-t-2 border-r border-b border-slate-200 p-2 align-top', cellBackground(day))}>
                  {occurrences.map(item => {
                    const shortage = NEEDS.some(n => item.shift[n.assigned] < item.shift[n.required])
                    return <div key={`${item.roster.id}:${item.shift.id}`} className="mb-2 space-y-1 rounded border border-slate-200 bg-white p-2 text-[11px] last:mb-0">
                      <p className="font-semibold">{item.roster.status}</p>
                      {NEEDS.map(n => <p key={n.label} className={cn(item.shift[n.assigned] < item.shift[n.required] && 'font-semibold text-amber-800')}>
                        {n.label}: {item.shift[n.assigned]} / {item.shift[n.required]}</p>)}
                      {shortage && <p className="font-semibold text-amber-800"><TriangleAlert className="mr-1 inline size-3" />Needs staff</p>}
                      {(item.shift.openShifts ?? []).map(slot => <button key={slot.id} disabled={preview} className="block w-full rounded border border-amber-300 bg-amber-50 p-1 text-left font-semibold text-amber-900" onClick={() => setSlotId(slot.id)}>Open slot · {POSITION_LABEL[slot.position]} · {slot.status} · {slot.stage}</button>)}
                      {(item.shift.managerCoverage ?? []).map(c => <p key={c.id} className="font-semibold">Manager coverage · {c.managerName} · {POSITION_LABEL[c.position]}</p>)}
                      {item.shift.attendanceLocked && <p className="font-semibold">Attendance locked · read only</p>}
                      {!preview && !item.shift.attendanceLocked && user?.role === 'MANAGER' && item.roster.status === 'Published' && NEEDS.filter(n => item.shift[n.required] - item.shift[n.assigned] > (item.shift.openShifts ?? []).filter(o => o.position === n.label && o.status === 'Open').length).map(n => <button key={n.label} className="block rounded border border-dashed border-amber-400 p-1 font-semibold text-amber-900" onClick={() => setVacancy({ lotId: item.roster.parkingLotId.toString(), shiftId: item.shift.id, position: n.label })}>Find replacement · {n.label}</button>)}
                      {onCell && !reviewIds && !item.shift.attendanceLocked && <button className="mt-1 flex items-center gap-1 rounded px-1 py-1 font-semibold text-indigo-700 hover:bg-indigo-50 focus-visible:outline-2" aria-label={`Assign Staff ${group.name} ${day} roster ${item.roster.name}`} onClick={() => onCell({ day, group, occurrence: item })}><Plus className="size-3" />Assign</button>}
                    </div>
                  })}
                  {occurrences.length === 0 && (empty && onCell ? <button className="w-full rounded border border-dashed border-slate-300 p-2 text-xs text-slate-600 hover:bg-indigo-50" aria-label={`Create shift and assign ${group.name} ${day}`} onClick={() => onCell(empty)}><Plus className="mx-auto mb-1 size-3.5" />No dated shift<br />Add & assign</button> : <span className="text-xs text-slate-500">{!editableRoster ? 'No visible assignment' : !validDay(day) ? 'Outside roster' : 'No dated shift'}</span>)}
                </td>
              })}
            </tr>
            {group.employees.map(employee => <tr key={employee.id}>
              <th scope="row" className="sticky left-[var(--shift-column)] z-10 border-r border-b border-slate-200 bg-white p-3 text-left align-top font-medium text-slate-900">{employee.name}</th>
              {range.days.map(day => {
                const originalItems = assignmentsForCell(group, employee.id, day)
                const items = originalItems.filter(item => !reviewIds || reviewIds.has(item.assignment.id))
                const trails = group.occurrences.filter(o => o.shift.workDate === day).flatMap(o => o.shift.trail ?? []).filter(t => t.employeeId === employee.id && (!reviewIds || reviewIds.has(t.assignmentId)))
                const empty = blankAction(group, day, employee.id)
                return <td key={day} className={cn('border-r border-b border-slate-200 p-2 align-top', cellBackground(day))}>
                  {items.map(item => <button disabled={preview} key={`${item.roster.id}:${item.shift.id}:${item.assignment.id}`} onClick={() => onAssignment ? onAssignment(item) : onCell ? onCell({ day, group, employeeId: employee.id, occurrence: item, assignment: item }) : setDetail(item)}
                    aria-label={`${employee.name}, ${group.name}, ${day}, ${POSITION_LABEL[item.assignment.position]}, assignment ${item.assignment.id}`}
                    className="mb-2 block w-full rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-2 text-left text-xs text-indigo-950 last:mb-0 hover:ring-2 hover:ring-indigo-300 focus-visible:outline-2">
                    <span className="block font-semibold"><CircleCheck className="mr-1 inline size-3" />Assigned · {POSITION_LABEL[item.assignment.position]}</span>
                    <span className="mt-1 block">{item.shift.startTime.slice(0, 5)} → {item.shift.endTime.slice(0, 5)}</span>
                    {item.shift.endTime < item.shift.startTime && <span className="block font-medium">↗ Ends {shiftEndDate(item.shift)}</span>}
                    <span className="block text-[10px]">{item.roster.status}</span>
                    {item.shift.attendanceLocked && <span className="block font-semibold">Attendance locked</span>}
                    {item.assignment.requestState && <span className="block font-semibold">⏳ Request pending · {item.assignment.requestState}</span>}
                    {item.assignment.originalAssignmentId && <span className="block">{item.assignment.source === 'Swap' ? 'Swap' : 'Replacement'} · original #{item.assignment.originalAssignmentId}</span>}
                    {preview ? <span className="block font-semibold">{item.assignment.id < 0 ? 'Proposed addition' : 'Kept assignment'}</span> : <AttendanceBadge value={item.assignment.attendance} />}
                    {item.assignment.isManuallyEdited && <span className="block">Manual edit · protected on regeneration</span>}
                    {item.assignment.notes && <span className="mt-1 line-clamp-2 whitespace-pre-wrap break-words">{item.assignment.notes}</span>}
                  </button>)}
                  {trails.map(t => <button key={t.assignmentId} disabled={preview} onClick={() => setOriginalId(t.assignmentId)} className="mb-2 block w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-left text-xs text-slate-700"><strong>{t.kind === 'ApprovedLeave' ? `Approved ${t.isPaid ? 'paid' : 'unpaid'} leave` : 'Swapped · original assignment'}</strong><span className="block">Original #{t.assignmentId} · {POSITION_LABEL[t.position]}</span><span className="block">View retained assignment and request history</span></button>)}
                  {items.length === 0 && trails.length === 0 && (originalItems.length > 0 ? <span className="block p-2 text-center text-[10px] text-slate-500">Filtered out</span> : empty && onCell ? <button className="min-h-16 w-full rounded border border-dashed border-slate-200 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50" aria-label={`Assign ${employee.name} ${group.name} ${day}`} onClick={() => onCell(empty)}><Plus className="mx-auto size-3.5" /><span className="text-[10px]">No assignment</span></button> : <span className="block p-2 text-center text-slate-400" aria-label="No assignment">—</span>)}
                </td>
              })}
            </tr>)}
          </tbody>)}
          {standbyPeople.length > 0 && <tbody aria-label="Standby — separate from direct staffing">
            {standbyPeople.map(([id, name], index) => <tr key={id}>
              {index === 0 && <th rowSpan={standbyPeople.length} scope="rowgroup" className="sticky left-0 z-20 border-r border-b border-t-2 border-slate-200 bg-white p-3 text-left align-top"><p className="font-semibold">Standby</p><p className="text-xs font-normal text-slate-500">Local day · excluded from direct staffing</p></th>}
              <th scope="row" className="sticky left-[var(--shift-column)] z-10 border-r border-b border-slate-200 bg-white p-3 text-left align-top font-medium">{name}</th>
              {range.days.map(day => <td key={day} className={cn('border-r border-b border-slate-200 p-2 align-top', cellBackground(day))}>{standbyItems.filter(x => x.standby.employeeId === id && x.standby.workDate === day).map(x => <div key={`${x.roster.id}:${x.standby.id}`} className="space-y-1 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950"><p className="font-semibold">Standby · {x.roster.status}</p><p>{preview && x.standby.id < 0 ? 'Proposed' : x.standby.source === 'Manual' ? 'Manual · protected' : 'Rotation'}</p><p>No direct-work attendance</p></div>)}{!standbyItems.some(x => x.standby.employeeId === id && x.standby.workDate === day) && <span className="text-slate-400">—</span>}</td>)}
            </tr>)}
          </tbody>}
        </table>}
    </div>
    <p className="px-4 py-3 text-xs text-slate-500">Empty cells and unfilled shifts are not absences. Pending requests preserve the original assignment. Approved leave and original swapped assignments retain their history separately.</p>
    {slotId !== null && <OpenShiftDialog id={slotId} close={() => setSlotId(null)} />}
    {vacancy && <CreateOpenShiftDialog {...vacancy} close={() => setVacancy(null)} />}
    <Dialog open={originalId !== null} onOpenChange={open => { if (!open) setOriginalId(null) }}><DialogContent className="max-w-xl"><DialogTitle>Original assignment history</DialogTitle><DialogDescription>Approved leave or swap preserves the original assignment.</DialogDescription>{originalId !== null && <AssignmentAttendancePanel assignmentId={originalId} />}</DialogContent></Dialog>
    <Dialog open={Boolean(detail)} onOpenChange={open => { if (!open) setDetail(null) }}><DialogContent className="max-w-xl"><DialogTitle>Assignment details</DialogTitle><DialogDescription>Your published work assignment and attendance.</DialogDescription>{detail && <><AssignmentDetails item={detail} /><AssignmentAttendancePanel assignmentId={detail.assignment.id} /></>}</DialogContent></Dialog>
  </>
}
