import { http } from './axiosClient'
import type {
  DutyAttendanceInput, DutyCandidate, DutyCellInput, DutySlot, DutyStatus, DutyWeek, LeaveBalanceRow, LeaveDecisionInput,
  LeavePreview, LeaveRequest, LeaveRequestInput, MyLeave,
} from '@/types/duty.dto'

const manager = (lotId: string) => `/manager/lots/${lotId}/duty`

/** Duty board, shift check-in / check-out and leave (backend DutyScheduleController). */
export const dutyApi = {
  // Manager
  week: (lotId: string, start?: string) => http.get<DutyWeek>(`${manager(lotId)}/week`, { params: { start } }),
  candidates: (lotId: string, date: string, slot: DutySlot, excludeEmployeeId?: number) =>
    http.get<DutyCandidate[]>(`${manager(lotId)}/candidates`, { params: { date, slot, excludeEmployeeId } }),
  setCell: (lotId: string, input: DutyCellInput) => http.put<DutyWeek>(`${manager(lotId)}/cells`, input),
  adjustAttendance: (lotId: string, input: DutyAttendanceInput) => http.put<DutyWeek>(`${manager(lotId)}/attendance`, input),
  lotLeave: (lotId: string) => http.get<LeaveRequest[]>(`${manager(lotId)}/leave-requests`),
  approveLeave: (lotId: string, id: number, input: LeaveDecisionInput) =>
    http.post<LeaveRequest[]>(`${manager(lotId)}/leave-requests/${id}/approve`, input),
  rejectLeave: (lotId: string, id: number, input: LeaveDecisionInput) =>
    http.post<LeaveRequest[]>(`${manager(lotId)}/leave-requests/${id}/reject`, input),

  // Staff
  status: () => http.get<DutyStatus>('/staff/duty/status'),
  myWeek: (start?: string) => http.get<DutyWeek>('/staff/duty/week', { params: { start } }),
  startShift: () => http.post<DutyStatus>('/staff/duty/shifts/start'),
  endShift: () => http.post<DutyStatus>('/staff/duty/shifts/end'),
  myLeave: () => http.get<MyLeave>('/staff/duty/leave'),
  previewLeave: (from: string, to: string) => http.get<LeavePreview>('/staff/duty/leave/preview', { params: { from, to } }),
  requestLeave: (input: LeaveRequestInput) => http.post<LeaveRequest>('/staff/duty/leave', input),
  cancelLeave: (id: number) => http.post<MyLeave>(`/staff/duty/leave/${id}/cancel`),

  // Admin
  leaveBalances: (year: number) => http.get<LeaveBalanceRow[]>('/admin/duty/leave-balances', { params: { year } }),
  setLeaveBalance: (employeeId: number, year: number, entitledDays: number, revision: number) =>
    http.put<LeaveBalanceRow[]>(`/admin/duty/leave-balances/${employeeId}/${year}`, { entitledDays, revision }),
}
