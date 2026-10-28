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

export type PaymentProvider = 'VNPay' | 'MoMo' | 'Wallet'
export type PaymentStatus = 'Pending' | 'Succeeded' | 'Failed' | 'Expired' | 'RefundPending' | 'Refunded'
export type PaymentPurpose = 'Deposit' | 'ParkingFee' | 'Refund' | 'WalletTopUp'

export interface WalletTransactionDTO {
  id: string
  title: string
  subtitle: string
  amount: number
  balanceBefore?: number
  balanceAfter?: number
  status: string
  type: 'deposit' | 'withdraw' | 'refund' | 'payment'
  method: string
  createdAt: string
}

export interface WalletDTO {
  balance: number
  holdAmount: number
  currency: string
  status: string
  /** Most the customer can top up online per calendar day. */
  dailyTopUpLimit: number
  /** What is left of today's limit (paid and still-payable top-ups count). */
  topUpRemainingToday: number
  /** Smallest online top-up accepted. */
  minTopUp: number
  recentTransactions: WalletTransactionDTO[]
}

export interface TopUpWalletRequest {
  amount: number
  provider?: PaymentProvider
  returnUrl?: string
}

export interface WithdrawWalletRequest {
  amount: number
  method?: 'bank' | 'momo'
  bankName?: string
  bankAccount?: string
}

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
  /** false for a booking made without a deposit. */
  hasDeposit: boolean
  /** Minutes the slot is held after the arrival time (30 with a deposit, 15 without). */
  holdMinutes: number
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
  parkingLotAddress?: string | null
  parkingLotDistrict?: string | null
  /** Brand and model of the booked vehicle, e.g. "Toyota Camry". */
  vehicleLabel?: string | null
  bookingMode: BookingMode
  /** Planned departure of a Scheduled booking (null for pay-as-you-go). */
  departureTime: string | null
  /** The bay is locked (Reserved) for this booking now; bookings further ahead lock it shortly before arrival. */
  isSlotHeld: boolean
}

/** Scheduled: arrival and departure picked. PayAsYouGo: arrival picked, leave whenever. Both pay the real time. */
export type BookingMode = 'Scheduled' | 'PayAsYouGo'

/** Lot and slot ids are the frontend's string ids; the service sends them as numbers. */
export interface CreateReservationRequest {
  parkingLotId: string
  slotId: string
  vehicleId: string
  /** ISO time with offset; in the future, at most 30 days ahead. */
  arrivalTime: string
  bookingMode: BookingMode
  /** ISO time; required for Scheduled, ignored for pay-as-you-go. */
  departureTime?: string | null
  /**
   * true (default): pay a deposit, the slot is held 30 minutes after arrival.
   * false: no deposit, confirmed at once, the slot is held only 15 minutes after arrival.
   */
  payDeposit?: boolean
}

export interface UpdateReservationRequest {
  arrivalTime?: string
  slotId?: string
  bookingMode?: BookingMode
  departureTime?: string | null
}

/** CurrentTariffModel: the price list the running fee follows. */
export interface CurrentTariffDTO {
  graceMinutes: number
  /** 60 = per started hour. */
  blockMinutes: number
  blockPrice: number
  maxDailyFee: number | null
}

/**
 * ExitPassModel: every parked vehicle has one from check-in on. The exit lane scans `token` to find the
 * session and charges `amountDue`; after a prepayment it opens the barrier until `validUntil`.
 */
export interface ExitPassDTO {
  sessionId: number
  sessionCode: string
  token: string
  prepaid: boolean
  validUntil: string | null
  amountDue: number
}

/** CurrentSessionModel: a vehicle of the customer inside a lot right now (GET /parking-sessions/current). */
export interface CurrentSessionDTO {
  session: ParkingSessionDTO
  lotName: string | null
  lotAddress: string | null
  lotDistrict: string | null
  entryGateName: string | null
  /** How the entry was identified. */
  entryMethod: 'Plate' | 'Reservation' | 'Manual'
  vehicleLabel: string | null
  bookingMode: BookingMode | null
  plannedDeparture: string | null
  elapsedMinutes: number
  feeSoFar: number
  depositApplied: number
  alreadyPaid: number
  amountDue: number
  tariff: CurrentTariffDTO
  pendingPayment: PaymentDTO | null
  exitPass: ExitPassDTO
}

/** ReservationQrModel */
export interface ReservationQrDTO {
  reservationId: number
  code: string
  qrPayload: string
  validFrom: string
  validUntil: string
}

/** GateReservationLookupModel: what the entry lane shows once a reservation QR or code is entered. */
export interface GateReservationLookupDTO {
  reservation: ReservationDTO
  vehicleTypeId: number
  vehicleTypeName: string | null
  vehicleBrand: string | null
  vehicleModel: string | null
  vehicleColor: string | null
  customerName: string | null
  /** Confirmed, inside the check-in window and the vehicle is not parked anywhere. */
  canCheckIn: boolean
  /** Why it cannot check in right now (null when it can). */
  problem: string | null
  openSessionCode: string | null
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
  noPlateReason?: string | null
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
  /** Required with `noPlate`: why the plate is unreadable or missing. */
  noPlateReason?: string
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

/** LostTicketModel: POST /staff/sessions/{id}/lost-ticket, answered with the session (SessionResponseModel). */
export interface LostTicketRequest {
  /** Required by the backend. */
  reason: string
  /** Photos, papers and ID match and the standard fine applies: no Manager approval needed. */
  conditionsMet: boolean
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
  /** Active, or Maintenance (also while the lot has no Manager and Staff on duty). */
  status?: string
  /** False while the lot is under maintenance: customers can look at it but not book it. */
  isBookable?: boolean
  /** Why it cannot be booked, in plain words. */
  maintenanceNotice?: string | null
}
