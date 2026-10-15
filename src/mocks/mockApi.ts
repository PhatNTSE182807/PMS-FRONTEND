import { ApiError } from '@/api/apiError'
import { unwrap } from '@/api/axiosClient'
import type { ApiResult } from '@/types/common.dto'

/** Simulated network latency, so loading states are visible in mock mode. */
export const MOCK_LATENCY_MS = 500

export const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Runs a mock handler as if it were an HTTP call: waits, wraps the result in the same
 * `ApiResult<T>` envelope the backend sends, and unwraps it through the real client code.
 * The returned data is a deep copy, so callers can never mutate the mock "database".
 */
export async function mockResponse<T>(handler: () => T, latencyMs = MOCK_LATENCY_MS): Promise<T> {
  await delay(latencyMs)
  const envelope: ApiResult<T> = { succeeded: true, result: structuredClone(handler()), errors: [] }
  return unwrap<T>(envelope, 200)
}

/** Throws the same error a failed backend call would produce. */
export function mockFail(status: number, ...errors: string[]): never {
  throw new ApiError(errors, { status })
}

export function mockId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
