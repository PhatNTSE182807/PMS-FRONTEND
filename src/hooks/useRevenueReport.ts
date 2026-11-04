import { useQueries, useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/api/queryKeys'
import { reportService } from '@/api/report.service'
import { granularityFor, splitRange, type DateRange, type RevenueGranularity } from '@/lib/revenuePeriods'
import type { AdminRevenueReportDTO, RevenueReportQuery } from '@/types/report.dto'

/** Revenue of every lot, or of one lot, for a date range (GET /admin/reports/revenue). */
export function useAdminRevenue(query: RevenueReportQuery) {
  return useQuery({ queryKey: queryKeys.reports.admin(query), queryFn: () => reportService.getAdminRevenue(query) })
}

/** One report per day, week, month or year of the range: the points of the trend chart and the rows of the table. */
export interface RevenuePeriodReport extends DateRange {
  report: AdminRevenueReportDTO
}

export interface AdminRevenuePeriods {
  granularity: RevenueGranularity
  /** Oldest first; undefined until every period has loaded. */
  periods?: RevenuePeriodReport[]
  isPending: boolean
  error: Error | null
  refetch: () => void
}

/**
 * The range cut into days, weeks, months or years (whichever keeps it near a month of points), one
 * report request per period: the backend has no time series yet. Each period is cached on its own,
 * so a one-day range reuses the main report and switching filters back does not ask again.
 */
export function useAdminRevenuePeriods(query: RevenueReportQuery): AdminRevenuePeriods {
  const granularity = granularityFor(query)
  const ranges = splitRange(query, granularity)

  return useQueries({
    queries: ranges.map((range) => {
      const periodQuery: RevenueReportQuery = { ...range, parkingLotId: query.parkingLotId }
      return { queryKey: queryKeys.reports.admin(periodQuery), queryFn: () => reportService.getAdminRevenue(periodQuery) }
    }),
    combine: (results) => {
      const periods: RevenuePeriodReport[] = []
      for (const [i, result] of results.entries()) {
        if (result.data) periods.push({ ...ranges[i], report: result.data })
      }
      return {
        granularity,
        periods: periods.length === ranges.length ? periods : undefined,
        isPending: results.some((result) => result.isPending),
        error: results.find((result) => result.isError)?.error ?? null,
        refetch: () => results.forEach((result) => result.isError && void result.refetch()),
      }
    },
  })
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
