import type { CustomerListQuery, ManagedStaffQuery, StaffListQuery } from '@/types/identity.dto'
import type { RevenueBreakdownQuery, RevenueFilterQuery } from '@/types/report.dto'

/** React Query cache keys, grouped by service so invalidation can target one service. */
export const queryKeys = {
  profile: {
    all: ['profile'] as const,
    me: () => [...queryKeys.profile.all, 'me'] as const,
    vehicles: () => [...queryKeys.profile.all, 'vehicles'] as const,
    vehicleTypes: () => [...queryKeys.profile.all, 'vehicle-types'] as const,
  },
  /** Paper checks (registration certificate + Citizen ID) of the signed-in user's vehicles. */
  vehicleDocuments: {
    all: ['vehicle-documents'] as const,
    latest: (vehicleId: string) => [...queryKeys.vehicleDocuments.all, 'latest', vehicleId] as const,
  },
  /** Staff review queue of new vehicle registrations. */
  vehicleVerifications: {
    all: ['vehicle-verifications'] as const,
    queue: (status: string) => [...queryKeys.vehicleVerifications.all, 'queue', status] as const,
    detail: (verificationId: string) => [...queryKeys.vehicleVerifications.all, 'detail', verificationId] as const,
    file: (verificationId: string, documentId: string) =>
      [...queryKeys.vehicleVerifications.all, 'file', verificationId, documentId] as const,
  },
  customers: {
    all: ['customers'] as const,
    list: (query: CustomerListQuery) => [...queryKeys.customers.all, 'list', query] as const,
  },
  staff: {
    all: ['staff'] as const,
    list: (query: StaffListQuery) => [...queryKeys.staff.all, 'list', query] as const,
  },
  /** A Manager's own Staff; kept under `staff` so Admin staff edits refresh it too. */
  team: {
    all: ['staff', 'team'] as const,
    list: (query: ManagedStaffQuery) => [...queryKeys.team.all, 'list', query] as const,
  },
  parking: {
    all: ['parking'] as const,
    lots: () => [...queryKeys.parking.all, 'lots'] as const,
    capacity: () => [...queryKeys.parking.all, 'capacity'] as const,
    staffLots: (userId: string | undefined) => [...queryKeys.parking.all, 'staff-lots', userId] as const,
  },
  /** The customer's reservations and the lots they can book. */
  reservations: {
    all: ['reservations'] as const,
    mine: () => [...queryKeys.reservations.all, 'mine'] as const,
    qr: (id: number) => [...queryKeys.reservations.all, 'qr', id] as const,
    lots: () => [...queryKeys.reservations.all, 'lots'] as const,
  },
  /** Entry/exit lanes of one lot (Staff). */
  gate: {
    all: ['gate'] as const,
    gates: (lotId: string) => [...queryKeys.gate.all, 'gates', lotId] as const,
    counters: (lotId: string) => [...queryKeys.gate.all, 'counters', lotId] as const,
    sessions: (lotId: string) => [...queryKeys.gate.all, 'sessions', lotId] as const,
    reservation: (lotId: string, entry: string) => [...queryKeys.gate.all, 'reservation', lotId, entry] as const,
  },
  layout: {
    all: ['layout'] as const,
    templates: () => [...queryKeys.layout.all, 'templates'] as const,
    lot: (lotId: string) => [...queryKeys.layout.all, 'lot', lotId] as const,
    status: (lotId: string) => [...queryKeys.layout.all, 'status', lotId] as const,
    plan2D: (lotId: string, detail: string) => [...queryKeys.layout.all, '2d', lotId, detail] as const,
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
