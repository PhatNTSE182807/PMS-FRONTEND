import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'

const code = ts.transpileModule(readFileSync(new URL('../../src/lib/workScheduleCalendar.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { addCalendarDays, calendarRange, navigateCalendar, shiftEndDate, isCalendarWeekend, buildShiftGroups, assignmentsForCell } =
  await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

const person = (id, name = 'Đặng Quốc Bảo') => ({ id, employeeId: id, staffName: name, position: 'Entry', notes: 'Gate A', status: 'Assigned' })
const shift = (id, day, people = [person(1)], extra = {}) => ({ id, workShiftTemplateId: 1, workDate: day, name: 'Morning',
  startTime: '06:00:00', endTime: '14:00:00', assignments: people, entryAssigned: people.length,
  minimumEntryStaff: 2, minimumExitStaff: 0, minimumCounterStaff: 0, exitAssigned: 0, counterAssigned: 0, ...extra })
const roster = (id, shifts) => ({ id, parkingLotId: 1, name: `Roster ${id}`, status: 'Published', fromDate: '2026-11-01', toDate: '2027-02-01', shifts })

test('Monday weeks cross month and year boundaries without local-time conversion', () => {
  const range = calendarRange('2027-01-03', 'week')
  assert.equal(range.from, '2026-12-28')
  assert.equal(range.to, '2027-01-03')
  assert.equal(range.days.length, 7)
  assert.equal(isCalendarWeekend('2027-01-03'), true)
  assert.equal(isCalendarWeekend('2027-01-04'), false)
})
test('month view contains exactly the days of normal and leap months', () => {
  assert.equal(calendarRange('2028-02-15', 'month').days.length, 29)
  assert.equal(calendarRange('2026-02-15', 'month').days.length, 28)
  assert.equal(calendarRange('2026-11-15', 'day').days.length, 1)
  assert.equal(navigateCalendar('2026-01-31', 'month', 1), '2026-02-01')
  assert.equal(navigateCalendar('2026-12-31', 'week', 1), '2027-01-07')
})
test('overnight end date is explicit and remains attached to start day', () => {
  assert.equal(shiftEndDate(shift(1, '2026-12-31', [], { startTime: '22:00:00', endTime: '06:00:00' })), '2027-01-01')
  assert.equal(shiftEndDate(shift(1, '2026-12-31')), '2026-12-31')
})
test('employee changing shifts appears in both groups and every cell retains exact IDs', () => {
  const data = [roster(9, [shift(11, '2026-11-16'), shift(12, '2026-11-17', [person(2)], { workShiftTemplateId: 2, name: 'Night', startTime: '22:00:00', endTime: '06:00:00' })])]
  // Same employee, different assignment IDs on different dates and shift groups.
  data[0].shifts[1].assignments[0].employeeId = 1
  const groups = buildShiftGroups(data, calendarRange('2026-11-16', 'week'), '')
  assert.equal(groups.length, 2)
  assert.ok(groups.every(g => g.employees[0].id === 1))
  assert.equal(assignmentsForCell(groups[0], 1, '2026-11-16')[0].assignment.id, 1)
  assert.equal(assignmentsForCell(groups[1], 1, '2026-11-17')[0].assignment.id, 2)
  assert.equal(assignmentsForCell(groups[0], 1, '2026-11-17').length, 0)
})
test('multiple assignments in a cell are not overwritten by day or employee keys', () => {
  const a = shift(11, '2026-11-16', [person(101)])
  const b = shift(12, '2026-11-16', [person(102)])
  a.assignments[0].employeeId = b.assignments[0].employeeId = 1
  const [group] = buildShiftGroups([roster(1, [a]), roster(2, [b])], calendarRange('2026-11-16', 'day'), '')
  assert.deepEqual(assignmentsForCell(group, 1, '2026-11-16').map(x => [x.roster.id, x.shift.id, x.assignment.id]), [[1, 11, 101], [2, 12, 102]])
})
test('changed template hours preserve separate snapshot groups', () => {
  const groups = buildShiftGroups([roster(1, [shift(1, '2026-11-16'), shift(2, '2026-11-17', [person(2)], { startTime: '07:00:00' })])], calendarRange('2026-11-16', 'week'), '')
  assert.equal(groups.length, 2)
})
test('search is accent-insensitive and does not change staffing totals', () => {
  const data = [roster(1, [shift(1, '2026-11-16', [person(1), person(2, 'Nguyễn Thị Hoa')])])]
  const [group] = buildShiftGroups(data, calendarRange('2026-11-16', 'week'), 'dang quoc')
  assert.deepEqual(group.employees.map(p => p.id), [1])
  assert.equal(group.occurrences[0].shift.entryAssigned, 2)
  assert.equal(group.occurrences[0].shift.assignments.length, 2)
})
test('unfilled dated shifts retain a group with no employee rows', () => {
  const [group] = buildShiftGroups([roster(1, [shift(1, '2026-11-16', [])])], calendarRange('2026-11-16', 'week'), '')
  assert.equal(group.employees.length, 0)
  assert.equal(group.occurrences.length, 1)
  assert.equal(group.occurrences[0].shift.minimumEntryStaff, 2)
})
test('93-day rosters and large teams are filtered to the visible month without truncating cells', () => {
  const shifts = Array.from({ length: 93 }, (_, i) => shift(i + 1, addCalendarDays('2026-11-01', i), Array.from({ length: 150 }, (_, p) => person(p + 1, `Staff ${p + 1}`))))
  const [group] = buildShiftGroups([roster(1, shifts)], calendarRange('2026-12-15', 'month'), '')
  assert.equal(group.occurrences.length, 31)
  assert.equal(group.employees.length, 150)
  assert.equal(assignmentsForCell(group, 150, '2026-12-31').length, 1)
})
