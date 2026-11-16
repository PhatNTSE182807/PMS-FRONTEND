import type { DutyAssignment, DutyRoster, RosterShift, WorkShiftTemplate } from '../types/workScheduling.dto'

export type CalendarView = 'day' | 'week' | 'month'
export interface CalendarRange { from: string; to: string; days: string[] }
export interface ShiftReference { roster: DutyRoster; shift: RosterShift }
export interface AssignmentReference extends ShiftReference { assignment: DutyAssignment }
export interface ShiftGroup {
  key: string; templateId: number; name: string; startTime: string; endTime: string
  occurrences: ShiftReference[]
  employees: { id: number; name: string }[]
  template?: WorkShiftTemplate
}

// Date-only arithmetic deliberately avoids the browser's time zone and DST.
export function addCalendarDays(day: string, amount: number): string {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + amount)
  return d.toISOString().slice(0, 10)
}

export function calendarRange(anchor: string, view: CalendarView): CalendarRange {
  let from = anchor
  let count = 1
  const d = new Date(`${anchor}T12:00:00Z`)
  if (view === 'week') { from = addCalendarDays(anchor, -((d.getUTCDay() + 6) % 7)); count = 7 }
  if (view === 'month') {
    from = `${anchor.slice(0, 7)}-01`
    count = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  }
  const days = Array.from({ length: count }, (_, i) => addCalendarDays(from, i))
  return { from, to: days[days.length - 1], days }
}

export function navigateCalendar(anchor: string, view: CalendarView, direction: number): string {
  if (view !== 'month') return addCalendarDays(anchor, direction * (view === 'week' ? 7 : 1))
  const d = new Date(`${anchor}T12:00:00Z`)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + direction, 1, 12)).toISOString().slice(0, 10)
}

export function isCalendarWeekend(day: string): boolean {
  return [0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay())
}

export function shiftEndDate(shift: Pick<RosterShift, 'workDate' | 'startTime' | 'endTime'>): string {
  return shift.endTime < shift.startTime ? addCalendarDays(shift.workDate, 1) : shift.workDate
}

export function calendarGroupKey(shift: Pick<RosterShift, 'workShiftTemplateId' | 'name' | 'startTime' | 'endTime'>): string {
  return JSON.stringify([shift.workShiftTemplateId, shift.name, shift.startTime, shift.endTime])
}

export function buildShiftGroups(rosters: DutyRoster[], range: CalendarRange, search: string, templates: WorkShiftTemplate[] = []): ShiftGroup[] {
  const groups = new Map<string, ShiftGroup>()
  const term = search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLocaleLowerCase().trim()
  for (const roster of rosters) for (const shift of roster.shifts) {
    if (shift.workDate < range.from || shift.workDate > range.to) continue
    const key = calendarGroupKey(shift)
    let group = groups.get(key)
    if (!group) {
      group = { key, templateId: shift.workShiftTemplateId, name: shift.name, startTime: shift.startTime, endTime: shift.endTime, occurrences: [], employees: [] }
      groups.set(key, group)
    }
    group.occurrences.push({ roster, shift })
  }
  for (const template of templates.filter(t => t.isActive)) {
    const key = calendarGroupKey({ ...template, workShiftTemplateId: template.id })
    const existing = groups.get(key)
    if (existing) existing.template = template
    else groups.set(key, { key, templateId: template.id, name: template.name, startTime: template.startTime, endTime: template.endTime, template, occurrences: [], employees: [] })
  }
  for (const group of groups.values()) {
    const people = new Map<number, string>()
    for (const { shift } of group.occurrences) for (const a of [...shift.assignments, ...(shift.trail ?? [])]) {
      const searchable = a.staffName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLocaleLowerCase()
      if (!term || searchable.includes(term)) people.set(a.employeeId, a.staffName)
    }
    group.employees = [...people].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }
  return [...groups.values()].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.name.localeCompare(b.name) || a.key.localeCompare(b.key))
}

export function assignmentsForCell(group: ShiftGroup, employeeId: number, day: string): AssignmentReference[] {
  return group.occurrences.filter(x => x.shift.workDate === day)
    .flatMap(x => x.shift.assignments.filter(a => a.employeeId === employeeId).map(assignment => ({ ...x, assignment })))
}
