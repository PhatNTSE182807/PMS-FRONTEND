import type { OpenShift } from './workRequests.dto'

export interface WorkShiftTemplateInput {
  name: string
  startTime: string
  endTime: string
  minimumStaff: number
  isActive: boolean
  revision: number
}
export interface WorkShiftTemplate extends WorkShiftTemplateInput { id: number; parkingLotId: number }
export interface RosterStaff { employeeId: number; userId: string; fullName: string; employeeCode: string }
export interface DutyAssignment { id: number; employeeId: number; staffName: string; notes: string | null; status: 'Assigned'; attendance?: AttendanceState; source?: string; isManuallyEdited?: boolean; requestState?: string | null; originalAssignmentId?: number | null; replacementReason?: string | null; allowWeeklyOvertime?: boolean }
export interface RosterShift {
  attendanceLocked?: boolean
  id: number
  workShiftTemplateId: number
  workDate: string
  name: string
  timeZoneId: string
  startTime: string
  endTime: string
  startsAt: string
  endsAt: string
  minimumStaff: number
  assignments: DutyAssignment[]
  /** Staff counted toward the minimum: assignments not marked absent plus Manager coverage. */
  assigned: number
  trail?: { assignmentId: number; employeeId: number; staffName: string; kind: string; requestId: number; isPaid: boolean; reason: string | null }[]
  openShifts?: OpenShift[]
  managerCoverage?: { id: number; shiftId: number; managerName: string; reason: string; openShiftId: number }[]
}
export interface RosterShortage {
  shiftId: number; workDate: string; shiftName: string; required: number; assigned: number
}
export interface DutyRoster {
  attendanceLockedDates?: string[]
  id: number; parkingLotId: number; name: string; fromDate: string; toDate: string
  status: 'Draft' | 'Published'; revision: number; publishedAt: string | null
  shifts: RosterShift[]; shortages: RosterShortage[]
  rotationIssues?: RotationIssue[]
}
export interface RosterChange {
  id: number; dutyRosterId: number; revision: number; action: string; changedBy: string; changedByName: string; changedAt: string
  reason: string | null; beforeJson: string | null; afterJson: string
}
export interface RosterMutation { revision: number; reason?: string }
export interface RosterShiftInput extends RosterMutation { workDate: string; workShiftTemplateId: number }
export interface AssignmentInput extends RosterMutation { employeeId: number; notes?: string; targetShiftId?: number }
export interface CalendarAssignmentInput extends AssignmentInput { shiftId?: number; workShiftTemplateId?: number; workDate: string }
export interface EligibleStaffQuery { shiftId?: number; workDate?: string; workShiftTemplateId?: number; excludeAssignmentId?: number }

export type AttendanceStatus = 'NotPublished' | 'Upcoming' | 'StartWindow' | 'Working' | 'Completed' | 'Absent' | 'Untracked' | 'Unavailable' | 'StartClosed' | 'ApprovedLeave' | 'Reassigned'
export interface AttendanceState {
  status: AttendanceStatus; revision: number; checkInAt: string | null; checkOutAt: string | null
  isLate: boolean; autoEnded: boolean; canStart: boolean; canEnd: boolean; canReopen: boolean
  windowOpensAt: string; lateAfterAt: string; absentAfterAt: string; graceEndsAt: string; serverTime: string
}
export interface AttendanceEvent {
  id: number; revision: number; action: string; actorName: string; reason: string | null
  createdAt: string; beforeJson: string; afterJson: string
}
export interface AttendanceDetail {
  payReview?: import('./attendancePeriods.dto').AttendancePayReview
  assignmentId: number; employeeId: number; staffName: string; shiftName: string; parkingLotId: number
  rosterId: number; rosterName: string; rosterStatus: 'Draft' | 'Published'; rosterRevision: number
  plannedStart: string; plannedEnd: string; timeZoneId: string; attendance: AttendanceState; history: AttendanceEvent[]
}
export interface AttendanceCommand { revision: number; rosterRevision: number; reason?: string }

export interface RotationMember { employeeId: number }
export interface RotationGroup { id: number; name: string; offsetDays: number; isActive: boolean; revision: number; members: RotationMember[] }
export interface RotationStep { templateId: number | null; days: number }
export interface RotationCycle { id: number; name: string; revision: number; steps: RotationStep[] }
export interface RotationIssue { code: string; date: string | null; employeeId: number | null; message: string; blocking: boolean }
export interface RotationChange { kind: string; date: string; employeeId: number; staffName: string; detail: string; assignmentId?: number }
export interface RotationGeneration extends RosterMutation {
  fromDate: string; toDate: string; cycleStartDate: string; cycleId: number; groupIds: number[]
  replaceGenerated: boolean; previewToken?: string
}
export interface RotationPreview {
  roster: DutyRoster; token: string; proposedAssignments: number; changes: RotationChange[]; issues: RotationIssue[]
  unassigned: RosterStaff[]; minimumRestHours: number | null; maximumWeeklyHours: number | null; leaveSourceAvailable: boolean
}
