import type { DutyCell, DutySlot } from '@/types/duty.dto'
import { currentLocale } from '@/i18n'

export interface DutySlotInfo {
  slot: DutySlot
  label: string
  hours: string
}

/** First date with three 8-hour shifts (the backend's DutySlots.ThreeShiftsFrom). */
export const THREE_SHIFTS_FROM = '2026-11-24'

const FOUR_SHIFTS: DutySlotInfo[] = [
  { slot: 0, label: 'Night', hours: '00:00–06:00' },
  { slot: 1, label: 'Morning', hours: '06:00–12:00' },
  { slot: 2, label: 'Afternoon', hours: '12:00–18:00' },
  { slot: 3, label: 'Evening', hours: '18:00–24:00' },
]

const THREE_SHIFTS: DutySlotInfo[] = [
  { slot: 0, label: 'Night', hours: '00:00–08:00' },
  { slot: 1, label: 'Morning', hours: '08:00–16:00' },
  { slot: 2, label: 'Evening', hours: '16:00–24:00' },
]

/** The fixed shifts of a yyyy-MM-dd date. */
export const dutySlotsOn = (date: string) => (date >= THREE_SHIFTS_FROM ? THREE_SHIFTS : FOUR_SHIFTS)

export const slotHours = (date: string, slot: DutySlot) => dutySlotsOn(date)[slot]?.hours ?? ''

/** Board rows of a week: the shifts of its last day, then any extra shift an earlier day still has. */
export function dutyRows(dates: string[]): DutySlotInfo[] {
  const rows = [...dutySlotsOn(dates[dates.length - 1])]
  for (const date of dates)
    for (const info of dutySlotsOn(date)) if (!rows.some((row) => row.slot === info.slot)) rows.push(info)
  return rows
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** yyyy-MM-dd ± days, computed on the date only (no time zone shifts). */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

/** Monday of the week of a yyyy-MM-dd date. */
export function mondayOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return addDays(iso, -((day + 6) % 7))
}

/** "Mon" … "Sun" of a yyyy-MM-dd date. */
export function weekdayOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return WEEKDAYS[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7]
}

/** "24/11" */
export const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** "24/11/2026" */
export const fullDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

/** "Tue 25/11 · 06:00–12:00" */
export const shiftLabel = (date: string, slot: DutySlot) => `${weekdayOf(date)} ${dayMonth(date)} · ${slotHours(date, slot)}`

export const weekDates = (weekStart: string) => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

export const cellKey = (cell: Pick<DutyCell, 'date' | 'slot'>) => `${cell.date}:${cell.slot}`

/** "in 2 days", "in 3 h", "in 25 min", "now" from an ISO instant. */
export function startsIn(iso: string, now = Date.now()): string {
  const minutes = Math.round((new Date(iso).getTime() - now) / 60_000)
  if (minutes <= 0) return 'now'
  if (minutes < 60) return `in ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `in ${hours} h`
  const days = Math.round(hours / 24)
  return `in ${days} day${days === 1 ? '' : 's'}`
}

/** "06:20" in the viewer's time. */
export const clock = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString(currentLocale(), { hour: '2-digit', minute: '2-digit' }) : '—'

export const EMPLOYMENT_LABEL: Record<string, string> = { FullTime: 'Full-time', Backup: 'Backup', Manager: 'Manager' }

/** Badge colour of a leave request status. */
export const LEAVE_TONE = { Pending: 'amber', Approved: 'emerald', Rejected: 'rose', Cancelled: 'neutral' } as const

/** "24/11/2026" or "24/11/2026 – 26/11/2026" */
export const leaveRange = (r: { fromDate: string; toDate: string }) =>
  r.fromDate === r.toDate ? fullDate(r.fromDate) : `${fullDate(r.fromDate)} – ${fullDate(r.toDate)}`

/** "November 2026" from yyyy-MM-01 */
export const monthLabel = (month: string) =>
  new Date(`${month.slice(0, 7)}-01T00:00:00`).toLocaleDateString(currentLocale(), { month: 'long', year: 'numeric' })
