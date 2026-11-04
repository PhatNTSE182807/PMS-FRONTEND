/*
 * Revenue reports (RevenueReportService in the backend): GET /api/admin/reports/revenue
 * (AdminRevenueController) and GET /api/manager/reports/revenue (ManagerRevenueController).
 * Revenue is the FinalFee (VND) of settled sessions only: Completed ones, dated by exit time, and
 * Paid ones not yet out, dated by payment time. Days are counted in Vietnam time.
 * Refunds, waivers and bill voids are not subtracted.
 */

/** Query of both reports. Send both dates or neither; with neither the report covers today. */
export interface RevenueReportQuery {
  /** yyyy-MM-dd, inclusive */
  startDate: string
  /** yyyy-MM-dd, inclusive */
  endDate: string
  /** One lot; undefined = every lot (Admin) or every lot the Manager runs. */
  parkingLotId?: string
}

/** QR_BANKING = VNPay / MoMo, RFID_WALLET = the in-app wallet; OTHER = any other method or no matching payment. */
export type PaymentMethod = 'QR_BANKING' | 'RFID_WALLET' | 'CASH' | 'OTHER'

/** PaymentMethodBreakdownModel. QR_BANKING, RFID_WALLET and CASH always come, in that order; OTHER only when above 0. */
export interface PaymentMethodBreakdownDTO {
  method: PaymentMethod
  amount: number
  /** Share of the total revenue, 1 decimal; 0 when the total is 0. */
  percentage: number
}

/** ParkingLotRevenueModel */
export interface ParkingLotRevenueDTO {
  parkingLotId: number
  parkingLotName: string
  totalRevenue: number
  /** Settled sessions, 0 VND ones included. */
  totalSessions: number
  managerUserId: string | null
}

/** AdminRevenueReportResponse */
export interface AdminRevenueReportDTO {
  /** Resolved range, yyyy-MM-dd. */
  startDate: string
  endDate: string
  systemTotalRevenue: number
  /** Settled sessions, 0 VND ones included. */
  systemTotalSessions: number
  /** Lots in the report: every lot that is not deleted, whatever its status. */
  activeLotsCount: number
  /** One row per lot, sorted by name; lots without revenue come with 0. */
  byLot: ParkingLotRevenueDTO[]
  paymentMethods: PaymentMethodBreakdownDTO[]
}

/** ManagerRevenueReportResponse: the same report, limited to the signed-in Manager's lots. */
export interface ManagerRevenueReportDTO {
  managerUserId: string
  startDate: string
  endDate: string
  totalRevenue: number
  totalSessions: number
  byLot: ParkingLotRevenueDTO[]
  paymentMethods: PaymentMethodBreakdownDTO[]
}
