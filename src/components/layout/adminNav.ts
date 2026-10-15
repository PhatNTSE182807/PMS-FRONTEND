import { ChartColumnBig, Users, type LucideIcon } from 'lucide-react'

export interface AdminNavItem {
  to: string
  label: string
  icon: LucideIcon
}

/** Sidebar entries of the admin dashboard, in display order. */
export const ADMIN_NAV: AdminNavItem[] = [
  { to: '/admin/staff', label: 'Quản lý nhân sự', icon: Users },
  { to: '/admin/revenue', label: 'Báo cáo doanh thu', icon: ChartColumnBig },
]
