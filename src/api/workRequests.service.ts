import { http } from './axiosClient'
import type { AssignmentRequestDetail, LeaveBalance, OpenShiftDetail, RequestCommand, WorkRequests } from '@/types/workRequests.dto'
const root = '/work-scheduling'
export const workRequestsApi = {
  board: (lotId: string, year: number) => http.get<WorkRequests>(`${root}/lots/${lotId}/requests`, { params: { year } }),
  assignment: (id: number) => http.get<AssignmentRequestDetail>(`${root}/assignments/${id}/requests`),
  leave: (input: { assignmentId: number; kind: string; reason: string }) => http.post(`${root}/leave-requests`, input),
  leaveAction: (id: number, input: RequestCommand) => http.post(`${root}/leave-requests/${id}/actions`, input),
  swap: (input: { assignmentId: number; otherAssignmentId: number; reason: string }) => http.post(`${root}/swap-requests`, input),
  swapAction: (id: number, input: RequestCommand) => http.post(`${root}/swap-requests/${id}/actions`, input),
  openShift: (id: number) => http.get<OpenShiftDetail>(`${root}/open-shifts/${id}`),
  openShiftAction: (id: number, input: RequestCommand) => http.post(`${root}/open-shifts/${id}/actions`, input),
  createOpenShift: (lotId: string, input: { shiftId: number; reason: string }) => http.post(`${root}/lots/${lotId}/open-shifts`, input),
  adminBalances: (year: number) => http.get<LeaveBalance[]>('/admin/work-scheduling/leave-balances', { params: { year } }),
  setBalance: (id: number, year: number, input: { revision: number; entitledDays: number; reason: string }) => http.put(`/admin/work-scheduling/leave-balances/${id}/${year}`, input),
}
