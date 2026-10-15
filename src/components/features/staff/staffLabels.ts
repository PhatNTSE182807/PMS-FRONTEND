import type { BadgeTone } from '@/components/ui/badge'
import type { UserRole, UserStatus, WorkShift } from '@/types/identity.dto'

export const ROLE_OPTIONS: { value: UserRole; label: string; description: string; tone: BadgeTone }[] = [
  { value: 'MANAGER', label: 'Manager', description: 'Parking lot manager — can manage several lots', tone: 'indigo' },
  { value: 'STAFF', label: 'Staff', description: 'Gate staff — assigned to one lot and one shift', tone: 'sky' },
]

export const STATUS_OPTIONS: { value: UserStatus; label: string; tone: BadgeTone }[] = [
  { value: 'ACTIVE', label: 'Active', tone: 'emerald' },
  { value: 'INACTIVE', label: 'Deactivated', tone: 'rose' },
  { value: 'SUSPENDED', label: 'Suspended', tone: 'amber' },
]

export const SHIFT_OPTIONS: { value: WorkShift; label: string }[] = [
  { value: 'MORNING', label: 'Morning (06:00 – 14:00)' },
  { value: 'AFTERNOON', label: 'Afternoon (14:00 – 22:00)' },
  { value: 'NIGHT', label: 'Night (22:00 – 06:00)' },
]

export const roleOption = (role: UserRole) => ROLE_OPTIONS.find((o) => o.value === role) ?? ROLE_OPTIONS[1]
export const statusOption = (status: UserStatus) => STATUS_OPTIONS.find((o) => o.value === status) ?? STATUS_OPTIONS[0]
export const shiftLabel = (shift?: WorkShift) => SHIFT_OPTIONS.find((o) => o.value === shift)?.label.split(' (')[0]
