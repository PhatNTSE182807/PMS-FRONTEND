import { useEffect } from 'react'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { parkingOpsRealtime } from '@/api/parkingOpsRealtime'
import { queryKeys } from '@/api/queryKeys'
import { reportService } from '@/api/report.service'
import { invalidateFromPush } from '@/lib/realtimeInvalidate'
import { toIsoDate } from '@/lib/format'
import type { AdminRevenueQuery, RevenueReportQuery } from '@/types/report.dto'

/** Revenue of every lot, or of one lot, for a date range (GET /admin/reports/revenue). */
export function useAdminRevenue(query: AdminRevenueQuery) {
  return useQuery({ queryKey: queryKeys.reports.admin(query), queryFn: () => reportService.getAdminRevenue(query) })
}

/** The range per day, week, month or year, split by vehicle type and lot (GET /admin/reports/revenue/timeseries). */
export function useAdminRevenueTimeSeries(query: AdminRevenueQuery) {
  return useQuery({ queryKey: queryKeys.reports.adminTimeSeries(query), queryFn: () => reportService.getAdminRevenueTimeSeries(query) })
}

/** Polling fallback without SignalR (demo mode, hub down): cash taken at the counter still shows up quickly. */
export const MANAGER_REVENUE_REFRESH_MS = 10_000
/** Safety net while the payment pushes refresh the figures. */
const MANAGER_REVENUE_PUSHED_MS = 5 * 60_000
/** A burst of payments (a busy counter, the Admin simulation) re-reads today's figures at most this often. */
const TODAY_PUSH_WINDOW_MS = 5_000
/** The all-time total is a heavy query over every session of the lot: re-read it at most twice a minute. */
const ALL_TIME_PUSH_WINDOW_MS = 30_000

const reachesToday = (query: RevenueReportQuery) => query.endDate >= toIsoDate(new Date())

/** One push listener per lot, however many revenue hooks are mounted (each used to refetch on the same push). */
const revenueWatchers = new Map<string, { count: number; stop: () => void }>()

function watchRevenue(queryClient: QueryClient, parkingLotId: string): () => void {
  let watcher = revenueWatchers.get(parkingLotId)
  if (!watcher) {
    const stop = parkingOpsRealtime.subscribe((event) => {
      if (event.type !== 'PaymentChanged' && event.type !== 'ConnectionRestored') return
      invalidateFromPush(queryClient, [...queryKeys.reports.all, 'manager'], {
        scope: parkingLotId,
        predicate: (key) => reachesToday(key[2] as RevenueReportQuery),
        windowMs: TODAY_PUSH_WINDOW_MS,
      })
      invalidateFromPush(queryClient, queryKeys.reports.managerAllTime(parkingLotId), { windowMs: ALL_TIME_PUSH_WINDOW_MS })
    }, parkingLotId)
    watcher = { count: 0, stop }
    revenueWatchers.set(parkingLotId, watcher)
  }
  watcher.count += 1
  const current = watcher
  return () => {
    current.count -= 1
    if (current.count > 0) return
    current.stop()
    revenueWatchers.delete(parkingLotId)
  }
}

/**
 * Refreshes the Manager's revenue figures of a lot on its payment pushes, so a payment shows up within seconds
 * without polling. Ranges that ended before today never change and are left alone. Returns whether the hub is live.
 */
function useManagerRevenueRealtime(parkingLotId: string | undefined) {
  const queryClient = useQueryClient()
  const live = parkingOpsRealtime.isAvailable('gate')
  useEffect(() => {
    if (!live || !parkingLotId) return
    return watchRevenue(queryClient, parkingLotId)
  }, [live, parkingLotId, queryClient])
  return live
}

/** Everything the lot earned since its first parking session; refreshed by the lot's payment pushes. */
export function useManagerAllTimeRevenue(parkingLotId?: string) {
  const live = useManagerRevenueRealtime(parkingLotId)
  return useQuery({
    queryKey: queryKeys.reports.managerAllTime(parkingLotId),
    queryFn: () => reportService.getManagerAllTimeRevenue(parkingLotId),
    refetchInterval: live ? MANAGER_REVENUE_PUSHED_MS : MANAGER_REVENUE_REFRESH_MS * 6,
  })
}

/**
 * Real revenue of the Manager's lots for a date range (one lot when parkingLotId is set). A range that reaches today
 * follows the payment pushes; a range that ended before today is final and is read once.
 */
export function useManagerRevenue(query: RevenueReportQuery) {
  const live = useManagerRevenueRealtime(query.parkingLotId)
  const current = reachesToday(query)
  return useQuery({
    queryKey: queryKeys.reports.manager(query),
    queryFn: () => reportService.getManagerRevenue(query),
    staleTime: current ? undefined : Infinity,
    refetchInterval: !current ? false : live ? MANAGER_REVENUE_PUSHED_MS : MANAGER_REVENUE_REFRESH_MS,
  })
}
