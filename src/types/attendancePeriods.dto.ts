import type { AttendanceState } from './workScheduling.dto'
export interface AttendancePayReview {
  originalCheckInAt: string | null; originalCheckOutAt: string | null; originalHours: number | null
  adjustedHours: number; regularHours: number; overtimeHours: number; overtimeStatus: 'None' | 'Pending' | 'Approved' | 'Rejected'
  approvedHours: number; hasAdjustments: boolean; reviewed: boolean; locked: boolean; periods: string[]
  overtimeDecisionId: number
  overtimeHistory?: { id: number; approved: boolean; reason: string; attendanceRevision: number; createdAt: string }[]
}
export interface PeriodLot { id: number; parkingLotId: number; lotName: string; timeZoneId: string; status: 'Open' | 'Confirmed' | 'Locked'; revision: number; confirmedAt: string | null }
export interface AttendancePeriod { id: number; name: string; fromDate: string; toDate: string; status: 'Open' | 'Confirmed' | 'Locked'; revision: number; lockedAt: string | null; lots: PeriodLot[] }
export interface AttendanceReviewRow { assignmentId: number; employeeId: number; staffName: string; shiftName: string; workDate: string; startsAt: string; endsAt: string; attendance: AttendanceState; pay: AttendancePayReview }
export interface EmployeeHours { employeeId: number; staffName: string; scheduledHours: number; actualHours: number | null; adjustedHours: number; approvedHours: number; overtimeHours: number; approvedOvertimeHours: number; paidLeaveDays: number; unpaidLeaveDays: number; absentShifts: number; carryHours: number }
export type ManagerDayKind = 'Work' | 'Leave' | 'PaidLeave' | 'UnpaidLeave' | 'Absent'
export interface ManagerDay { id: number; managerUserId: string; managerName: string; workDate: string; kind: ManagerDayKind; revision: number; reason: string }
export interface AttendancePeriodReview { period: AttendancePeriod; lot: PeriodLot; rows: AttendanceReviewRow[]; employees: EmployeeHours[]; warnings: string[]; managerDays: ManagerDay[]; adjustments: { id: number; employeeId: number; hours: number; reason: string; sourcePeriodLotId: number }[]; history: { id: number; action: string; actorId: string; reason: string; createdAt: string }[] }
export type ReviewFilter = 'All' | 'Late' | 'Absent' | 'AutoEnded' | 'Adjusted' | 'OvertimePending'
export const matchesReview = (row: AttendanceReviewRow, filter: ReviewFilter) => filter === 'All' || (filter === 'Late' && row.attendance.isLate) || (filter === 'Absent' && row.attendance.status === 'Absent') || (filter === 'AutoEnded' && row.attendance.autoEnded) || (filter === 'Adjusted' && row.pay.hasAdjustments) || (filter === 'OvertimePending' && row.pay.overtimeStatus === 'Pending')
