/* Mirrors PMS.Application.Models.Operations.CashDrawerModels (StaffGateController /staff/lots/{id}/cash-drawer, ManagerOperationsController /manager/…/cash-closes). */

/** HasDifference only appears on drawers closed with a banknote count, before counting was dropped (2026-11-15). */
export type CashDrawerStatus = 'NotOpened' | 'Open' | 'Closed' | 'HasDifference' | 'Confirmed'

/** CashDrawerModel: one Staff drawer, kept as a single running cash total (banknotes are not counted). */
export interface CashDrawerDTO {
  id: number | null
  parkingLotId: number
  staffUserId: string
  staffName: string | null
  businessDate: string
  closeNo: number
  status: CashDrawerStatus
  openedAt: string | null
  floatTotal: number
  /** Cash fees this Staff recorded while the drawer was open (change given back is not kept). */
  cashCollected: number
  cashPayments: number
  /** Cash in the drawer: float + cash collected + cash the Manager added. Live while open, frozen at the close. */
  cashTotal: number
  /** Only on older drawers closed with a banknote count. */
  countedTotal: number | null
  /** Counted − expected on those older drawers. */
  difference: number | null
  differenceReason: string | null
  closedAt: string | null
  confirmedBy: string | null
  confirmedByName: string | null
  confirmedAt: string | null
  confirmNote: string | null
  /** The standard float (VND) a drawer opened by the system starts with. */
  defaultFloat: number
  /** Cash the Manager approved into this drawer (already in cashTotal). */
  topUpTotal: number
  /** Requests for more cash made for this drawer, newest first. */
  topUps: CashTopUpDTO[]
}

export type CashTopUpStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'

/** CashTopUpModel: an amount of cash a Staff asked the Manager to add to their open drawer. */
export interface CashTopUpDTO {
  id: number
  parkingLotId: number
  drawerId: number
  closeNo: number
  staffUserId: string
  staffName: string | null
  total: number
  reason: string | null
  status: CashTopUpStatus
  createdAt: string
  decidedBy: string | null
  decidedByName: string | null
  decidedAt: string | null
  decisionNote: string | null
  /** The drawer is still open, so the cash can still go into it. */
  drawerOpen: boolean
}
