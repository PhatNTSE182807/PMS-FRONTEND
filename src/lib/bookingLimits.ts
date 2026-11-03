import type { ReservationDTO, ReservationStatus } from '@/types/operations.dto'

/**
 * Active bookings allowed per account and per vehicle (BR-07). Same defaults as the backend
 * (`Parking:Reservations:MaxActivePerAccount` / `MaxActivePerVehicle`), which enforces them.
 */
export const MAX_ACTIVE_BOOKINGS_PER_ACCOUNT = 2
export const MAX_ACTIVE_BOOKINGS_PER_VEHICLE = 1

/** Bookings still in progress: waiting for the deposit, confirmed, or the vehicle is parked on it. */
const ACTIVE_STATUSES: ReservationStatus[] = ['PendingDeposit', 'Confirmed', 'CheckedIn']

/** Bookings not started yet, shown with their own card (a checked-in one shows as a parked vehicle). */
const UPCOMING_STATUSES: ReservationStatus[] = ['PendingDeposit', 'Confirmed']

export const isActiveBooking = (r: ReservationDTO) => ACTIVE_STATUSES.includes(r.status)
export const isUpcomingBooking = (r: ReservationDTO) => UPCOMING_STATUSES.includes(r.status)

/** Where the account stands against the booking limits. */
export function bookingAllowance(reservations: ReservationDTO[]) {
  const active = reservations.filter(isActiveBooking)
  return {
    activeCount: active.length,
    limit: MAX_ACTIVE_BOOKINGS_PER_ACCOUNT,
    atLimit: active.length >= MAX_ACTIVE_BOOKINGS_PER_ACCOUNT,
    /** Vehicles that already have a booking in progress and cannot take another one. */
    bookedVehicleIds: new Set(active.map((r) => String(r.vehicleId))),
  }
}
