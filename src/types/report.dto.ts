/*
 * Report service (/v1/reports). Not implemented by the backend yet: served from
 * mocks/revenue.mock.ts. Source data: ParkingSession, Invoice, Payment, Subscription.
 */
import type { PageQuery } from './common.dto'

export type ReportVehicleType = 'ALL' | 'CAR' | 'MOTORBIKE' | 'BICYCLE'

export interface RevenueFilterQuery {
  /** yyyy-MM-dd, inclusive */
  startDate: string
  /** yyyy-MM-dd, inclusive */
  endDate: string
  /** undefined = all parking lots */
  parkingLotId?: string
  vehicleType?: ReportVehicleType
}

export interface RevenueKpiSummaryDTO {
  totalRevenue: number
  /** Versus the previous period of the same length. */
  revenueGrowthPercent: number
  totalTransactions: number
  transactionGrowthPercent: number
  walkInRevenue: number
  subscriptionRevenue: number
}

export type TimeSeriesGranularity = 'DAY' | 'MONTH'

export interface RevenueTimeSeriesDTO {
  /** yyyy-MM-dd (start of the day or month) */
  date: string
  carRevenue: number
  motorbikeRevenue: number
  totalRevenue: number
}

export interface RevenueTimeSeriesResultDTO {
  granularity: TimeSeriesGranularity
  points: RevenueTimeSeriesDTO[]
}

export type PaymentMethod = 'CASH' | 'QR_BANKING' | 'RFID_WALLET'

export interface PaymentMethodBreakdownDTO {
  method: PaymentMethod
  amount: number
  percentage: number
}

export interface RevenueByParkingLotDTO {
  parkingLotId: string
  parkingLotName: string
  totalRevenue: number
  totalTransactions: number
}

export interface RevenueBreakdownRowDTO {
  date: string
  parkingLotId: string
  parkingLotName: string
  motorbikeCount: number
  carCount: number
  walkInRevenue: number
  subscriptionRevenue: number
  totalRevenue: number
}

export type RevenueBreakdownQuery = RevenueFilterQuery & PageQuery
