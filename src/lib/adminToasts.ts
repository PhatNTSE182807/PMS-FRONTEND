import { toast } from 'sonner'
import { ApiError, getErrorMessage, SYSTEM_ERROR_MESSAGE } from '@/api/apiError'

/**
 * Admin and Manager popup texts, word for word from the web popup notification spec (section 3).
 * Do not reword them and do not add new ones here.
 *
 * Spec sentences that are not wired because the screen or the API does not exist yet: zone / slot
 * deleted, slot deleted while occupied, capacity below the occupied slots, password reset, locking an
 * account with active parking sessions, system settings saved.
 */
export const ADMIN_TOAST = {
  lotSaved: 'Parking lot configuration saved successfully.',
  pricingUpdated: 'Pricing policy updated successfully.',
  pricingFailed: 'Failed to update pricing. Please check your inputs.',
  accountCreated: 'Staff account created successfully.',
  accountStatusUpdated: 'Account status updated successfully.',
  // Shared with every API error of an HTTP 5xx: see ApiError
  systemError: SYSTEM_ERROR_MESSAGE,
} as const

const isServerError = (error: unknown) => error instanceof ApiError && error.status !== undefined && error.status >= 500

/**
 * Error popup of an Admin or Manager action. A server failure (HTTP 5xx) gets the spec's system error
 * text; anything else shows the backend's own message. `spec` is the spec sentence for a rejected
 * request, with the backend's reason as its description.
 */
export function toastAdminError(error: unknown, options: { spec?: string; fallback?: string } = {}) {
  if (isServerError(error)) toast.error(ADMIN_TOAST.systemError)
  else if (options.spec) toast.error(options.spec, { description: getErrorMessage(error) })
  else toast.error(getErrorMessage(error, options.fallback))
}
