import { useNow } from '@/hooks/useNow'
import { formatVnd } from '@/lib/format'

/** "2 h 05 min", "12 min", "less than a minute". */
export function formatStay(minutes: number): string {
  if (minutes < 1) return 'less than a minute'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days} d ${hours % 24} h ${String(rest).padStart(2, '0')} min`
  return `${hours} h ${String(rest).padStart(2, '0')} min`
}

/** Minutes since entry, ticking on the client so the bay popup stays current between refreshes. */
export function useStayMinutes(entryTime: string | null | undefined): number | null {
  const now = useNow(15_000)
  if (!entryTime) return null
  return Math.max(0, Math.floor((now - new Date(entryTime).getTime()) / 60_000))
}

export const vndOrDash = (value: number | null | undefined) => (value == null ? '—' : formatVnd(value))
