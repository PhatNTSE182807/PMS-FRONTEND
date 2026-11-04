import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/api/queryKeys'
import { reportService } from '@/api/report.service'
import type { AdminRevenueQuery, RevenueReportQuery } from '@/types/report.dto'

/** Revenue of every lot, or of one lot, for a date range (GET /admin/reports/revenue). */
export function useAdminRevenue(query: AdminRevenueQuery) {
  return useQuery({ queryKey: queryKeys.reports.admin(query), queryFn: () => reportService.getAdminRevenue(query) })
}

/** The range per day, week, month or year, split by vehicle type and lot (GET /admin/reports/revenue/timeseries). */
export function useAdminRevenueTimeSeries(query: AdminRevenueQuery) {
  return useQuery({ queryKey: queryKeys.reports.adminTimeSeries(query), queryFn: () => reportService.getAdminRevenueTimeSeries(query) })
}

/** How often the Manager's revenue refreshes, so cash taken at the counter shows up quickly. */
export const MANAGER_REVENUE_REFRESH_MS = 10_000

/** Everything the lot earned since its first parking session; refreshed like the daily figures. */
export function useManagerAllTimeRevenue(parkingLotId?: string) {
  return useQuery({
    queryKey: queryKeys.reports.managerAllTime(parkingLotId),
    queryFn: () => reportService.getManagerAllTimeRevenue(parkingLotId),
    refetchInterval: MANAGER_REVENUE_REFRESH_MS,
  })
}

/** Real revenue of the Manager's lots for a date range (one lot when parkingLotId is set). */
export function useManagerRevenue(query: RevenueReportQuery) {
  return useQuery({
    queryKey: queryKeys.reports.manager(query),
    queryFn: () => reportService.getManagerRevenue(query),
    refetchInterval: MANAGER_REVENUE_REFRESH_MS,
  })
}
