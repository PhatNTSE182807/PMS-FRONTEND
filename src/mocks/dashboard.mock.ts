import type { DashboardOverviewDTO, HubPerformanceDTO } from '@/types/dashboard.dto'
import { mockResponse } from './mockApi'

/** Same sample numbers as AdminDashboardController, for demo sessions that run without a backend. */
const OVERVIEW: DashboardOverviewDTO = {
  totalGrossRevenue: 2_614_300_000,
  networkLoadFactor: 77.1,
  totalBays: 1240,
  occupiedBays: 956,
  activeUsers: 12_847,
  activeStaff: 64,
}

const HUBS: HubPerformanceDTO[] = [
  {
    lotId: 1,
    lotName: 'Tan Son Nhat Airport',
    location: 'Truong Son St, Tan Binh District, Ho Chi Minh City',
    totalBays: 450,
    occupiedBays: 387,
    occupancyRate: 86,
    todayRevenue: 38_450_000,
    mtdRevenue: 1_082_400_000,
  },
  {
    lotId: 2,
    lotName: 'Landmark 81',
    location: '720A Dien Bien Phu St, Binh Thanh District, Ho Chi Minh City',
    totalBays: 320,
    occupiedBays: 259,
    occupancyRate: 80.9,
    todayRevenue: 27_120_000,
    mtdRevenue: 745_600_000,
  },
  {
    lotId: 3,
    lotName: 'Bitexco Financial Tower',
    location: '2 Hai Trieu St, District 1, Ho Chi Minh City',
    totalBays: 280,
    occupiedBays: 190,
    occupancyRate: 67.9,
    todayRevenue: 16_830_000,
    mtdRevenue: 478_900_000,
  },
  {
    lotId: 4,
    lotName: 'Vincom Center Dong Khoi',
    location: '72 Le Thanh Ton St, District 1, Ho Chi Minh City',
    totalBays: 190,
    occupiedBays: 120,
    occupancyRate: 63.2,
    todayRevenue: 10_260_000,
    mtdRevenue: 307_400_000,
  },
]

export const dashboardMock = {
  getOverview: () => mockResponse(() => OVERVIEW),
  getHubs: () => mockResponse(() => HUBS),
}
