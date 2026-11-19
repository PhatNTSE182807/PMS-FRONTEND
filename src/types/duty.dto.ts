/** Duty board, shift attendance and leave. Mirrors the backend's Models/DutySchedule/DutyModels.cs. */

export type EmploymentType = 'FullTime' | 'Backup'
export type AttendanceStatus = 'Working' | 'Completed' | 'Absent'
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'

/** 0 = 00–06, 1 = 06–12, 2 = 12–18, 3 = 18–24. */
export type DutySlot = 0 | 1 | 2 | 3

export interface DutyStaff {
  employeeId: number
  userId: string
  fullName: string
  employeeCode: string
  employmentType: EmploymentType
  isActive: boolean
}

export interface DutyCell {
  date: string
  slot: DutySlot
  startsAt: string
  endsAt: string
  employeeId: number | null
  employeeName: string | null
  employmentType: EmploymentType | null
  isOneDayChange: boolean
  onLeaveName: string | null
  leavePending: boolean
  attendanceStatus: AttendanceStatus | null
  /** Started after the shift began. */
  isLate: boolean
  checkInAt: string | null
  checkOutAt: string | null
  isPast: boolean
  isMine: boolean
}

export interface DutyWeek {
  parkingLotId: number
  lotName: string
  timeZoneId: string
  weekStart: string
  today: string
  cells: DutyCell[]
  staff: DutyStaff[]
  emptyShifts: number
  pendingLeaveRequests: number
}

export type DutyScope = 'Day' | 'Following'

export interface DutyCellInput {
  date: string
  slot: DutySlot
  employeeId: number | null
  scope: DutyScope
  reason?: string
}

export interface DutyCandidate {
  employeeId: number
  fullName: string
  employeeCode: string
  employmentType: EmploymentType
  eligible: boolean
  warning: string | null
  blockedReason: string | null
  shiftsThisWeek: number
}

export interface DutyShift {
  parkingLotId: number
  lotName: string
  date: string
  slot: DutySlot
  startsAt: string
  endsAt: string
  attendanceStatus: AttendanceStatus | null
  isLate: boolean
  checkInAt: string | null
  checkOutAt: string | null
}

export interface DutyStatus {
  requireShiftForPos: boolean
  onShift: boolean
  canStart: boolean
  current: DutyShift | null
  next: DutyShift | null
  employmentType: EmploymentType
}

export interface LeaveShift {
  date: string
  slot: DutySlot
  startsAt: string
  endsAt: string
}

export interface LeavePreview {
  fromDate: string
  toDate: string
  calendarDays: number
  shifts: LeaveShift[]
  paidDays: number
  unpaidDays: number
  problem: string | null
}

export interface LeaveBalance {
  year: number
  entitledDays: number
  paidDaysUsed: number
  remainingPaidDays: number
  maxDaysPerMonth: number
  daysThisMonth: number
}

export interface LeaveRequest {
  id: number
  employeeId: number
  employeeName: string | null
  employmentType: EmploymentType | null
  fromDate: string
  toDate: string
  reason: string
  status: LeaveStatus
  decisionReason: string | null
  createdAt: string
  decidedAt: string | null
  paidDays: number
  unpaidDays: number
  shifts: LeaveShift[]
}

export interface MyLeave {
  balance: LeaveBalance
  requests: LeaveRequest[]
  noLeaveUntil: string | null
}

export interface LeaveRequestInput {
  fromDate: string
  toDate: string
  reason: string
}

export interface LeaveDecisionInput {
  reason?: string
  replacements?: { date: string; slot: DutySlot; employeeId: number | null }[]
}

export interface LeaveBalanceRow {
  employeeId: number
  userId: string
  fullName: string
  employeeCode: string
  lotName: string | null
  employmentType: EmploymentType
  year: number
  entitledDays: number
  paidDaysUsed: number
  revision: number
}
