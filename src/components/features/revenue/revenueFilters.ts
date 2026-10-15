import { toIsoDate } from '@/lib/format'
import type { PaymentMethod, ReportVehicleType } from '@/types/report.dto'

export type DatePreset = 'today' | 'last7' | 'thisMonth' | 'thisQuarter' | 'thisYear' | 'custom'

export const DATE_PRESETS: { value: Exclude<DatePreset, 'custom'>; label: string }[] = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'last7', label: '7 ngày qua' },
  { value: 'thisMonth', label: 'Tháng này' },
  { value: 'thisQuarter', label: 'Quý này' },
  { value: 'thisYear', label: 'Năm nay' },
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
  { value: 'ALL', label: 'Tất cả phương tiện' },
  { value: 'CAR', label: 'Ô tô' },
  { value: 'MOTORBIKE', label: 'Xe máy' },
  { value: 'BICYCLE', label: 'Xe đạp / Xe điện' },
]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  QR_BANKING: 'QR Pay / Chuyển khoản',
  RFID_WALLET: 'Ví điện tử / Thẻ từ',
  CASH: 'Tiền mặt',
}
