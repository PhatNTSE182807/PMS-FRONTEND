import { BadgeDollarSign, CalendarCheck, ChartColumnBig, ClipboardCheck, CreditCard, FlaskConical, Gauge, History, LayoutDashboard, ScanText, SquareParking, TriangleAlert, UserCog, Users, Vault, type LucideIcon } from 'lucide-react'

export interface AdminNavItem {
  to: string
  label: string
  icon: LucideIcon
}

/** Sidebar entries of the admin dashboard, in display order. */
export const MANAGER_NAV: AdminNavItem[] = [
  { to: '/management/console', label: 'Overview', icon: LayoutDashboard },
  { to: '/management/reservations', label: 'Reservations & Bays', icon: CalendarCheck },
  { to: '/management/approvals', label: 'Approval Queue', icon: ClipboardCheck },
  { to: '/management/pricing', label: 'Pricing Rule', icon: BadgeDollarSign },
  { to: '/management/staff', label: 'Staff Assignment', icon: UserCog },
  { to: '/management/work-schedules', label: 'Work Schedules', icon: CalendarCheck },
  { to: '/management/payroll', label: 'Payroll', icon: BadgeDollarSign },
]

/** Tabs of the Staff (gate attendant) POS terminal console. */
export const STAFF_NAV: AdminNavItem[] = [
  { to: '/staff/work-schedule', label: 'Duty Board', icon: CalendarCheck },
  { to: '/staff/payroll', label: 'My Payslips', icon: BadgeDollarSign },
  { to: '/staff/gate', label: 'Gate Dashboard', icon: LayoutDashboard },
  { to: '/staff/checkout', label: 'Payment & Checkout POS', icon: CreditCard },
  { to: '/staff/exceptions', label: 'Exceptions & Alerts', icon: TriangleAlert },
  { to: '/staff/cash-tally', label: 'Cash Tally', icon: Vault },
  { to: '/staff/verifications', label: 'Vehicle Registrations', icon: ScanText },
]

export const ADMIN_NAV: AdminNavItem[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/lots', label: 'Parking Lots', icon: SquareParking },
  { to: '/admin/customers', label: 'User Directory & Accounts', icon: Users },
  { to: '/admin/staff', label: 'Lot Managers', icon: UserCog },
  { to: '/admin/payroll', label: 'Payroll', icon: BadgeDollarSign },
  { to: '/admin/revenue', label: 'Revenue Report', icon: ChartColumnBig },
  { to: '/admin/pricing-history', label: 'Pricing History', icon: History },
  { to: '/admin/capacity', label: 'Lot Performance', icon: Gauge },
  { to: '/admin/simulation', label: 'Parking Simulation', icon: FlaskConical },
]
