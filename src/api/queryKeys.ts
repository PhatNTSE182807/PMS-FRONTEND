import type { CustomerListQuery, StaffListQuery } from '@/types/identity.dto'
import type { RevenueBreakdownQuery, RevenueFilterQuery } from '@/types/report.dto'

/** React Query cache keys, grouped by service so invalidation can target one service. */
export const queryKeys = {
  profile: {
    all: ['profile'] as const,
    me: () => [...queryKeys.profile.all, 'me'] as const,
    vehicles: () => [...queryKeys.profile.all, 'vehicles'] as const,
    vehicleTypes: () => [...queryKeys.profile.all, 'vehicle-types'] as const,
  },
  customers: {
    all: ['customers'] as const,
    list: (query: CustomerListQuery) => [...queryKeys.customers.all, 'list', query] as const,
  },
  staff: {
    all: ['staff'] as const,
    list: (query: StaffListQuery) => [...queryKeys.staff.all, 'list', query] as const,
  },
  parking: {
    all: ['parking'] as const,
    lots: () => [...queryKeys.parking.all, 'lots'] as const,
    capacity: () => [...queryKeys.parking.all, 'capacity'] as const,
  },
  reports: {
    all: ['reports'] as const,
    kpi: (query: RevenueFilterQuery) => [...queryKeys.reports.all, 'kpi', query] as const,
    timeSeries: (query: RevenueFilterQuery) => [...queryKeys.reports.all, 'timeseries', query] as const,
    paymentMethods: (query: RevenueFilterQuery) => [...queryKeys.reports.all, 'payment-methods', query] as const,
    byLot: (query: RevenueFilterQuery) => [...queryKeys.reports.all, 'by-lot', query] as const,
    breakdown: (query: RevenueBreakdownQuery) => [...queryKeys.reports.all, 'breakdown', query] as const,
  },
}
