/** What the user reads for any server failure (HTTP 5xx), word for word from the popup notification spec. */
export const SYSTEM_ERROR_MESSAGE = 'System error. Please contact technical support or check server logs.'

/**
 * Error thrown by every service call (real or mocked), so the UI handles one shape.
 * A server failure (HTTP 5xx) always carries SYSTEM_ERROR_MESSAGE: the backend's own text of such a failure
 * is technical (exception messages, SQL) and must not reach the screen, so it is kept in `technicalDetails`.
 */
export class ApiError extends Error {
  readonly status?: number
  readonly errors: string[]
  readonly isNetworkError: boolean
  /** The backend's messages of a server failure. For the console and logs only, never shown to the user. */
  readonly technicalDetails: string[]

  constructor(errors: string[], options: { status?: number; isNetworkError?: boolean } = {}) {
    const serverFailure = options.status !== undefined && options.status >= 500
    const shown = serverFailure ? [SYSTEM_ERROR_MESSAGE] : errors
    super(shown[0] ?? 'Something went wrong.')
    this.name = 'ApiError'
    this.errors = shown.length > 0 ? shown : [this.message]
    this.status = options.status
    this.isNetworkError = options.isNetworkError ?? false
    this.technicalDetails = serverFailure ? errors : []
  }

  /** All messages joined, e.g. for a form-level alert. */
  get description(): string {
    return this.errors.join('; ')
  }
}

export function getErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof ApiError) return error.description
  if (error instanceof Error && error.message) return error.message
  return fallback
}
