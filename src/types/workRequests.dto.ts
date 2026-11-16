import type { RosterStaff, StandbyAssignment, WorkPosition } from './workScheduling.dto'
export interface LeaveRequest {
  id: number; assignmentId: number; employeeId: number; staffName: string; kind: string; status: string; revision: number
  leaveDate: string; startsAt: string; endsAt: string; reason: string; isPaid: boolean; proposedEmployeeId: number | null; decisionReason: string | null
}
export interface SwapRequest {
  id: number; assignmentId: number; otherAssignmentId: number; employeeId: number; otherEmployeeId: number; staffName: string
  otherStaffName: string; status: string; revision: number; reason: string; decisionReason: string | null
}
export interface OpenShift {
  id: number; shiftId: number; position: WorkPosition; status: string; stage: string; revision: number; originalAssignmentId: number | null
  targetEmployeeId: number | null; deadlineAt: string | null; replacementAssignmentId: number | null
  startsAt: string; endsAt: string; workDate: string; shiftName: string
}
export interface LeaveBalance { employeeId: number; staffName: string; year: number; entitledDays: number; paidDaysUsed: number; unpaidDays: number; revision: number }
export interface WorkRequests {
  leaves: LeaveRequest[]; swaps: SwapRequest[]; openShifts: OpenShift[]; balances: LeaveBalance[]
  options: { plannedNoticeHours: number; annualPaidDays: number; targetResponseMinutes: number | null; emergencyStandbyMinutes: number; publicClaimMinutes: number | null; cutoffHoursBeforeStart: number | null }
}
export interface RequestCommand { revision: number; action: string; reason?: string; claimId?: number; employeeId?: number; allowWeeklyOvertime?: boolean }
export interface AssignmentRequestDetail {
  assignmentId: number; lotId: number; employeeId: number; staffName: string; status: string; startsAt: string; endsAt: string; canRequest: boolean
  staff: RosterStaff[]; swapCandidates: { assignmentId: number; employeeId: number; staffName: string; shiftName: string; workDate: string; startsAt: string; endsAt: string; position: WorkPosition }[]
  leaves: LeaveRequest[]; swaps: SwapRequest[]
}
export interface OpenShiftDetail {
  staff: RosterStaff[]
  slot: OpenShift; candidates: RosterStaff[]; claims: { id: number; employeeId: number; staffName: string; status: string }[]; standby: StandbyAssignment[]
  history: { id: number; action: string; actorId: string; reason: string; createdAt: string; beforeJson: string | null; afterJson: string }[]
}
