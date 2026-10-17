import { ChartColumnBig, Gauge, LayoutDashboard, SquareParking, UserCog, Users, type LucideIcon } from 'lucide-react'

export interface AdminNavItem {
  to: string
  label: string
  icon: LucideIcon
}

/** Sidebar entries of the admin dashboard, in display order. */
export const MANAGER_NAV: AdminNavItem[] = [
  { to: '/management/lots', label: 'Parking Facilities', icon: SquareParking },
]

export const ADMIN_NAV: AdminNavItem[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/lots', label: 'Parking Facilities', icon: SquareParking },
  { to: '/admin/customers', label: 'User Directory & Accounts', icon: Users },
  { to: '/admin/staff', label: 'Facility Managers', icon: UserCog },
  { to: '/admin/revenue', label: 'Revenue Report', icon: ChartColumnBig },
  { to: '/admin/capacity', label: 'Lot Capacity', icon: Gauge },
]
