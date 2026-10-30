import { useQuery } from '@tanstack/react-query'
import { adminService } from '@/api/admin.service'
import { queryKeys } from '@/api/queryKeys'

/*
 * One query per dashboard block: the overview cards and the hub list load, fail and retry
 * independently, and each maps to one Admin endpoint.
 */

export function useDashboardOverview() {
  return useQuery({ queryKey: queryKeys.adminDashboard.overview(), queryFn: adminService.getDashboardOverview })
}

export function useDashboardHubs() {
  return useQuery({ queryKey: queryKeys.adminDashboard.hubs(), queryFn: adminService.getDashboardHubs })
}
