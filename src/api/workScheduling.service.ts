import { http } from './axiosClient'
import type { AssignmentInput, CalendarAssignmentInput, EligibleStaffQuery, DutyRoster, RosterChange, RosterMutation, RosterShiftInput, RosterStaff, WorkShiftTemplate, WorkShiftTemplateInput, AttendanceDetail, AttendanceCommand, RotationGroup, RotationCycle, RotationGeneration, RotationPreview } from '@/types/workScheduling.dto'

const base = (lotId: string) => `/manager/lots/${lotId}/work-scheduling`
const roster = (lotId: string, id: number) => `${base(lotId)}/rosters/${id}`
export const workSchedulingApi = {
  rotationGroups: (lotId: string) => http.get<RotationGroup[]>(`${base(lotId)}/rotation-groups`),
  saveRotationGroup: (lotId: string, value: Omit<RotationGroup, 'id'>, id?: number) => id ? http.put<RotationGroup>(`${base(lotId)}/rotation-groups/${id}`, value) : http.post<RotationGroup>(`${base(lotId)}/rotation-groups`, value),
  rotationCycles: (lotId: string) => http.get<RotationCycle[]>(`${base(lotId)}/rotation-cycles`),
  saveRotationCycle: (lotId: string, value: Omit<RotationCycle, 'id'>, id?: number) => id ? http.put<RotationCycle>(`${base(lotId)}/rotation-cycles/${id}`, value) : http.post<RotationCycle>(`${base(lotId)}/rotation-cycles`, value),
  previewRotation: (lotId: string, id: number, value: RotationGeneration) => http.post<RotationPreview>(`${roster(lotId, id)}/rotation-preview`, value),
  applyRotation: (lotId: string, id: number, value: RotationGeneration) => http.post<DutyRoster>(`${roster(lotId, id)}/rotation-apply`, value),
  templates: (lotId: string) => http.get<WorkShiftTemplate[]>(`${base(lotId)}/templates`),
  saveTemplate: (lotId: string, input: WorkShiftTemplateInput, id?: number) => id
    ? http.put<WorkShiftTemplate>(`${base(lotId)}/templates/${id}`, input)
    : http.post<WorkShiftTemplate>(`${base(lotId)}/templates`, input),
  staff: (lotId: string) => http.get<RosterStaff[]>(`${base(lotId)}/staff`),
  rosters: (lotId: string) => http.get<DutyRoster[]>(`${base(lotId)}/rosters`),
  createRoster: (lotId: string, input: { name: string; fromDate: string; toDate: string }) => http.post<DutyRoster>(`${base(lotId)}/rosters`, input),
  saveShift: (lotId: string, rosterId: number, input: RosterShiftInput, shiftId?: number) => shiftId
    ? http.put<DutyRoster>(`${roster(lotId, rosterId)}/shifts/${shiftId}`, input)
    : http.post<DutyRoster>(`${roster(lotId, rosterId)}/shifts`, input),
  removeShift: (lotId: string, rosterId: number, shiftId: number, input: RosterMutation) =>
    http.post<DutyRoster>(`${roster(lotId, rosterId)}/shifts/${shiftId}/cancel`, input),
  saveAssignment: (lotId: string, rosterId: number, shiftId: number, input: AssignmentInput, id?: number) => id
    ? http.put<DutyRoster>(`${roster(lotId, rosterId)}/shifts/${shiftId}/assignments/${id}`, input)
    : http.post<DutyRoster>(`${roster(lotId, rosterId)}/shifts/${shiftId}/assignments`, input),
  removeAssignment: (lotId: string, rosterId: number, shiftId: number, id: number, input: RosterMutation) =>
    http.post<DutyRoster>(`${roster(lotId, rosterId)}/shifts/${shiftId}/assignments/${id}/cancel`, input),
  publish: (lotId: string, rosterId: number, input: RosterMutation) => http.post<DutyRoster>(`${roster(lotId, rosterId)}/publish`, input),
  history: (lotId: string, rosterId: number) => http.get<RosterChange[]>(`${roster(lotId, rosterId)}/history`),
  eligibleStaff: (lotId: string, rosterId: number, query: EligibleStaffQuery) =>
    http.get<RosterStaff[]>(`${roster(lotId, rosterId)}/eligible-staff`, { params: query }),
  assignFromCalendar: (lotId: string, rosterId: number, input: CalendarAssignmentInput) =>
    http.post<DutyRoster>(`${roster(lotId, rosterId)}/calendar-assignments`, input),
  mine: (from: string, to: string) => http.get<DutyRoster[]>('/staff/work-schedule', { params: { from, to } }),
  attendance: (id: number) => http.get<AttendanceDetail>(`/work-scheduling/assignments/${id}/attendance`),
  currentShifts: () => http.get<AttendanceDetail[]>('/staff/current-shifts'),
  startShift: (id: number, command: AttendanceCommand) => http.post<AttendanceDetail>(`/work-scheduling/assignments/${id}/attendance/start`, command),
  endShift: (id: number, command: AttendanceCommand) => http.post<AttendanceDetail>(`/work-scheduling/assignments/${id}/attendance/end`, command),
  reopenShift: (id: number, command: AttendanceCommand) => http.post<AttendanceDetail>(`/work-scheduling/assignments/${id}/attendance/reopen`, command),
  adjustAttendance: (id: number, command: AttendanceCommand & { checkInAt: string; checkOutAt: string | null }) =>
    http.put<AttendanceDetail>(`/work-scheduling/assignments/${id}/attendance`, command),
}
