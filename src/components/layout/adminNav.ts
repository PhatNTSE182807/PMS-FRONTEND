import { BadgeDollarSign, CalendarCheck, ChartColumnBig, ClipboardCheck, CreditCard, Gauge, LayoutDashboard, Network, SquareParking, TriangleAlert, UserCog, Users, Vault, type LucideIcon } from 'lucide-react'

export interface AdminNavItem {
  to: string
  label: string
  icon: LucideIcon
}

/** Sidebar entries of the admin dashboard, in display order. */
export const MANAGER_NAV: AdminNavItem[] = [
  { to: '/management/console', label: 'Overview Console', icon: LayoutDashboard },
  { to: '/management/reservations', label: 'Reservations & Slots', icon: CalendarCheck },
  { to: '/management/approvals', label: 'Approval Queue', icon: ClipboardCheck },
  { to: '/management/pricing', label: 'Pricing & Tariffs', icon: BadgeDollarSign },
  { to: '/management/staff', label: 'Staff & POS Assignment', icon: UserCog },
  { to: '/management/lots', label: 'Facility Zones & Bays', icon: Network },
]

/** Tabs of the Staff (gate attendant) POS terminal console. */
export const STAFF_NAV: AdminNavItem[] = [
  { to: '/staff/gate', label: 'Gate Dashboard', icon: LayoutDashboard },
  { to: '/staff/checkout', label: 'Payment & Checkout POS', icon: CreditCard },
  { to: '/staff/exceptions', label: 'Exceptions & Alerts', icon: TriangleAlert },
  { to: '/staff/cash-tally', label: 'End-of-Day Cash Tally', icon: Vault },
]

export const ADMIN_NAV: AdminNavItem[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/lots', label: 'Parking Facilities', icon: SquareParking },
  { to: '/admin/customers', label: 'User Directory & Accounts', icon: Users },
  { to: '/admin/staff', label: 'Facility Managers', icon: UserCog },
  { to: '/admin/revenue', label: 'Revenue Report', icon: ChartColumnBig },
  { to: '/admin/capacity', label: 'Lot Capacity', icon: Gauge },
]
