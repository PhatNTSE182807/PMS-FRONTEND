import { session } from '@/lib/session'

/** Bounded contexts the frontend talks to. Each maps to one backend (micro)service. */
export type ServiceKey = 'auth' | 'profile' | 'staff' | 'parking' | 'reports'

const DEFAULT_API_BASE_URL = 'https://localhost:44391/api'
const API_URL_OVERRIDE_KEY = 'pms_custom_api_url'

/**
 * Path of each service relative to the API root.
 * Today `auth`/`profile` are served by the PMS.API monolith (UsersController); the
 * `/v1/...` routes are the contract agreed for the upcoming endpoints and, later,
 * the API gateway routes. Moving a service only changes its entry here.
 */
export const SERVICE_PATHS: Record<ServiceKey, string> = {
  auth: '/Users',
  profile: '/Users/profile',
  staff: '/v1/identity/staff',
  parking: '/v1/parking',
  reports: '/v1/reports',
}

/** Normalizes a user-entered URL (e.g. a pasted Swagger URL) to the API root ending in `/api`. */
export function normalizeApiBaseUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, '')

  if (url.includes('/swagger/index.html')) {
    url = url.replace('/swagger/index.html', '/api')
  } else if (url.includes('/swagger')) {
    url = url.replace('/swagger', '/api')
  }

  if (!url.endsWith('/api') && !url.includes('/api/')) {
    url = `${url}/api`
  }

  return url
}

function readOverride(): string | null {
  if (!import.meta.env.DEV) return null
  try {
    return localStorage.getItem(API_URL_OVERRIDE_KEY)
  } catch {
    return null
  }
}

/** API root. In development it can be overridden at runtime from the API status badge. */
export function getApiBaseUrl(): string {
  return normalizeApiBaseUrl(readOverride() || import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL)
}

export function setApiBaseUrlOverride(url: string | null): void {
  try {
    if (url?.trim()) {
      localStorage.setItem(API_URL_OVERRIDE_KEY, url.trim())
    } else {
      localStorage.removeItem(API_URL_OVERRIDE_KEY)
    }
  } catch {
    // Storage unavailable (private mode); the env value keeps being used.
  }
}

const mockAllServices = import.meta.env.VITE_USE_MOCK_DATA === 'true'
const mockedServices = new Set(
  (import.meta.env.VITE_MOCK_SERVICES ?? 'staff,parking,reports')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)

/**
 * Whether a service is served from in-browser mock data instead of the REST API.
 * Demo sessions (started without a backend) always use mocks.
 */
export function isMockService(key: ServiceKey): boolean {
  return mockAllServices || mockedServices.has(key) || session.isDemo()
}
