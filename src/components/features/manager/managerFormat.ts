import { formatNumber } from '@/lib/format'

/** "1,250,000 VND" — the Manager console shows amounts like the Stitch design. */
export const vnd = (value: number) => `${formatNumber(Math.round(value))} VND`

const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })

/** "14:30" */
export const formatClock = (ts: number) => clock.format(ts)

/** "42m" / "2h 05m" */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}
