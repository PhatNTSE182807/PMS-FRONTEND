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
 * (GET /staff/lots/{lotId}/sessions?status=LostTicketPending).
 */
export interface LostTicketApprovalDTO extends ParkingSessionDTO {
  /**
   * Id of the account that raised the request. The API does not send it yet; once it does, the
   * Manager cannot approve a request they created themselves (maker-checker).
   */
  createdBy?: string | null
}
