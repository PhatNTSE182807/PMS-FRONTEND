import { isMockService, SERVICE_PATHS } from '@/config/env'
import { dashboardMock } from '@/mocks/dashboard.mock'
import type { DashboardOverviewDTO, HubPerformanceDTO } from '@/types/dashboard.dto'
import { http } from './axiosClient'

const mocked = () => isMockService('staff')

/** Admin-only reads (AdminDashboardController, /admin/dashboard/...). */
export const adminService = {
  /** GET /admin/dashboard/overview */
  getDashboardOverview(): Promise<DashboardOverviewDTO> {
    return mocked() ? dashboardMock.getOverview() : http.get<DashboardOverviewDTO>(`${SERVICE_PATHS.staff}/dashboard/overview`)
  },

  /** GET /admin/dashboard/hubs */
  getDashboardHubs(): Promise<HubPerformanceDTO[]> {
    return mocked() ? dashboardMock.getHubs() : http.get<HubPerformanceDTO[]>(`${SERVICE_PATHS.staff}/dashboard/hubs`)
  },
}
