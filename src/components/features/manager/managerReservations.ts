import type { ReservationDTO, ReservationStatus } from '@/types/operations.dto'

/** Bookings that will never use their bay do not count towards the day's total. */
export const VOID_RESERVATION: ReservationStatus[] = ['Cancelled', 'LotCancelled', 'Expired']

/** Start and end of the browser's calendar day, for the reservations query. */
export function dayRange(ts: number) {
  const from = new Date(ts)
  from.setHours(0, 0, 0, 0)
  const to = new Date(ts)
  to.setHours(23, 59, 59, 999)
  return { from: from.toISOString(), to: to.toISOString() }
}

/** A confirmed booking still counts as expected until its hold ends. */
export const isAwaitingArrival = (r: ReservationDTO, now: number) => r.status === 'Confirmed' && Date.parse(r.checkInUntil) >= now

export const arrivesWithinHour = (r: ReservationDTO, now: number) => Date.parse(r.arrivalTime) - now < 60 * 60_000
