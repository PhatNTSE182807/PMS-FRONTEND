import { http } from './axiosClient'
import type { PayAdjustmentInput, PayAllResult, PayrollFilter, PayrollReport, PaySlip, SimulatePayInput } from '@/types/payroll.dto'

/** Payslips (backend PayrollController and AdminPayrollController). */
export const payrollApi = {
  // Staff and Managers
  mine: () => http.get<PaySlip[]>('/payroll/mine'),
  simulation: () => http.get<{ enabled: boolean }>('/payroll/simulation'),
  simulate: (input: SimulatePayInput) => http.post<PaySlip>('/payroll/simulate', input),
  mySlip: (id: number) => http.get<PaySlip>(`/payroll/slips/${id}`),

  // Admin
  report: (filter: PayrollFilter) => http.get<PayrollReport>('/admin/payroll', { params: filter }),
  payAll: (month: string) => http.post<PayAllResult>('/admin/payroll/pay-all', { month }),
  slip: (id: number) => http.get<PaySlip>(`/admin/payroll/slips/${id}`),
  adjust: (input: PayAdjustmentInput) => http.post<PayrollReport>('/admin/payroll/adjustments', input),
}
