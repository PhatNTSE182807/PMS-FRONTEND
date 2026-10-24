import { isMockService, SERVICE_PATHS } from '@/config/env'
import { paymentMock } from '@/mocks/operations.mock'
import type { PaymentCallbackResultDTO, PaymentDTO } from '@/types/operations.dto'
import { http } from './axiosClient'

const base = `${SERVICE_PATHS.booking}/payments`
const mocked = () => isMockService('booking')

/** VNPay / MoMo results and payment status (PaymentsController). */
export const paymentService = {
  /**
   * Hands the query string the gateway sent the browser back with to the API, which checks the
   * signature and applies the result (idempotent with the gateway's IPN).
   */
  handleReturn(provider: 'vnpay' | 'momo', params: Record<string, string>): Promise<PaymentCallbackResultDTO> {
    // Demo payments (?demo=1) never reached a real gateway
    if (mocked() || params.demo === '1') return paymentMock.handleReturn(provider, params)
    return http.get<PaymentCallbackResultDTO>(`${base}/${provider}/return`, { params })
  },

  get(id: number): Promise<PaymentDTO> {
    return mocked() ? paymentMock.get(id) : http.get<PaymentDTO>(`${base}/${id}`)
  },

  /**
   * Whether the server allows simulated payments (development / testing only). Demo mode always does:
   * its "gateway" is simulated anyway.
   */
  simulation(): Promise<{ enabled: boolean }> {
    return mocked() ? Promise.resolve({ enabled: true }) : http.get<{ enabled: boolean }>(`${base}/simulation`)
  },

  /** Development / testing only: completes a pending VNPay / MoMo payment as if the gateway confirmed it. */
  simulateSuccess(id: number): Promise<PaymentCallbackResultDTO> {
    return mocked() ? paymentMock.check(id) : http.post<PaymentCallbackResultDTO>(`${base}/${id}/simulate-success`)
  },

  /** FR-PAY-08: ask the gateway about a payment whose callback did not come. */
  check(id: number): Promise<PaymentCallbackResultDTO> {
    return mocked() ? paymentMock.check(id) : http.post<PaymentCallbackResultDTO>(`${base}/${id}/check`)
  },
}
