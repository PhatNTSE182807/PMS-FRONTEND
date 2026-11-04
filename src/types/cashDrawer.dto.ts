/* Mirrors PMS.Application.Models.Operations.CashDrawerModels (StaffGateController /staff/lots/{id}/cash-drawer, ManagerOperationsController /manager/…/cash-closes). */

/** Banknote value (VND) → how many notes, e.g. { 50000: 2, 10000: 1 }. */
export type BanknoteCounts = Record<number, number>

export type CashDrawerStatus = 'NotOpened' | 'Open' | 'Closed' | 'HasDifference' | 'Confirmed'

/** CashDrawerModel: one Staff drawer of a business day. */
export interface CashDrawerDTO {
  id: number | null
  parkingLotId: number
  staffUserId: string
  staffName: string | null
  businessDate: string
  closeNo: number
  status: CashDrawerStatus
  openedAt: string | null
  /** Deadline to close: 23:00 of the business day, or sooner in a simulated day end. */
  closeDueAt: string | null
  /** Still open after its deadline; the Manager was told. */
  isOverdue: boolean
  /** Closed after its deadline. */
  closedLate: boolean
  float: BanknoteCounts
  floatTotal: number
  /** Cash fees this Staff recorded while the drawer was open. */
  cashCollected: number
  cashPayments: number
  /** Float + notes received − change given (payments entered note by note). */
  expectedNotes: BanknoteCounts
  /** Float + cash collected + cash the Manager added. */
  expectedTotal: number
  /** Cash entered as an amount only: in the total, not in expectedNotes. */
  untrackedCash: number
  counted: BanknoteCounts | null
  countedTotal: number | null
  /** Counted − expected; negative when cash is missing. */
  difference: number | null
  differenceReason: string | null
  closedAt: string | null
  confirmedBy: string | null
  confirmedByName: string | null
  confirmedAt: string | null
  confirmNote: string | null
  /** A bigger difference needs a reason and a Manager's confirmation. */
  differenceThreshold: number
  /** Banknote values, largest first. */
  denominations: number[]
  /** Cash the Manager approved into this drawer (already in expectedTotal and expectedNotes). */
  topUpTotal: number
  /** Requests for more banknotes made for this drawer, newest first. */
  topUps: CashTopUpDTO[]
}

export type CashTopUpStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'

/** CashTopUpModel: banknotes a Staff asked the Manager to add to their open drawer. */
export interface CashTopUpDTO {
  id: number
  parkingLotId: number
  drawerId: number
  closeNo: number
  staffUserId: string
  staffName: string | null
  notes: BanknoteCounts
  total: number
  reason: string | null
  status: CashTopUpStatus
  createdAt: string
  decidedBy: string | null
  decidedByName: string | null
  decidedAt: string | null
  decisionNote: string | null
  /** The drawer is still open, so the notes can still go into it. */
  drawerOpen: boolean
}
