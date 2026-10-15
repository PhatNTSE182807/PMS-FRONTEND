import { Building2, ChartColumnBig, Gauge, UserRound, Users, type LucideIcon } from 'lucide-react'

export interface AdminNavItem {
  to: string
  label: string
  icon: LucideIcon
}

/** Sidebar entries of the admin dashboard, in display order. */
export const MANAGER_NAV: AdminNavItem[] = [
  { to: '/management/lots', label: 'Parking Lots', icon: Building2 },
]

export const ADMIN_NAV: AdminNavItem[] = [
  { to: '/admin/lots', label: 'Parking Lots', icon: Building2 },
  { to: '/admin/staff', label: 'Staff Accounts', icon: Users },
  { to: '/admin/customers', label: 'Customer Accounts', icon: UserRound },
  { to: '/admin/revenue', label: 'Revenue Report', icon: ChartColumnBig },
  { to: '/admin/capacity', label: 'Lot Capacity', icon: Gauge },
]
