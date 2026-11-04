/*
 * Calendar periods for the revenue report: the period before a range, and how a range is cut into
 * chart points (the backend has no time series yet, so each point is one report request).
 * Dates are local yyyy-MM-dd and moved by calendar day, never by 24 h, so DST never skips a day.
 * No runtime imports, so tests can load this file on its own.
 */

export type RevenueGranularity = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'

export interface DateRange {
  /** yyyy-MM-dd, inclusive */
  startDate: string
  /** yyyy-MM-dd, inclusive */
  endDate: string
}

/** Longest range charted per day, then per week, then per month; longer ranges go per year. */
const MAX_DAYS_BY_DAY = 31
const MAX_DAYS_BY_WEEK = 16 * 7
const MAX_MONTHS_BY_MONTH = 24

function parse(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function format(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

/** Calendar days in the range, both ends included. */
export function daysInRange({ startDate, endDate }: DateRange): number {
  return Math.round((parse(endDate).getTime() - parse(startDate).getTime()) / 86_400_000) + 1
}

/** The range of the same length that ends the day before `range` starts. */
export function previousRange(range: DateRange): DateRange {
  const start = parse(range.startDate)
  return { startDate: format(addDays(start, -daysInRange(range))), endDate: format(addDays(start, -1)) }
}

/** The finest step that keeps the chart at about a month of points or fewer. */
export function granularityFor(range: DateRange): RevenueGranularity {
  const days = daysInRange(range)
  if (days <= MAX_DAYS_BY_DAY) return 'DAY'
  if (days <= MAX_DAYS_BY_WEEK) return 'WEEK'
  const start = parse(range.startDate)
  const end = parse(range.endDate)
  const months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1
  return months <= MAX_MONTHS_BY_MONTH ? 'MONTH' : 'YEAR'
}

/** First day of the period after the one that contains `date`. Weeks run Monday to Sunday. */
function nextPeriodStart(date: Date, granularity: RevenueGranularity): Date {
  switch (granularity) {
    case 'DAY':
      return addDays(date, 1)
    case 'WEEK':
      return addDays(date, 7 - ((date.getDay() + 6) % 7))
    case 'MONTH':
      return new Date(date.getFullYear(), date.getMonth() + 1, 1)
    case 'YEAR':
      return new Date(date.getFullYear() + 1, 0, 1)
  }
}

/** Cuts the range into calendar days, weeks, months or years; the first and last are clipped to the range. */
export function splitRange(range: DateRange, granularity: RevenueGranularity = granularityFor(range)): DateRange[] {
  const end = parse(range.endDate)
  const periods: DateRange[] = []
  for (let cursor = parse(range.startDate); cursor <= end; ) {
    const next = nextPeriodStart(cursor, granularity)
    const last = addDays(next, -1)
    periods.push({ startDate: format(cursor), endDate: format(last < end ? last : end) })
    cursor = next
  }
  return periods
}

/** Change in percent, 1 decimal; null when the previous value is 0, so there is nothing to compare with. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const dayMonthYear = (iso: string) => `${dayMonth(iso)}/${iso.slice(0, 4)}`
const monthYear = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(0, 4)}`

/** Short label for a chart axis: "04/11", "11/2026" or "2026". Weeks show their first day. */
export function formatPeriodTick(granularity: RevenueGranularity, startDate: string): string {
  if (granularity === 'MONTH') return monthYear(startDate)
  if (granularity === 'YEAR') return startDate.slice(0, 4)
  return dayMonth(startDate)
}

/** Full label: "04/11/2026", "11/2026" for a whole month, "2026" for a whole year, else "01/11 – 04/11/2026". */
export function formatPeriod({ startDate, endDate }: DateRange): string {
  if (startDate === endDate) return dayMonthYear(startDate)
  const start = parse(startDate)
  const afterEnd = addDays(parse(endDate), 1)
  const wholeMonth = start.getDate() === 1 && afterEnd.getDate() === 1 && monthYear(startDate) === monthYear(endDate)
  if (wholeMonth) return monthYear(startDate)
  const wholeYear = startDate.slice(5) === '01-01' && endDate.slice(5) === '12-31' && startDate.slice(0, 4) === endDate.slice(0, 4)
  if (wholeYear) return startDate.slice(0, 4)
  return startDate.slice(0, 4) === endDate.slice(0, 4)
    ? `${dayMonth(startDate)} – ${dayMonthYear(endDate)}`
    : `${dayMonthYear(startDate)} – ${dayMonthYear(endDate)}`
}
