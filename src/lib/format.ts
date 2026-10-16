const vndFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
const compactFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const numberFormatter = new Intl.NumberFormat('en-US')
const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
const timeFormatter = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** ₫1,250,000 */
export const formatVnd = (value: number) => vndFormatter.format(value)

/** "1.3M ₫" — for chart axes and tight spaces. */
export const formatVndCompact = (value: number) => `${compactFormatter.format(value)} ₫`

export const formatNumber = (value: number) => numberFormatter.format(value)

/** "+12.4%" / "-3.0%" */
export const formatPercent = (value: number, fractionDigits = 1) =>
  `${value > 0 ? '+' : ''}${value.toFixed(fractionDigits)}%`

/** "—" for a missing or unparseable date instead of throwing "Invalid time value". */
export function formatDate(iso: string | null | undefined): string {
  const date = iso ? new Date(iso) : null
  return date && !Number.isNaN(date.getTime()) ? dateFormatter.format(date) : '—'
}

export const formatTime = (value: string | number | Date) => timeFormatter.format(new Date(value))

/** "dd/MM" label for a yyyy-MM-dd date, used on chart axes. */
export function formatDayMonth(isoDate: string): string {
  const [, month, day] = isoDate.slice(0, 10).split('-')
  return `${day}/${month}`
}

/** Local yyyy-MM-dd (not UTC, so "today" matches the user's calendar). */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** "just now", "5s ago", "2 min ago"… */
export function formatRelativeTime(from: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - from) / 1000))
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  return `${Math.round(minutes / 60)} h ago`
}

/** "0901234567" → "0901 234 567"; other formats are returned unchanged. */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10 && digits.startsWith('0')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  }
  return phone
}

/** Avatar initials from a Vietnamese full name: "Nguyễn Văn An" → "VA". */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase()
}
