import type { BadgeTone } from '@/components/ui/badge'
import type { UserRole, UserStatus, WorkShift } from '@/types/identity.dto'

export const ROLE_OPTIONS: { value: UserRole; label: string; description: string; tone: BadgeTone }[] = [
  { value: 'MANAGER', label: 'Manager', description: 'Quản lý bãi — có thể phụ trách nhiều bãi xe', tone: 'indigo' },
  { value: 'STAFF', label: 'Staff', description: 'Nhân viên trực chốt — gán cố định 1 bãi và 1 ca', tone: 'sky' },
]

export const STATUS_OPTIONS: { value: UserStatus; label: string; tone: BadgeTone }[] = [
  { value: 'ACTIVE', label: 'Đang hoạt động', tone: 'emerald' },
  { value: 'INACTIVE', label: 'Đã khóa', tone: 'rose' },
  { value: 'SUSPENDED', label: 'Tạm đình chỉ', tone: 'amber' },
]

export const SHIFT_OPTIONS: { value: WorkShift; label: string }[] = [
  { value: 'MORNING', label: 'Ca sáng (06:00 – 14:00)' },
  { value: 'AFTERNOON', label: 'Ca chiều (14:00 – 22:00)' },
  { value: 'NIGHT', label: 'Ca đêm (22:00 – 06:00)' },
]

export const roleOption = (role: UserRole) => ROLE_OPTIONS.find((o) => o.value === role) ?? ROLE_OPTIONS[1]
export const statusOption = (status: UserStatus) => STATUS_OPTIONS.find((o) => o.value === status) ?? STATUS_OPTIONS[0]
export const shiftLabel = (shift?: WorkShift) => SHIFT_OPTIONS.find((o) => o.value === shift)?.label.split(' (')[0]
