import { t } from '@/i18n'
import { readLanguage } from '@/i18n/language'

/** Payslip lines are stored as English text; old payslips keep their "day(s)" wording. */
const LABELS: readonly [RegExp, string][] = [
  [/^Base salary \((\d+) of (\d+) days\)$/, 'Lương cơ bản ($1/$2 ngày)'],
  [/^Base salary from (\S+) \((\d+) of (\d+) days\)$/, 'Lương cơ bản từ $1 ($2/$3 ngày)'],
  [/^Base salary$/, 'Lương cơ bản'],
  [/^Absent (\d+) shift\(s\)$/, 'Vắng $1 ca'],
  [/^Absent (\d+) day\(s\)$/, 'Vắng $1 ngày'],
  [/^Late (\d+) shift\(s\)$/, 'Đi muộn $1 ca'],
  [/^Unpaid leave (\d+) shift\(s\)$/, 'Nghỉ không lương $1 ca'],
  [/^Unpaid leave (\d+) day\(s\)$/, 'Nghỉ không lương $1 ngày'],
  [/^Extra shifts \((\d+)h\)$/, 'Ca làm thêm ($1 giờ)'],
  [/^Hours worked \((\d+)h\)$/, 'Giờ làm ($1 giờ)'],
  [/^Adjustment: (.*)$/s, 'Điều chỉnh: $1'],
  [/^Net pay cannot go below 0$/, 'Lương thực nhận không thể dưới 0'],
  [/^(.*) \((\d+) min late\)$/, '$1 (muộn $2 phút)'],
  [/^(.*) \((\d+) min\)$/, '$1 ($2 phút)'],
]

/** A payslip line or one of its details in the current language. */
export function payLineLabel(text: string): string {
  if (readLanguage() !== 'vi') return text
  for (const [pattern, vi] of LABELS) if (pattern.test(text)) return text.replace(pattern, vi)
  return t(text)
}
