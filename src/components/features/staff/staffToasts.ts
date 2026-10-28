import { toast } from 'sonner'
import type { GateAlertDTO, GateReservationLookupDTO } from '@/types/operations.dto'

/**
 * Staff popup texts, word for word from the web popup notification spec (section 2, role Staff).
 * Do not reword them and do not add new ones here: a case the spec does not cover stays inline.
 */
export const STAFF_TOAST = {
  // 2.1 Scanning & identification
  ticketLoaded: 'Ticket information loaded successfully.',
  invalidTicket: 'Invalid or expired ticket.',
  blacklisted: 'Alert: Blacklisted vehicle detected. Check-in denied.',
  ticketUsed: 'Check-in blocked: This ticket has already been used for an active session.',
  // 2.2 Check-in
  checkedIn: 'Check-in successful. Barrier opened.',
  lotFull: 'Parking lot is full. Only reserved vehicles are allowed.',
  alreadyInside: 'System shows this vehicle is already inside the parking lot.',
  // 2.3 Check-out & violations
  checkedOut: 'Payment confirmed. Check-out successful.',
  unpaid: 'Check-out blocked: Unpaid parking fees.',
  graceExceeded: 'Grace period exceeded. Additional fees apply. Please collect payment.',
  vehicleNotFound: 'Vehicle not found. Please verify manually.',
  lostTicketApplied: 'Lost ticket penalty applied successfully. Vehicle cleared for exit.',
} as const

export const isPast = (iso: string | null | undefined) => Boolean(iso && Date.now() > Date.parse(iso))

/**
 * Popup for a scanned reservation QR / typed code at the entry lane. "Too early" has no spec text:
 * the reservation card shows it inline.
 */
export function toastReservationLookup(info: GateReservationLookupDTO) {
  const r = info.reservation
  if (info.canCheckIn) toast.success(STAFF_TOAST.ticketLoaded)
  else if (r.status === 'CheckedIn') toast.error(STAFF_TOAST.ticketUsed)
  else if (r.status !== 'Confirmed') toast.error(STAFF_TOAST.invalidTicket)
  else if (info.openSessionCode) toast.error(STAFF_TOAST.alreadyInside)
  else if (isPast(r.checkInUntil)) toast.error(STAFF_TOAST.invalidTicket)
}

/** The booking behind a check-in, when known: tells a used ticket from an invalid or expired one. */
export interface EntryTicket {
  status?: string | null
  checkInUntil?: string | null
}

/**
 * Popups for the blocking alerts of a check-in (lane console or app request). Alerts without a spec
 * text (low ANPR confidence, missing plate, bay taken, lot closed, changed vehicle) stay inline only.
 */
export function toastEntryAlerts(alerts: GateAlertDTO[], ticket?: EntryTicket | null) {
  const codes = new Set(alerts.filter((a) => a.blocking).map((a) => a.code))
  if (codes.has('BLACKLISTED')) toast.error(STAFF_TOAST.blacklisted)
  if (codes.has('DUPLICATE_SESSION')) toast.error(STAFF_TOAST.alreadyInside)
  if (codes.has('ZONE_FULL')) toast.warning(STAFF_TOAST.lotFull)
  if (codes.has('RESERVATION_INVALID')) toast.error(ticket?.status === 'CheckedIn' ? STAFF_TOAST.ticketUsed : STAFF_TOAST.invalidTicket)
  // Only a hold that has ended is an expired ticket; "too early" is not
  else if (codes.has('RESERVATION_OUTSIDE_WINDOW') && isPast(ticket?.checkInUntil)) toast.error(STAFF_TOAST.invalidTicket)
}

/** The fee is not settled: past the exit window it is a late fee, otherwise simply unpaid. */
export function toastUnsettled(exitWindowEndsAt: string | null | undefined) {
  if (isPast(exitWindowEndsAt)) toast.warning(STAFF_TOAST.graceExceeded)
  else toast.error(STAFF_TOAST.unpaid)
}
