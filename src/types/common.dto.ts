/**
 * Envelope returned by the PMS.API monolith today
 * (PMS.Application.Models.ApiResult<T>, also used by the validation filter and
 * the exception middleware).
 */
export interface ApiResult<T> {
  succeeded: boolean
  result: T
  errors: string[]
}

/** Error detail of the Result pattern the microservices will standardize on. */
export interface ApiErrorDetail {
  code: string
  description: string
}

/** Target envelope from the admin dashboard spec. The HTTP client accepts both shapes. */
export interface ApiResponse<T> {
  isSuccess: boolean
  data: T
  message?: string
  errors?: ApiErrorDetail[]
}

export interface PaginatedResponse<T> {
  items: T[]
  pageNumber: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export interface PageQuery {
  pageNumber: number
  pageSize: number
}

/** Lightweight reference to an entity owned by another service. */
export interface EntityRef {
  id: string
  name: string
}
