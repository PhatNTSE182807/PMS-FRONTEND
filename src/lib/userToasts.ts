import { toast } from 'sonner'
import { ApiError, getErrorMessage } from '@/api/apiError'

/**
 * Customer popup texts, word for word from the web popup notification spec (section 1).
 * Do not reword them and do not add new ones here.
 *
 * Spec sentences that are not wired because the backend cannot produce the event: cancel refused as too
 * late (a late cancel is allowed and only keeps the deposit), reserved slot taken and reassigned, parked in
 * the wrong slot, the 15-minute reminder (the backend reminds 5 minutes before the hold ends) and overstay.
 */
export const USER_TOAST = {
  // 1.1 Wallet & payment
  walletDeposited: 'Deposit successful. Your wallet balance has been updated.',
  feePaidFromWallet: 'Parking fee paid successfully from your wallet.',
  insufficientBalance: 'Insufficient wallet balance. Please top up your wallet to proceed.',
  transactionFailed: 'Transaction failed. Please try again or contact support.',
  // 1.2 Booking & cancellation
  bookingSuccess: 'Booking successful. Your parking slot is reserved.',
  bookingCancelled: 'Booking cancelled successfully. Your deposit has been refunded.',
  slotConflict: 'This slot is already booked. Please choose another one.',
  bookingLimit: 'You have reached the maximum number of active bookings allowed.',
  // 1.3 On site
  checkedIn: 'Check-in successful. Welcome to XXIV Parking! Please proceed to your slot.',
  checkedOut: 'Check-out successful. Have a safe trip!',
  noShow: 'Your reservation was auto-cancelled as you did not check in within the grace period.',
  // 1.4 Profile & vehicles
  vehicleAdded: 'Vehicle added successfully.',
  plateDuplicate: 'This license plate is already registered in the system.',
  profileUpdated: 'Profile updated successfully.',
} as const

/*
 * The backend answers these cases with a plain 400 and only a message, so they are told apart by the
 * message. Keep the patterns in step with ReservationService, PaymentService and UserProfileService.
 */
const matches = (error: unknown, pattern: RegExp) => error instanceof ApiError && pattern.test(error.message)

const isInsufficientBalance = (error: unknown) => matches(error, /insufficient .*wallet balance/i)
const isBookingLimit = (error: unknown) => matches(error, /at most \d+ active reservations|already has an active reservation/i)

/** The plate already belongs to a vehicle of this or another account. */
export const isPlateDuplicate = (error: unknown) => matches(error, /license plate is already registered/i)

/**
 * Error popup of a booking request (new or changed): a taken or unavailable slot (HTTP 409) and the
 * active-booking limit have spec texts, anything else shows the backend's own message.
 */
export function toastBookingError(error: unknown) {
  if (error instanceof ApiError && error.status === 409) toast.error(USER_TOAST.slotConflict)
  else if (isBookingLimit(error)) toast.error(USER_TOAST.bookingLimit)
  else toast.error(getErrorMessage(error))
}

/**
 * Error popup of a wallet top-up or a payment: too little balance is a warning, any other failure gets
 * the spec's transaction text with the backend's reason as its description.
 */
export function toastPaymentError(error: unknown, fallback?: string) {
  if (isInsufficientBalance(error)) toast.warning(USER_TOAST.insufficientBalance)
  else toast.error(USER_TOAST.transactionFailed, { description: getErrorMessage(error, fallback) })
}
