/*
 * Reservations, gate sessions and payments: PMS.API ReservationsController, StaffGateController,
 * ParkingSessionsController and PaymentsController (PMS.Application.Models.Operations).
 * Times are ISO strings in UTC; money is VND.
 */

/** SRS 4.3.3 */
export type ReservationStatus =
  | 'PendingDeposit'
  | 'Confirmed'
  | 'CheckedIn'
  | 'Completed'
  | 'Cancelled'
  | 'LotCancelled'
  | 'Expired'
  | 'NoShow'

/** SRS 4.3.2 plus the pre-entry states (waiting for the loop sensor, turned around). */
export type SessionStatus =
  | 'PendingEntry'
  | 'Active'
  | 'LostTicketPending'
  | 'PendingPayment'
  | 'Paid'
  | 'Completed'
  | 'AbnormalClosed'
  | 'EmergencyExit'
  | 'Cancelled'

export type PaymentProvider = 'VNPay' | 'MoMo'
export type PaymentStatus = 'Pending' | 'Succeeded' | 'Failed' | 'Expired' | 'RefundPending' | 'Refunded'
export type PaymentPurpose = 'Deposit' | 'ParkingFee' | 'Refund'

/** PaymentResponseModel */
export interface PaymentDTO {
  id: number
  code: string
  provider: PaymentProvider | null
  method: 'Cash' | 'Online'
  purpose: PaymentPurpose
  channel: 'App' | 'Kiosk' | 'Lane' | null
  amount: number
  status: PaymentStatus
  /** Hosted gateway page: redirect the browser there, or show it as a QR at the lane. */
  payUrl: string | null
  expiresAt: string | null
  createdAt: string
  paidAt: string | null
  reservationId: number | null
  sessionId: number | null
  refundedAmount: number
  refundOfPaymentId: number | null
  message: string | null
  /** Signed Exit Pass after an app/kiosk prepayment (FR-PAY-07). */
  exitPass: string | null
  exitWindowEndsAt: string | null
  /** BR-11: the Staff may switch method after this when no callback came. */
  callbackDeadline: string | null
}

/** "Applied" | "AlreadyProcessed" | "Failed" | "Pending" | "Expired" | "NotFound" | "InvalidAmount" | "InvalidSignature" | "Refunded" */
export type PaymentOutcome = string

/** PaymentCallbackResultModel */
export interface PaymentCallbackResultDTO {
  signatureValid: boolean
  outcome: PaymentOutcome
  message: string | null
  payment: PaymentDTO | null
}

/** ReservationResponseModel */
export interface ReservationDTO {
  id: number
  code: string
  status: ReservationStatus
  parkingLotId: number
  parkingLotName: string | null
  zoneId: number | null
  zoneName: string | null
  slotId: number | null
  slotCode: string | null
  vehicleId: string
  plateNumber: string | null
  arrivalTime: string
  /** BR-02 check-in window. */
  checkInFrom: string
  checkInUntil: string
  depositAmount: number
  depositDueAt: string | null
  refundAmount: number
  cancelReason: string | null
  cancelledBy: string | null
  createdAt: string
  confirmedAt: string | null
  canChange: boolean
  canCancel: boolean
  /** BR-04: what cancelling now would refund. */
  refundIfCancelledNow: number
  pendingPayment: PaymentDTO | null
}

/** Lot and slot ids are the frontend's string ids; the service sends them as numbers. */
export interface CreateReservationRequest {
  parkingLotId: string
  slotId: string
  vehicleId: string
  /** ISO time with offset. */
  arrivalTime: string
}

export interface UpdateReservationRequest {
  arrivalTime?: string
  slotId?: string
}

/** ReservationQrModel */
export interface ReservationQrDTO {
  reservationId: number
  code: string
  qrPayload: string
  validFrom: string
  validUntil: string
}

/** GateAlertModel */
export interface GateAlertDTO {
  code: string
  message: string
  blocking: boolean
  canOverride: boolean
  relatedSessionId: number | null
}

/** SessionResponseModel */
export interface ParkingSessionDTO {
  id: number
  code: string
  parkingLotId: number
  status: SessionStatus
  sessionType: 'WalkIn' | 'Reservation' | 'Whitelist' | null
  plateNumber: string
  hasPlate: boolean
  vehicleTypeId: number | null
  vehicleTypeName: string | null
  entryTime: string
  entryConfirmedAt: string | null
  entryGateId: number
  zoneId: number | null
  zoneName: string | null
  slotId: number | null
  slotCode: string | null
  reservationId: number | null
  reservationCode: string | null
  isCustomerAccount: boolean
  paidAmount: number
  finalFee: number
  exitWindowEndsAt: string | null
  exitTime: string | null
  isManualEntry: boolean
  isLostTicket: boolean
  plateMismatch: boolean
  isOverdue: boolean
  zeroFeeReason: string | null
  overrideNote: string | null
}

/** CheckInModel */
export interface CheckInRequest {
  gateId?: number
  plateNumber?: string
  noPlate?: boolean
  vehicleTypeId?: number
  /** 0..1 */
  anprConfidence?: number
  plateConfirmed?: boolean
  reservationQr?: string
  reservationCode?: string
  ignoreReservation?: boolean
  slotId?: number
  isManual?: boolean
  manualReason?: string
  allowBlacklisted?: boolean
  allowWhenFull?: boolean
  allowPlateMismatch?: boolean
  overrideReason?: string
}

/** CheckInResultModel */
export interface CheckInResultDTO {
  outcome: 'Created' | 'Blocked'
  barrierOpen: boolean
  alerts: GateAlertDTO[]
  session: ParkingSessionDTO | null
  /** Signed QR ticket for a Guest. */
  ticket: string | null
}

/** CheckoutQuoteModel */
export interface CheckoutQuoteDTO {
  session: ParkingSessionDTO
  durationMinutes: number
  fee: number
  lostTicketFee: number
  exitWindowLateFee: number
  depositApplied: number
  alreadyPaid: number
  amountDue: number
  depositRefund: number
  zeroFeeReason: string | null
  canOpenBarrier: boolean
  alerts: GateAlertDTO[]
  days: { date: string; minutes: number; blocks: number; amount: number; capped: boolean }[]
  pricingRuleId: number | null
  pricingRuleVersion: number | null
}

/** CheckoutModel */
export interface CheckoutRequest {
  gateId?: number
  plateNumber?: string
  photoChecked?: boolean
  allowPlateMismatch?: boolean
  overrideReason?: string
  isManual?: boolean
  manualReason?: string
}

/** CheckoutResultModel */
export interface CheckoutResultDTO {
  session: ParkingSessionDTO
  barrierOpen: boolean
  depositRefund: number
  alerts: GateAlertDTO[]
}

/** GateResponseModel */
export interface GateDTO {
  id: number
  code: string
  name: string
  direction: 'In' | 'Out' | 'Both'
}

/** ZoneCounterModel */
export interface ZoneCounterDTO {
  zoneId: number
  zoneCode: string
  zoneName: string
  vehicleTypeId: number | null
  totalCapacity: number
  occupiedSpaces: number
  availableSpaces: number
  isFull: boolean
}

/** PublicParkingLotResponseModel (only the fields the booking map needs). */
export interface BookableLotDTO {
  id: number
  code: string
  name: string
  address: string
  layoutTemplate: string | null
}
