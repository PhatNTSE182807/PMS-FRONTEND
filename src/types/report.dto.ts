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

/** Cars (4 and 7 seats) or motorbikes; ALL keeps both. */
export type ReportVehicleType = 'ALL' | 'CAR' | 'MOTORBIKE'

/** The Admin report also filters by vehicle family (GET /admin/reports/revenue and /timeseries). */
export interface AdminRevenueQuery extends RevenueReportQuery {
  vehicleType?: ReportVehicleType
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
  /** Fees collected minus `compensation`. */
  totalRevenue: number
  /** Compensations the lot paid customers whose booked bay a walk-in took. */
  compensation?: number
  /** Settled sessions, 0 VND ones included. */
  totalSessions: number
  managerUserId: string | null
}

/** AdminRevenueReportResponse */
export interface AdminRevenueReportDTO {
  /** Resolved range, yyyy-MM-dd. */
  startDate: string
  endDate: string
  /** Net of `systemTotalCompensation`. */
  systemTotalRevenue: number
  /** Booked bay compensations paid in the period, already subtracted from the revenue. */
  systemTotalCompensation?: number
  /** Settled sessions, 0 VND ones included. */
  systemTotalSessions: number
  /** Lots in the report: every lot that is not deleted, whatever its status. */
  activeLotsCount: number
  /** One row per lot, sorted by name; lots without revenue come with 0. */
  byLot: ParkingLotRevenueDTO[]
  paymentMethods: PaymentMethodBreakdownDTO[]
  /** CAR and MOTORBIKE always; OTHER (no vehicle type recorded) only when above 0. */
  byVehicleType: VehicleKindRevenueDTO[]
}

/** VehicleKindRevenueModel */
export interface VehicleKindRevenueDTO {
  vehicleType: 'CAR' | 'MOTORBIKE' | 'OTHER'
  totalRevenue: number
  totalSessions: number
}

export type RevenueGranularityDTO = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'

/** AdminRevenueTimeSeriesResponse (GET /admin/reports/revenue/timeseries). */
export interface AdminRevenueTimeSeriesDTO {
  startDate: string
  endDate: string
  granularity: RevenueGranularityDTO
  /** Every period of the range, oldest first, empty ones included; the first and last are clipped to the range. */
  points: RevenueTimeSeriesPointDTO[]
}

/** RevenueTimeSeriesPointModel */
export interface RevenueTimeSeriesPointDTO {
  /** First and last day of the period, yyyy-MM-dd, inclusive. */
  startDate: string
  endDate: string
  /** Net of `compensation` (car and motorbike revenue are net of their own compensations). */
  totalRevenue: number
  compensation?: number
  totalSessions: number
  carRevenue: number
  carSessions: number
  motorbikeRevenue: number
  motorbikeSessions: number
  /** Lots with at least one settled session in the period, sorted by name. */
  byLot: RevenueTimeSeriesLotDTO[]
}

/** RevenueTimeSeriesLotModel */
export interface RevenueTimeSeriesLotDTO {
  parkingLotId: number
  parkingLotName: string
  totalRevenue: number
  compensation?: number
  totalSessions: number
  carSessions: number
  motorbikeSessions: number
}

/** ManagerRevenueReportResponse: the same report, limited to the signed-in Manager's lots. */
export interface ManagerRevenueReportDTO {
  managerUserId: string
  startDate: string
  endDate: string
  /** Net of `totalCompensation`. */
  totalRevenue: number
  /** Booked bay compensations paid in the period, already subtracted from the revenue. */
  totalCompensation?: number
  totalSessions: number
  byLot: ParkingLotRevenueDTO[]
  paymentMethods: PaymentMethodBreakdownDTO[]
}
