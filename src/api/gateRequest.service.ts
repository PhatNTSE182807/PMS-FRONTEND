import { isMockService, SERVICE_PATHS } from '@/config/env'
import { gateRequestMock } from '@/mocks/operations.mock'
import type { ApproveGateRequestRequest, GateRequestDecisionDTO, GateRequestDTO, GateRequestKind } from '@/types/gateRequest.dto'
import { http } from './axiosClient'

// Customer calls live next to reservations; Staff calls next to the other lane endpoints and always
// use the real API (the check-in / check-out flow has no demo mode)
const customerMocked = () => isMockService('booking')
const staffBase = SERVICE_PATHS.gate

/**
 * "Check in" / "Check out" from the customer app (GateRequestsController). A request waits in the
 * lot's queue until a Staff member opens the barrier or refuses it.
 */
export const gateRequestService = {
  /** Arrived on a confirmed booking (inside its check-in window). */
  requestCheckIn(reservationId: number): Promise<GateRequestDTO> {
    return customerMocked()
      ? gateRequestMock.requestCheckIn(reservationId)
      : http.post<GateRequestDTO>(`${SERVICE_PATHS.booking}/reservations/${reservationId}/check-in-request`)
  },

  /** Wants to drive out a vehicle parked on the account. */
  requestCheckOut(sessionId: number): Promise<GateRequestDTO> {
    return customerMocked()
      ? gateRequestMock.requestCheckOut(sessionId)
      : http.post<GateRequestDTO>(`${SERVICE_PATHS.booking}/parking-sessions/${sessionId}/check-out-request`)
  },

  /** The customer's requests of the last 12 hours, newest first. */
  getMine(): Promise<GateRequestDTO[]> {
    return customerMocked() ? gateRequestMock.mine() : http.get<GateRequestDTO[]>(`${SERVICE_PATHS.booking}/gate-requests/mine`)
  },

  cancel(requestId: number): Promise<GateRequestDTO> {
    return customerMocked()
      ? gateRequestMock.cancel(requestId)
      : http.post<GateRequestDTO>(`${SERVICE_PATHS.booking}/gate-requests/${requestId}/cancel`)
  },

  /** Waiting requests of the Staff's lot, oldest first. */
  getQueue(lotId: string, kind: GateRequestKind): Promise<GateRequestDTO[]> {
    return http.get<GateRequestDTO[]>(`${staffBase}/lots/${lotId}/gate-requests`, { params: { kind } })
  },

  /** Opens the barrier through the normal gate checks. */
  approve(requestId: number, request: ApproveGateRequestRequest = {}): Promise<GateRequestDecisionDTO> {
    return http.post<GateRequestDecisionDTO>(`${staffBase}/gate-requests/${requestId}/approve`, request)
  },

  /** Force check-out of a walk-in: its fee is taken in cash now and it waits at the exit lane. */
  forceCheckOut(sessionId: number): Promise<GateRequestDTO> {
    return http.post<GateRequestDTO>(`${staffBase}/sessions/${sessionId}/force-check-out`)
  },

  /** Refuses with a reason the customer sees. */
  refuse(requestId: number, reason: string): Promise<GateRequestDTO> {
    return http.post<GateRequestDTO>(`${staffBase}/gate-requests/${requestId}/refuse`, { reason })
  },
}
