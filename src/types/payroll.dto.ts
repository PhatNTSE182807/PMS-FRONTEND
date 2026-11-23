/** Payslips. Mirrors the backend's Models/DutySchedule/PayrollModels.cs. */

export type PayKind = 'FullTime' | 'Backup' | 'Manager'
export type PayStatus = 'Unpaid' | 'Paid' | 'Estimate'

export interface PayLine {
  kind: 'Base' | 'Absence' | 'Late' | 'UnpaidLeave' | 'ExtraHours' | 'Hours' | 'Adjustment' | 'NetFloor' | 'Simulated'
  label: string
  quantity: number
  unitAmount: number
  amount: number
  details: string[]
}

export interface PaySlip {
  id: number
  employeeId: number
  employeeName: string | null
  employeeCode: string | null
  parkingLotId: number | null
  lotName: string | null
  month: string
  kind: PayKind
  baseAmount: number
  deductions: number
  overtime: number
  adjustments: number
  netAmount: number
  status: PayStatus
  isSimulated: boolean
  paidAt: string | null
  lines: PayLine[]
}

export interface PayrollReport {
  month: string
  monthEnded: boolean
  unpaidCount: number
  unpaidTotal: number
  paidTotal: number
  simulatedTotal: number
  /** Leave requests of the month still waiting: it cannot be paid until they are decided. */
  pendingLeaveRequests: number
  /** Shifts of the month not closed yet: it cannot be paid until they are. */
  openShifts: number
  slips: PaySlip[]
}

export interface PayrollFilter {
  month: string
  lotId?: number
  kind?: PayKind
  status?: PayStatus
  includeSimulated: boolean
}

export interface PayAllResult {
  month: string
  paidCount: number
  total: number
}

export interface SimulatePayInput {
  includeBase: boolean
  overtimeHours: number
}

export interface PayAdjustmentInput {
  employeeId: number
  month: string
  amount: number
  reason: string
}
