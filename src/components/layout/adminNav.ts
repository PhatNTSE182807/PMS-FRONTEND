import { Building2, ChartColumnBig, Gauge, Users, type LucideIcon } from 'lucide-react'

export interface AdminNavItem {
  to: string
  label: string
  icon: LucideIcon
}

/** Sidebar entries of the admin dashboard, in display order. */
export const MANAGER_NAV: AdminNavItem[] = [
  { to: '/management/lots', label: 'Quản lý bãi xe', icon: Building2 },
]

export const ADMIN_NAV: AdminNavItem[] = [
  { to: '/admin/lots', label: 'Quản lý bãi xe', icon: Building2 },
  { to: '/admin/staff', label: 'Quản lý nhân sự', icon: Users },
  { to: '/admin/revenue', label: 'Báo cáo doanh thu', icon: ChartColumnBig },
  { to: '/admin/capacity', label: 'Công suất bãi xe', icon: Gauge },
]
