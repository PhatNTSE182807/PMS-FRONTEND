import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
const code = ts.transpileModule(
  readFileSync(new URL('../../src/lib/revenuePeriods.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext } },
).outputText
const { daysInRange, previousRange, granularityFor, splitRange, percentChange, formatPeriod, formatPeriodTick } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
)

test('daysInRange counts both ends', () => {
  assert.equal(daysInRange({ startDate: '2026-11-04', endDate: '2026-11-04' }), 1)
  assert.equal(daysInRange({ startDate: '2026-11-01', endDate: '2026-11-04' }), 4)
  assert.equal(daysInRange({ startDate: '2026-01-01', endDate: '2026-12-31' }), 365)
})

test('previousRange is the same length and ends the day before', () => {
  assert.deepEqual(previousRange({ startDate: '2026-11-04', endDate: '2026-11-04' }), { startDate: '2026-11-03', endDate: '2026-11-03' })
  assert.deepEqual(previousRange({ startDate: '2026-11-01', endDate: '2026-11-04' }), { startDate: '2026-10-28', endDate: '2026-10-31' })
  assert.deepEqual(previousRange({ startDate: '2026-03-01', endDate: '2026-03-31' }), { startDate: '2026-01-29', endDate: '2026-02-28' })
})

test('granularityFor keeps the chart near a month of points', () => {
  assert.equal(granularityFor({ startDate: '2026-11-01', endDate: '2026-11-30' }), 'DAY')
  assert.equal(granularityFor({ startDate: '2026-10-01', endDate: '2026-10-31' }), 'DAY')
  assert.equal(granularityFor({ startDate: '2026-10-01', endDate: '2026-11-04' }), 'WEEK')
  assert.equal(granularityFor({ startDate: '2026-01-01', endDate: '2026-11-04' }), 'MONTH')
  assert.equal(granularityFor({ startDate: '2024-01-01', endDate: '2026-11-04' }), 'YEAR')
})

test('splitRange cuts days, Monday weeks, months and years, clipped to the range', () => {
  assert.deepEqual(splitRange({ startDate: '2026-11-01', endDate: '2026-11-03' }), [
    { startDate: '2026-11-01', endDate: '2026-11-01' },
    { startDate: '2026-11-02', endDate: '2026-11-02' },
    { startDate: '2026-11-03', endDate: '2026-11-03' },
  ])
  // 2026-10-01 is a Thursday; 2026-10-05 a Monday.
  const weeks = splitRange({ startDate: '2026-10-01', endDate: '2026-11-04' }, 'WEEK')
  assert.deepEqual(weeks[0], { startDate: '2026-10-01', endDate: '2026-10-04' })
  assert.deepEqual(weeks[1], { startDate: '2026-10-05', endDate: '2026-10-11' })
  assert.deepEqual(weeks.at(-1), { startDate: '2026-11-02', endDate: '2026-11-04' })
  assert.deepEqual(splitRange({ startDate: '2026-01-15', endDate: '2026-03-10' }, 'MONTH'), [
    { startDate: '2026-01-15', endDate: '2026-01-31' },
    { startDate: '2026-02-01', endDate: '2026-02-28' },
    { startDate: '2026-03-01', endDate: '2026-03-10' },
  ])
  assert.deepEqual(splitRange({ startDate: '2025-06-01', endDate: '2026-11-04' }, 'YEAR'), [
    { startDate: '2025-06-01', endDate: '2025-12-31' },
    { startDate: '2026-01-01', endDate: '2026-11-04' },
  ])
})

test('the periods cover every day of the range exactly once', () => {
  const range = { startDate: '2026-02-11', endDate: '2026-05-20' }
  const periods = splitRange(range)
  const days = periods.reduce((sum, period) => sum + daysInRange(period), 0)
  assert.equal(days, daysInRange(range))
  assert.equal(periods[0].startDate, range.startDate)
  assert.equal(periods.at(-1).endDate, range.endDate)
})

test('percentChange is null when there is nothing to compare with', () => {
  assert.equal(percentChange(150, 100), 50)
  assert.equal(percentChange(76, 100), -24)
  assert.equal(percentChange(100, 0), null)
})

test('period labels', () => {
  assert.equal(formatPeriod({ startDate: '2026-11-04', endDate: '2026-11-04' }), '04/11/2026')
  assert.equal(formatPeriod({ startDate: '2026-10-01', endDate: '2026-10-31' }), '10/2026')
  assert.equal(formatPeriod({ startDate: '2026-01-01', endDate: '2026-12-31' }), '2026')
  assert.equal(formatPeriod({ startDate: '2026-11-02', endDate: '2026-11-04' }), '02/11 – 04/11/2026')
  assert.equal(formatPeriod({ startDate: '2025-12-29', endDate: '2026-01-04' }), '29/12/2025 – 04/01/2026')
  assert.equal(formatPeriodTick('DAY', '2026-11-04'), '04/11')
  assert.equal(formatPeriodTick('MONTH', '2026-11-01'), '11/2026')
  assert.equal(formatPeriodTick('YEAR', '2026-01-01'), '2026')
})
