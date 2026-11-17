import { http } from './axiosClient'
import type { PayrollAdjustment, PayrollAudit, PayrollDetail, PayrollDirectory, PayrollFrozenSource, PayrollPreview, PayrollRole, PayrollSlip, PayrollSource, SalaryProfile } from '@/types/payroll.dto'
const base = '/payroll'
export const payrollApi = {
  directory: () => http.get<PayrollDirectory>(`${base}/directory`),
  profiles: (lotId?: string) => http.get<SalaryProfile[]>(`${base}/profiles`, { params: { lotId } }),
  saveProfile: (value: Partial<SalaryProfile>, id?: number) => id ? http.put<SalaryProfile>(`${base}/profiles/${id}`, value) : http.post<SalaryProfile>(`${base}/profiles`, value),
  sources: (lotId: string) => http.get<PayrollSource[]>(`${base}/sources`, { params: { lotId } }),
  seal: (id: number, value: { reason: string; managerUserId?: string }) => http.post(`${base}/sources/${id}/seal`, value),
  preview: (value: { parkingLotId: number; payMonth: string; role?: PayrollRole; userId?: string }) => http.post<PayrollPreview[]>(`${base}/preview`, value),
  generate: (value: { parkingLotId: number; payMonth: string; role?: PayrollRole; userId?: string; reason: string }) => http.post<PayrollSlip[]>(`${base}/generate`, value),
  slips: (lotId?: string, month?: string, mine = false) => http.get<PayrollSlip[]>(`${base}/slips`, { params: { lotId, month, mine } }),
  detail: (id: number) => http.get<PayrollDetail>(`${base}/slips/${id}`),
  source: (id: number, lineId: number) => http.get<PayrollFrozenSource>(`${base}/slips/${id}/lines/${lineId}/source`),
  action: (id: number, action: 'approve' | 'paid', value: { revision: number; reason: string; paidAt?: string; transactionReference?: string }) => http.post<PayrollDetail>(`${base}/slips/${id}/${action}`, value),
  adjustments: (lotId: string, month: string) => http.get<PayrollAdjustment[]>(`${base}/adjustments`, { params: { lotId, month } }),
  addAdjustment: (value: Omit<PayrollAdjustment, 'id'>) => http.post<PayrollAdjustment>(`${base}/adjustments`, value),
  complain: (id: number, reason: string) => http.post(`${base}/slips/${id}/complaints`, { reason }),
  resolve: (id: number, value: { revision: number; action: 'Accept' | 'Reject'; reason: string; adjustment?: { payMonth: string; quantity: number; unitRate: number; reason: string } }) => http.post(`${base}/complaints/${id}/resolve`, value),
  audit: (lotId?: string) => http.get<PayrollAudit[]>(`${base}/audit`, { params: { lotId } }),
}
