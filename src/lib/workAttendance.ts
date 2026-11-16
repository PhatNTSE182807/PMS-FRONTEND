import type { AttendanceStatus } from '@/types/workScheduling.dto'

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  NotPublished: 'Draft · no attendance', Upcoming: 'Upcoming', StartWindow: 'Start window open',
  Working: 'Working', Completed: 'Completed', Absent: 'Absent', Untracked: 'Not tracked · review',
  Unavailable: 'Staff unavailable · review', StartClosed: 'Start closed · review',
  ApprovedLeave: 'Approved leave', Reassigned: 'Reassigned · history',
}

export function attendanceTime(value: string | null, zone?: string): string {
  if (!value) return 'Not recorded'
  const timeZone = zone === 'SE Asia Standard Time' ? 'Asia/Ho_Chi_Minh' : zone
  try { return new Intl.DateTimeFormat('en-GB', { timeZone, dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value)) }
  catch { return new Date(value).toLocaleString() }
}

export function attendanceLocalInput(value: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
