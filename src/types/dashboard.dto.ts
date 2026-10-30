/*
 * Admin dashboard (GET /api/admin/dashboard/overview and /hubs).
 * Mirrors DashboardOverviewDto and HubPerformanceDto in the backend (AdminDashboardController).
 */

export interface DashboardOverviewDTO {
  /** Gross revenue in VND across all lots. */
  totalGrossRevenue: number
  /** Occupied bays over total bays of the whole network, 0-100. */
  networkLoadFactor: number
  totalBays: number
  occupiedBays: number
  /** Active customer accounts. */
  activeUsers: number
  /** Active Manager and Staff accounts. */
  activeStaff: number
}

export interface HubPerformanceDTO {
  lotId: number
  lotName: string
  location: string
  totalBays: number
  occupiedBays: number
  /** Occupied bays over total bays of this lot, 0-100. */
  occupancyRate: number
  /** Revenue in VND collected today. */
  todayRevenue: number
  /** Month-to-date revenue in VND. */
  mtdRevenue: number
}
