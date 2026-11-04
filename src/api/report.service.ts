import { isMockService, SERVICE_PATHS } from '@/config/env'
import { revenueMock } from '@/mocks/revenue.mock'
import type { AdminRevenueReportDTO, ManagerRevenueReportDTO, RevenueReportQuery } from '@/types/report.dto'
import { http } from './axiosClient'

const mocked = () => isMockService('reports')

/** Report service: read-only revenue of settled parking sessions (RevenueReportService). */
export const reportService = {
  /** GET /admin/reports/revenue: revenue, sessions, lots and payment methods of every lot (or one) in a date range. */
  getAdminRevenue(query: RevenueReportQuery): Promise<AdminRevenueReportDTO> {
    return mocked()
      ? revenueMock.getAdminRevenue(query)
      : http.get<AdminRevenueReportDTO>(`${SERVICE_PATHS.reports}/revenue`, { params: query })
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
