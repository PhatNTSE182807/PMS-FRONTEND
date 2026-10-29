import type { ParkingSessionDTO } from './operations.dto'

/** The Manager's answer to a request. */
export type ApprovalDecision = 'APPROVED' | 'REJECTED'

/** SessionDecisionModel: body of POST /manager/sessions/{id}/lost-ticket/approve and /reject. */
export interface SessionDecisionRequest {
  /** Remarks of an approval, or the rejection reason. Kept in the session log. */
  reason: string
}

/**
 * A lost-ticket report waiting for the Manager: a session in `LostTicketPending`
 * (GET /staff/lots/{lotId}/sessions?status=LostTicketPending). `lostTicketReportedBy` is the account
 * that raised it: that account cannot approve or reject it (maker-checker, also enforced by the API).
 */
export type LostTicketApprovalDTO = ParkingSessionDTO
