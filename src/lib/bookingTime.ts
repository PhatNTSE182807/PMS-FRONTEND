import type { BookingMode } from '@/types/operations.dto'

/** Same limits as the API (Parking:Reservations): book up to 30 days ahead; a scheduled stay lasts 30 min to 24 h. */
export const BOOKING_RULES = {
  maxLeadDays: 30,
  minStayMinutes: 30,
  maxStayHours: 24,
}

const MINUTE = 60_000

/** "YYYY-MM-DDTHH:mm" in local time, for <input type="datetime-local">. */
export function toLocalInput(value: number | string | Date) {
  const d = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** The next quarter hour at least `leadMinutes` from now: a sensible default arrival. */
export function nextQuarterHour(now: number, leadMinutes = 30) {
  const t = now + leadMinutes * MINUTE
  return Math.ceil(t / (15 * MINUTE)) * 15 * MINUTE
}

export interface BookingTimes {
  mode: BookingMode
  /** datetime-local value */
  arrival: string
  /** datetime-local value; only used for Scheduled */
  departure: string
}

/** Default form values: arrival at the next quarter hour, a two-hour scheduled window. */
export function defaultBookingTimes(now: number, mode: BookingMode = 'PayAsYouGo'): BookingTimes {
  const arrival = nextQuarterHour(now)
  return { mode, arrival: toLocalInput(arrival), departure: toLocalInput(arrival + 2 * 60 * MINUTE) }
}

/**
 * Checks the form like the API does and returns the ISO times, or the first problem in plain English.
 * Times in the past are never accepted.
 */
export function checkBookingTimes(times: BookingTimes, now: number):
  | { ok: true; arrivalTime: string; departureTime: string | null }
  | { ok: false; error: string } {
  const arrival = new Date(times.arrival).getTime()
  if (Number.isNaN(arrival)) return { ok: false, error: 'Pick the arrival date and time.' }
  if (arrival <= now) return { ok: false, error: 'The arrival time is in the past. Pick a later time.' }
  if (arrival > now + BOOKING_RULES.maxLeadDays * 24 * 60 * MINUTE)
    return { ok: false, error: `You can book at most ${BOOKING_RULES.maxLeadDays} days ahead.` }

  if (times.mode === 'PayAsYouGo') return { ok: true, arrivalTime: new Date(arrival).toISOString(), departureTime: null }

  const departure = new Date(times.departure).getTime()
  if (Number.isNaN(departure)) return { ok: false, error: 'Pick the departure date and time.' }
  if (departure < arrival + BOOKING_RULES.minStayMinutes * MINUTE)
    return { ok: false, error: `The departure must be at least ${BOOKING_RULES.minStayMinutes} minutes after arrival.` }
  if (departure > arrival + BOOKING_RULES.maxStayHours * 60 * MINUTE)
    return { ok: false, error: `A scheduled stay can last at most ${BOOKING_RULES.maxStayHours} hours. Choose pay as you go for longer stays.` }
  return { ok: true, arrivalTime: new Date(arrival).toISOString(), departureTime: new Date(departure).toISOString() }
}

const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
const dayFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })

/** "Today", "Tomorrow" or "Fri 24 Oct". */
export function relativeDay(ts: number, now: number) {
  const startOf = (t: number) => new Date(t).setHours(0, 0, 0, 0)
  const diff = Math.round((startOf(ts) - startOf(now)) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return dayFormat.format(ts)
}

/** "Tomorrow, 14:00 - 18:30", "Tomorrow, 14:00 - Sat 25 Oct, 09:00" or "Tomorrow, 14:00 · leave anytime". */
export function describeWindow(arrivalIso: string, departureIso: string | null | undefined, now: number) {
  const arrival = Date.parse(arrivalIso)
  const start = `${relativeDay(arrival, now)}, ${timeFormat.format(arrival)}`
  if (!departureIso) return `${start} · leave anytime`
  const departure = Date.parse(departureIso)
  const sameDay = new Date(arrival).toDateString() === new Date(departure).toDateString()
  return `${start} - ${sameDay ? '' : `${relativeDay(departure, now)}, `}${timeFormat.format(departure)}`
}
