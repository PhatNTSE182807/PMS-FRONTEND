export type WorkPosition = 'Entry' | 'Exit' | 'Counter'
export const WORK_POSITIONS: WorkPosition[] = ['Entry', 'Exit', 'Counter']
export const POSITION_LABEL: Record<WorkPosition, string> = { Entry: 'Entry lane', Exit: 'Exit lane', Counter: 'Counter' }

export interface WorkShiftTemplateInput {
  name: string
  startTime: string
  endTime: string
  minimumEntryStaff: number
  minimumExitStaff: number
  minimumCounterStaff: number
  isActive: boolean
  revision: number
}
export interface WorkShiftTemplate extends WorkShiftTemplateInput { id: number; parkingLotId: number }
export interface RosterStaff { employeeId: number; userId: string; fullName: string; employeeCode: string }
export interface DutyAssignment { id: number; employeeId: number; staffName: string; position: WorkPosition; notes: string | null; status: 'Assigned'; attendance?: AttendanceState }
export interface RosterShift {
  id: number
  workShiftTemplateId: number
  workDate: string
  name: string
  timeZoneId: string
  startTime: string
  endTime: string
  startsAt: string
  endsAt: string
  minimumEntryStaff: number
  minimumExitStaff: number
  minimumCounterStaff: number
  assignments: DutyAssignment[]
  entryAssigned: number
  exitAssigned: number
  counterAssigned: number
}
export interface RosterShortage {
  shiftId: number; workDate: string; shiftName: string; position: WorkPosition; required: number; assigned: number
}
export interface DutyRoster {
  id: number; parkingLotId: number; name: string; fromDate: string; toDate: string
  status: 'Draft' | 'Published'; revision: number; publishedAt: string | null
  shifts: RosterShift[]; shortages: RosterShortage[]
}
export interface RosterChange {
  id: number; dutyRosterId: number; revision: number; action: string; changedBy: string; changedByName: string; changedAt: string
  reason: string | null; beforeJson: string | null; afterJson: string
}
export interface RosterMutation { revision: number; reason?: string }
export interface RosterShiftInput extends RosterMutation { workDate: string; workShiftTemplateId: number }
export interface AssignmentInput extends RosterMutation { employeeId: number; position: WorkPosition; notes?: string; targetShiftId?: number }
export interface CalendarAssignmentInput extends AssignmentInput { shiftId?: number; workShiftTemplateId?: number; workDate: string }
export interface EligibleStaffQuery { shiftId?: number; workDate?: string; workShiftTemplateId?: number; excludeAssignmentId?: number }

export type AttendanceStatus = 'NotPublished' | 'Upcoming' | 'StartWindow' | 'Working' | 'Completed' | 'Absent' | 'Untracked' | 'Unavailable' | 'StartClosed'
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
  assignmentId: number; employeeId: number; staffName: string; shiftName: string; position: WorkPosition; parkingLotId: number
  rosterId: number; rosterName: string; rosterStatus: 'Draft' | 'Published'; rosterRevision: number
  plannedStart: string; plannedEnd: string; timeZoneId: string; attendance: AttendanceState; history: AttendanceEvent[]
}
export interface AttendanceCommand { revision: number; rosterRevision: number; reason?: string }
