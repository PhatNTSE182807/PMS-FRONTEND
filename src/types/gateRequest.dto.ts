/* Mirrors PMS.Application.Models.Operations.GateRequestModels (GateRequestsController). */
import type { CheckInResultDTO, CheckoutResultDTO, GateAlertDTO } from './operations.dto'

/** CheckIn: arriving on a booking. CheckOut: leaving with a parked vehicle. */
export type GateRequestKind = 'CheckIn' | 'CheckOut'

/** Waiting in the lot's queue, then Completed (barrier opened), Refused (by Staff) or Cancelled. */
export type GateRequestStatus = 'Waiting' | 'Completed' | 'Refused' | 'Cancelled'

/** A check-in or check-out pressed in the customer app, with what the Staff need to decide at the lane. */
export interface GateRequestDTO {
  id: number
  kind: GateRequestKind
  status: GateRequestStatus
  parkingLotId: number
  lotName: string | null
  plateNumber: string | null
  /** Brand and model, e.g. "Toyota Camry". */
  vehicleLabel: string | null
  vehicleColor: string | null
  vehicleTypeId: number | null
  vehicleTypeName: string | null
  customerName: string | null
  customerPhone: string | null
  reservationId: number | null
  reservationCode: string | null
  reservationStatus: string | null
  arrivalTime: string | null
  checkInFrom: string | null
  checkInUntil: string | null
  slotCode: string | null
  sessionId: number | null
  sessionCode: string | null
  sessionStatus: string | null
  entryTime: string | null
  paidAmount: number
  exitWindowEndsAt: string | null
  /** What would stop the barrier opening right now (outside the window, not paid...), or null. */
  problem: string | null
  createdAt: string
  handledAt: string | null
  /** Staff's reason when refused. */
  note: string | null
}

/** Options for "Open barrier"; the gate rules still decide. */
export interface ApproveGateRequestRequest {
  gateId?: number
  /** The Staff checked the plate against the camera. */
  plateConfirmed?: boolean
  allowWhenFull?: boolean
  allowPlateMismatch?: boolean
  overrideReason?: string
}

/** Outcome of "Open barrier": Completed when it opened, still Waiting (with alerts) when blocked. */
export interface GateRequestDecisionDTO {
  request: GateRequestDTO
  barrierOpen: boolean
  checkIn: CheckInResultDTO | null
  checkOut: CheckoutResultDTO | null
  alerts: GateAlertDTO[]
}
