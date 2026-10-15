import { toIsoDate } from '@/lib/format'
import type { PaymentMethod, ReportVehicleType } from '@/types/report.dto'

export type DatePreset = 'today' | 'last7' | 'thisMonth' | 'thisQuarter' | 'thisYear' | 'custom'

export const DATE_PRESETS: { value: Exclude<DatePreset, 'custom'>; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'thisQuarter', label: 'This quarter' },
  { value: 'thisYear', label: 'This year' },
]

/** Inclusive date range for a preset, ending today (local calendar). */
export function presetRange(preset: Exclude<DatePreset, 'custom'>, today = new Date()): { startDate: string; endDate: string } {
  const y = today.getFullYear()
  const m = today.getMonth()
  const start = {
    today: new Date(y, m, today.getDate()),
    last7: new Date(y, m, today.getDate() - 6),
    thisMonth: new Date(y, m, 1),
    thisQuarter: new Date(y, Math.floor(m / 3) * 3, 1),
    thisYear: new Date(y, 0, 1),
  }[preset]
  return { startDate: toIsoDate(start), endDate: toIsoDate(today) }
}

export const VEHICLE_TYPE_OPTIONS: { value: ReportVehicleType; label: string }[] = [
  { value: 'ALL', label: 'All vehicles' },
  { value: 'CAR', label: 'Car' },
  { value: 'MOTORBIKE', label: 'Motorbike' },
  { value: 'BICYCLE', label: 'Bicycle / E-bike' },
]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  QR_BANKING: 'QR Pay / Bank transfer',
  RFID_WALLET: 'E-wallet / RFID card',
  CASH: 'Cash',
}
