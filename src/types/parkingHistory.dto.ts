/* Mirrors PMS.Application.Models.Operations.ParkingHistory* (ParkingSessionsController /parking-sessions/history, /{id}/receipt). */

/** Completed: left through the exit lane. EmergencyExit / AbnormalClosed: closed outside the normal flow. */
export type FinishedSessionStatus = 'Completed' | 'EmergencyExit' | 'AbnormalClosed'

export interface ParkingHistoryQuery {
  /** 1-based. */
  page?: number
  /** 1..50, default 10. */
  pageSize?: number
  /** Exit time on or after (ISO, UTC). */
  from?: string
  /** Exit time before (ISO, UTC). */
  to?: string
  vehicleId?: string
}

/** One finished session in the history table. */
export interface ParkingHistoryItemDTO {
  sessionId: number
  sessionCode: string
  status: FinishedSessionStatus
  /** WalkIn, Reservation or Whitelist. */
  sessionType?: string | null
  entryTime: string
  exitTime?: string | null
  durationMinutes: number
  parkingLotId: number
  lotName?: string | null
  lotDistrict?: string | null
  lotAddress?: string | null
  zoneName?: string | null
  slotCode?: string | null
  vehicleId?: string | null
  plateNumber?: string | null
  vehicleTypeName?: string | null
  reservationCode?: string | null
  /** Parking fee after discounts, before the deposit (VND). */
  finalFee: number
  /** Reservation deposit counted towards the fee (VND). */
  depositApplied: number
  /** Paid for the session itself, cash and online (VND). */
  paidAmount: number
  /** Invoice number, or the session code when nothing was invoiced. */
  receiptNumber: string
}

export interface ParkingHistoryPageDTO {
  items: ParkingHistoryItemDTO[]
  page: number
  pageSize: number
  totalCount: number
  /** Fees of every session matching the filter, not only this page (VND). */
  totalSpent: number
}

export interface ParkingReceiptPaymentDTO {
  paymentCode: string
  /** Deposit or ParkingFee. */
  purpose: string
  /** Cash or Online. */
  method: string
  /** VNPay or MoMo for online payments. */
  provider?: string | null
  amount: number
  paidAt?: string | null
}

/** E-receipt of a finished session. */
export interface ParkingReceiptDTO extends ParkingHistoryItemDTO {
  customerName?: string | null
  lotPhone?: string | null
  originalFee: number
  discountAmount: number
  zeroFeeReason?: string | null
  issuedAt: string
  payments: ParkingReceiptPaymentDTO[]
}
