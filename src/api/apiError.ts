/** Error thrown by every service call (real or mocked), so the UI handles one shape. */
export class ApiError extends Error {
  readonly status?: number
  readonly errors: string[]
  readonly isNetworkError: boolean

  constructor(errors: string[], options: { status?: number; isNetworkError?: boolean } = {}) {
    super(errors[0] ?? 'Something went wrong.')
    this.name = 'ApiError'
    this.errors = errors.length > 0 ? errors : [this.message]
    this.status = options.status
    this.isNetworkError = options.isNetworkError ?? false
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
