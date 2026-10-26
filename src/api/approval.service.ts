import { SERVICE_PATHS } from '@/config/env'
import type { LostTicketApprovalDTO, SessionDecisionRequest } from '@/types/approval.dto'
import type { ParkingSessionDTO } from '@/types/operations.dto'
import { http } from './axiosClient'

/** Status of a session whose lost-ticket report waits for the Manager. */
const LOST_TICKET_PENDING = 'LostTicketPending'

const lostTicketPath = (sessionId: number) => `${SERVICE_PATHS.team}/sessions/${sessionId}/lost-ticket`

/**
 * Manager sign-offs (ManagerOperationsController). Always the real API: the approval queue has no
 * demo mode. Only lost tickets have an approval flow in the backend so far.
 */
export const approvalService = {
  /** Lost-ticket reports of a lot that still wait for a decision, via the lot's session list. */
  getPendingLostTickets(lotId: string): Promise<LostTicketApprovalDTO[]> {
    return http.get<LostTicketApprovalDTO[]>(`${SERVICE_PATHS.gate}/lots/${lotId}/sessions`, { params: { status: LOST_TICKET_PENDING } })
  },

  /** Lets the lost-ticket session go to payment with the lost ticket fine. */
  approveLostTicket(sessionId: number, request: SessionDecisionRequest): Promise<ParkingSessionDTO> {
    return http.post<ParkingSessionDTO>(`${lostTicketPath(sessionId)}/approve`, request)
  },

  /** The vehicle stays parked; the customer comes back with full papers. */
  rejectLostTicket(sessionId: number, request: SessionDecisionRequest): Promise<ParkingSessionDTO> {
    return http.post<ParkingSessionDTO>(`${lostTicketPath(sessionId)}/reject`, request)
  },
}
