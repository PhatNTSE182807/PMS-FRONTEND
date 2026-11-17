import type { AttendanceState, DutyRoster } from './workScheduling.dto'
export type PayrollRole = 'Staff' | 'Manager'
export interface SalaryProfile {
  employeeName?: string
  id: number; userId: string; role: PayrollRole; effectiveFrom: string; hourlyRate: number | null; monthlyRate: number | null
  nightStart: string | null; nightEnd: string | null; nightFactor: number | null; holidayFactor: number | null; overtimeFactor: number | null
  standardWorkDays: number | null
  currency: string | null; moneyDecimals: number | null; roundingMode: string | null; reason: string; revision: number
}
export interface PayrollPerson { userId: string; name: string; role: PayrollRole; employeeId: number | null; parkingLotId: number | null; isActive: boolean }
export interface PayrollDirectory { people: PayrollPerson[]; lots: { id: number; name: string; managerUserId: string | null }[] }
export interface PayrollSlip { id: number; userId: string; employeeId: number | null; employeeName: string; role: PayrollRole; parkingLotId: number; payMonth: string; status: 'Draft' | 'Approved' | 'Paid'; currency: string; total: number; basisHash: string; revision: number; approvedAt: string | null; paidAt: string | null; transactionReference: string | null }
export interface PayrollLine { id: number; ordinal: number; kind: string; description: string; sourcePeriodLotId: number; assignmentId: number | null; attendanceRevision: number | null; leaveRequestId: number | null; managerDayId: number | null; adjustmentId: number | null; profileId: number | null; workDate: string; startsAt: string | null; endsAt: string | null; unit: string; quantity: number; unitRate: number; factor: number; amount: number; sourceJson: string }
export interface PayrollComplaint { id: number; payrollSlipId: number; userId: string; reason: string; status: 'Open' | 'Accepted' | 'Rejected'; resolutionReason: string | null; adjustmentId: number | null; revision: number; createdAt: string }
export interface PayrollAudit { id: number; action: string; actorId: string; parkingLotId: number | null; payrollSlipId: number | null; reason: string | null; createdAt: string; beforeJson: string | null; afterJson: string | null }
export interface PayrollDetail { slip: PayrollSlip; lines: PayrollLine[]; complaints: PayrollComplaint[]; history: PayrollAudit[]; stale: boolean }
export interface PayrollPreview { userId: string; employeeName: string; role: PayrollRole; currency: string; total: number; lines: PayrollLine[]; basisHash: string }
/** Hours carried between locked attendance months, valued by Admin as an adjustment. */
export interface PayrollCarry { id: number; employeeId: number; hours: number; reason: string }
export interface PayrollAdjustment { id: number; userId: string; role: PayrollRole; parkingLotId: number; payMonth: string; sourceSlipId: number | null; sourceCarryId: number | null; kind: 'Adjustment' | 'Allowance' | 'Bonus'; quantity: number; unitRate: number; reason: string }
export interface PayrollFrozenSource { line: PayrollLine; roster: DutyRoster | null; frozen: true; assignment: { assignmentId: number; shiftName: string; staffName: string; timeZoneId: string; plannedStart: string; plannedEnd: string; actualStart: string | null; actualEnd: string | null; attendanceRevision: number; attendance: AttendanceState; attendanceHistoryJson: string; overtimeHistoryJson: string } | null }
