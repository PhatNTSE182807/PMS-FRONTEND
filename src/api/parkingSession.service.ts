import { isMockService, SERVICE_PATHS } from '@/config/env'
import { customerSessionMock } from '@/mocks/operations.mock'
import type { CurrentSessionDTO, ExitPassDTO, PaymentDTO, PaymentProvider } from '@/types/operations.dto'
import { http } from './axiosClient'
import { paymentReturnUrl } from './reservation.service'

const base = `${SERVICE_PATHS.booking}/parking-sessions`
// ParkingSessionsController lives next to reservations and payments
const mocked = () => isMockService('booking')

/** The customer's parked vehicles: running fee, prepaying with VNPay / MoMo and the exit pass (FR-PAY-07). */
export const parkingSessionService = {
  /** Vehicles inside a lot now, newest entry first (empty when nothing is parked). */
  getCurrent(): Promise<CurrentSessionDTO[]> {
    return mocked() ? customerSessionMock.current() : http.get<CurrentSessionDTO[]>(`${base}/current`)
  },

  /** The exit pass of a parked vehicle (every checked-in session has one). */
  getExitPass(sessionId: number): Promise<ExitPassDTO> {
    return mocked() ? customerSessionMock.exitPass(sessionId) : http.get<ExitPassDTO>(`${base}/${sessionId}/exit-pass`)
  },

  /** Starts a prepayment of the fee so far; redirect the browser to `payUrl`. Once paid an Exit Window opens. */
  prepay(sessionId: number, provider: PaymentProvider): Promise<PaymentDTO> {
    if (mocked()) return customerSessionMock.prepay(sessionId, provider)
    return http.post<PaymentDTO>(`${base}/${sessionId}/payments`, { provider, returnUrl: paymentReturnUrl() })
  },
}
