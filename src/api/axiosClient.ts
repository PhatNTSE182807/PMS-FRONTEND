import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import { getApiBaseUrl } from '@/config/env'
import { session } from '@/lib/session'
import type { ApiErrorDetail, ApiResponse, ApiResult } from '@/types/common.dto'
import { ApiError } from './apiError'

/**
 * Single HTTP client for every service. It is the only module that knows the backend
 * envelope: callers receive the unwrapped payload `T` or an `ApiError`.
 */
export const axiosClient = axios.create({
  timeout: 15_000,
  headers: { Accept: 'application/json' },
})

axiosClient.interceptors.request.use((config) => {
  // Resolved per request so the dev-time URL override applies without a reload.
  config.baseURL = getApiBaseUrl()

  const token = session.getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  // Lets one user action be traced across services once the backend is split.
  config.headers['X-Correlation-Id'] = createCorrelationId()
  return config
})

/** crypto.randomUUID only exists in secure contexts (HTTPS or localhost). */
function createCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

axiosClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const apiError = toApiError(error)

    // An expired or revoked token: drop the session so route guards send the user to login.
    const sentToken = error instanceof AxiosError && Boolean(error.config?.headers?.Authorization)
    if (apiError.status === 401 && sentToken) {
      session.clear()
    }

    return Promise.reject(apiError)
  },
)

/* ------------------------------------------------------------------ */
/* Envelope handling                                                   */
/* ------------------------------------------------------------------ */

function isApiResult(body: unknown): body is ApiResult<unknown> {
  return typeof body === 'object' && body !== null && 'succeeded' in body
}

function isApiResponse(body: unknown): body is ApiResponse<unknown> {
  return typeof body === 'object' && body !== null && 'isSuccess' in body
}

/** Flattens every error format the backend can produce into readable messages. */
function extractMessages(body: unknown): string[] {
  if (typeof body !== 'object' || body === null) return []
  const { errors, message, title } = body as {
    errors?: unknown
    message?: unknown
    title?: unknown
  }

  if (Array.isArray(errors)) {
    // ApiResult: string[] — Result pattern: { code, description }[]
    return errors
      .map((e) => (typeof e === 'string' ? e : (e as ApiErrorDetail)?.description))
      .filter((e): e is string => Boolean(e))
  }
  if (errors && typeof errors === 'object') {
    // ASP.NET ValidationProblemDetails: { Field: ["message"] }
    return Object.values(errors as Record<string, string[]>).flat()
  }
  if (typeof message === 'string') return [message]
  if (typeof title === 'string') return [title]
  return []
}

/** Unwraps either envelope into its payload, throwing when it reports a failure. */
export function unwrap<T>(body: unknown, status?: number): T {
  if (isApiResult(body)) {
    if (!body.succeeded) throw new ApiError(extractMessages(body), { status })
    return body.result as T
  }
  if (isApiResponse(body)) {
    if (!body.isSuccess) throw new ApiError(extractMessages(body), { status })
    return body.data as T
  }
  return body as T
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (error instanceof AxiosError) {
    if (error.response) {
      const { status, data } = error.response
      const messages = extractMessages(data)
      return new ApiError(messages.length > 0 ? messages : [`Request failed (HTTP ${status}).`], { status })
    }
    return new ApiError(
      [`Could not reach the API server at ${error.config?.baseURL ?? getApiBaseUrl()}.`],
      { isNetworkError: true },
    )
  }

  return new ApiError([error instanceof Error ? error.message : 'Unexpected error.'])
}

/* ------------------------------------------------------------------ */
/* Typed helpers used by the service modules                           */
/* ------------------------------------------------------------------ */

async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await axiosClient.request<unknown>(config)
  return unwrap<T>(response.data, response.status)
}

export const http = {
  get: <T>(url: string, config?: AxiosRequestConfig) => request<T>({ ...config, method: 'GET', url }),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: 'POST', url, data }),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: 'PUT', url, data }),
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: 'PATCH', url, data }),
  delete: <T>(url: string, config?: AxiosRequestConfig) => request<T>({ ...config, method: 'DELETE', url }),
}
