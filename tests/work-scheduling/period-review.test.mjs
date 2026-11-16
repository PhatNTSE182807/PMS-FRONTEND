import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../../src/types/attendancePeriods.dto.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { matchesReview } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
const row = (status, flags = {}, pay = {}) => ({ attendance: { status, isLate: false, autoEnded: false, ...flags }, pay: { hasAdjustments: false, overtimeStatus: 'None', ...pay } })

test('absence review includes actual Absent assignments only, not approved leave or reassigned originals', () => {
  const items = ['Absent', 'ApprovedLeave', 'Reassigned', 'Upcoming', 'Completed', 'NotPublished'].map(x => row(x))
  assert.deepEqual(items.filter(x => matchesReview(x, 'Absent')).map(x => x.attendance.status), ['Absent'])
})

test('Late and automatic end remain flags while filtering completed assignments', () => {
  const item = row('Completed', { isLate: true, autoEnded: true })
  assert.equal(matchesReview(item, 'Late'), true)
  assert.equal(matchesReview(item, 'AutoEnded'), true)
  assert.equal(matchesReview(item, 'Absent'), false)
})

test('adjustments and overtime filters follow backend evidence and approval status', () => {
  assert.equal(matchesReview(row('Completed', {}, { hasAdjustments: true }), 'Adjusted'), true)
  for (const status of ['None', 'Approved', 'Rejected']) assert.equal(matchesReview(row('Completed', {}, { overtimeStatus: status }), 'OvertimePending'), false)
  assert.equal(matchesReview(row('Completed', {}, { overtimeStatus: 'Pending' }), 'OvertimePending'), true)
})
