import { http } from './axiosClient'
import type { AttendancePeriod, AttendancePeriodReview, ManagerDay, ManagerDayKind } from '@/types/attendancePeriods.dto'
import type { AttendanceCommand, AttendanceDetail } from '@/types/workScheduling.dto'
const base = '/work-scheduling/attendance-periods'
export const attendancePeriodsApi = {
  list: (lotId?: string) => http.get<AttendancePeriod[]>(base, { params: { lotId } }),
  directory: () => http.get<{ id: number; name: string; managerUserId: string | null }[]>(`${base}/directory`),
  create: (value: { name?: string; month: string; lotIds: number[] }) => http.post<AttendancePeriod>(base, value),
  review: (id: number, lotId: string) => http.get<AttendancePeriodReview>(`${base}/${id}/lots/${lotId}`),
  confirm: (id: number, lotId: string, value: { revision: number; reason: string }) => http.post<AttendancePeriodReview>(`${base}/${id}/lots/${lotId}/confirm`, value),
  lock: (id: number, value: { revision: number; reason: string; acknowledgeUnconfirmed: boolean }) => http.post<AttendancePeriod>(`${base}/${id}/lock`, value),
  reviewAssignment: (id: number, value: AttendanceCommand) => http.post<AttendanceDetail>(`/work-scheduling/assignments/${id}/attendance/review`, value),
  overtime: (id: number, value: AttendanceCommand & { approved: boolean; decisionId: number }) => http.post<AttendanceDetail>(`/work-scheduling/assignments/${id}/attendance/overtime`, value),
  managerDay: (lotId: string, value: { managerUserId: string; workDate: string; kind: ManagerDayKind; revision: number; reason: string }) => http.put<ManagerDay>(`${base}/manager-days/lots/${lotId}`, value),
  carry: (id: number, value: { revision: number; sourcePeriodLotId: number; employeeId: number; assignmentId?: number; hours: number; reason: string }) => http.post(`${base}/lots/${id}/carry-adjustments`, value),
}
