import type { CustomerListQuery, ManagedStaffQuery, StaffListQuery } from '@/types/identity.dto'
import type { ParkingHistoryQuery } from '@/types/parkingHistory.dto'
import type { RevenueBreakdownQuery, RevenueFilterQuery } from '@/types/report.dto'

/** React Query cache keys, grouped by service so invalidation can target one service. */
export const queryKeys = {
  profile: {
    all: ['profile'] as const,
    me: () => [...queryKeys.profile.all, 'me'] as const,
    vehicles: () => [...queryKeys.profile.all, 'vehicles'] as const,
    vehicleTypes: () => [...queryKeys.profile.all, 'vehicle-types'] as const,
    checkPlate: (plate: string) => [...queryKeys.profile.all, 'check-plate', plate] as const,
    checkUnique: (phone?: string, citizenId?: string) =>
      [...queryKeys.profile.all, 'check-unique', phone ?? '', citizenId ?? ''] as const,
  },
  /** Paper checks (registration certificate + Citizen ID) of the signed-in user's vehicles. */
  vehicleDocuments: {
    all: ['vehicle-documents'] as const,
    latest: (vehicleId: string) => [...queryKeys.vehicleDocuments.all, 'latest', vehicleId] as const,
    /** Recently rejected registrations (their vehicles were removed). */
    rejected: () => [...queryKeys.vehicleDocuments.all, 'rejected'] as const,
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
    /** Public lot list with live free bays (homepage). */
    publicLots: () => [...queryKeys.parking.all, 'public-lots'] as const,
    staffLots: (userId: string | undefined) => [...queryKeys.parking.all, 'staff-lots', userId] as const,
  },
  /** A lot's pricing rules and fee simulations. */
  pricing: {
    all: ['pricing'] as const,
    rules: (lotId: string) => ['pricing', 'rules', lotId] as const,
    publicPrices: (lotId: string) => ['pricing', 'public', lotId] as const,
    simulation: (lotId: string, request: object) => ['pricing', 'simulation', lotId, request] as const,
  },
  /** Admin dashboard: network overview and per-hub performance. */
  adminDashboard: {
    all: ['admin-dashboard'] as const,
    overview: () => [...queryKeys.adminDashboard.all, 'overview'] as const,
    hubs: () => [...queryKeys.adminDashboard.all, 'hubs'] as const,
  },
  /** The Admin's parking simulation (fees and booking times in seconds). */
  parkingSimulation: ['parking-simulation'] as const,
  /** Server-wide payment settings. */
  payments: {
    simulation: () => ['payments', 'simulation'] as const,
  },
  /** The customer's reservations and the lots they can book. */
  reservations: {
    all: ['reservations'] as const,
    mine: () => [...queryKeys.reservations.all, 'mine'] as const,
    upcoming: () => [...queryKeys.reservations.all, 'upcoming'] as const,
    qr: (id: number) => [...queryKeys.reservations.all, 'qr', id] as const,
    lots: () => [...queryKeys.reservations.all, 'lots'] as const,
  },
  /** The customer's vehicles parked right now (running fee, exit pass). */
  parkingSessions: {
    all: ['parking-sessions'] as const,
    current: () => [...queryKeys.parkingSessions.all, 'current'] as const,
  },
  /** The customer's finished parking sessions (history and e-receipts). */
  parkingHistory: {
    all: ['parking-history'] as const,
    page: (query: ParkingHistoryQuery) => [...queryKeys.parkingHistory.all, 'page', query] as const,
  },
  /** Customer notification bell (vehicle approved/rejected, check-in, check-out). */
  notifications: {
    all: ['notifications'] as const,
    list: () => [...queryKeys.notifications.all, 'list'] as const,
    unreadCount: () => [...queryKeys.notifications.all, 'unread-count'] as const,
  },
  /** Check-in / check-out requests from the customer app. */
  gateRequests: {
    all: ['gate-requests'] as const,
    mine: () => [...queryKeys.gateRequests.all, 'mine'] as const,
    queue: (lotId: string, kind: string) => [...queryKeys.gateRequests.all, 'queue', lotId, kind] as const,
  },
  /** Entry/exit lanes of one lot (Staff). */
  gate: {
    all: ['gate'] as const,
    gates: (lotId: string) => [...queryKeys.gate.all, 'gates', lotId] as const,
    counters: (lotId: string) => [...queryKeys.gate.all, 'counters', lotId] as const,
    sessions: (lotId: string) => [...queryKeys.gate.all, 'sessions', lotId] as const,
    history: (lotId: string, page = 1) => [...queryKeys.gate.all, 'history', lotId, page] as const,
    payments: (lotId: string, method?: string) => [...queryKeys.gate.all, 'payments', lotId, method ?? ''] as const,
    reservation: (lotId: string, entry: string) => [...queryKeys.gate.all, 'reservation', lotId, entry] as const,
  },
  /** Manager sign-off queues of a lot. */
  approvals: {
    all: ['approvals'] as const,
    lostTickets: (lotId: string) => [...queryKeys.approvals.all, 'lost-tickets', lotId] as const,
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
    manager: (query: object) => [...queryKeys.reports.all, 'manager', query] as const,
  },
}
