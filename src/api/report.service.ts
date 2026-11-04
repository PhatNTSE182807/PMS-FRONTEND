import { isMockService, SERVICE_PATHS } from '@/config/env'
import { revenueMock } from '@/mocks/revenue.mock'
import type {
  AdminRevenueQuery,
  AdminRevenueReportDTO,
  AdminRevenueTimeSeriesDTO,
  ManagerRevenueReportDTO,
  RevenueReportQuery,
} from '@/types/report.dto'
import { http } from './axiosClient'

const mocked = () => isMockService('reports')

/** ALL is the default on the backend, so it is not sent. */
const adminParams = ({ vehicleType, ...query }: AdminRevenueQuery) =>
  vehicleType && vehicleType !== 'ALL' ? { ...query, vehicleType } : query

/** Report service: read-only revenue of settled parking sessions (RevenueReportService). */
export const reportService = {
  /** GET /admin/reports/revenue: revenue, sessions, lots, payment methods and vehicle types of every lot (or one) in a date range. */
  getAdminRevenue(query: AdminRevenueQuery): Promise<AdminRevenueReportDTO> {
    return mocked()
      ? revenueMock.getAdminRevenue(query)
      : http.get<AdminRevenueReportDTO>(`${SERVICE_PATHS.reports}/revenue`, { params: adminParams(query) })
  },

  /** GET /admin/reports/revenue/timeseries: the same revenue per day, week, month or year, split by vehicle type and lot. */
  getAdminRevenueTimeSeries(query: AdminRevenueQuery): Promise<AdminRevenueTimeSeriesDTO> {
    return mocked()
      ? revenueMock.getAdminRevenueTimeSeries(query)
      : http.get<AdminRevenueTimeSeriesDTO>(`${SERVICE_PATHS.reports}/revenue/timeseries`, { params: adminParams(query) })
  },

  /** Real revenue of the signed-in Manager's lots (cash, QR and wallet), never demo data. */
  getManagerRevenue(query: RevenueReportQuery): Promise<ManagerRevenueReportDTO> {
    return http.get<ManagerRevenueReportDTO>('/manager/reports/revenue', { params: query })
  },

  /** GET /manager/reports/revenue/all-time: everything the lot (or every managed lot) earned since its first session. */
  getManagerAllTimeRevenue(parkingLotId?: string): Promise<ManagerRevenueReportDTO> {
    return http.get<ManagerRevenueReportDTO>('/manager/reports/revenue/all-time', { params: parkingLotId ? { parkingLotId } : undefined })
  },
}
