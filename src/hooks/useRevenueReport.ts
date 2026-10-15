import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/api/queryKeys'
import { reportService } from '@/api/report.service'
import type { RevenueBreakdownQuery, RevenueFilterQuery } from '@/types/report.dto'

/*
 * One query per report widget: each card loads, fails and caches independently, and maps
 * one-to-one to a Report service endpoint.
 */

export function useRevenueKpi(filter: RevenueFilterQuery) {
  return useQuery({ queryKey: queryKeys.reports.kpi(filter), queryFn: () => reportService.getKpiSummary(filter) })
}

export function useRevenueTimeSeries(filter: RevenueFilterQuery) {
  return useQuery({ queryKey: queryKeys.reports.timeSeries(filter), queryFn: () => reportService.getTimeSeries(filter) })
}

export function usePaymentMethodBreakdown(filter: RevenueFilterQuery) {
  return useQuery({
    queryKey: queryKeys.reports.paymentMethods(filter),
    queryFn: () => reportService.getPaymentMethods(filter),
  })
}

export function useRevenueByParkingLot(filter: RevenueFilterQuery, enabled = true) {
  return useQuery({
    queryKey: queryKeys.reports.byLot(filter),
    queryFn: () => reportService.getRevenueByParkingLot(filter),
    enabled,
  })
}

export function useRevenueBreakdown(query: RevenueBreakdownQuery) {
  return useQuery({ queryKey: queryKeys.reports.breakdown(query), queryFn: () => reportService.getBreakdown(query) })
}
