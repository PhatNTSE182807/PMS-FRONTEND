import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DUTY_SLOTS, addDays, cellKey, clock, dayMonth, mondayOf, weekDates, weekdayOf } from '@/lib/duty'
import { cn } from '@/lib/utils'
import type { DutyCell, DutyWeek } from '@/types/duty.dto'
import { t, tMaybe } from '@/i18n'

interface DutyWeekNavProps {
  weekStart: string
  today: string
  onChange: (weekStart: string) => void
  /** Last Monday the viewer may open (Staff: 4 weeks ahead). */
  maxWeekStart?: string
}

/** Previous / This week / Next week, with the dates of the week. */
export function DutyWeekNav({ weekStart, today, onChange, maxWeekStart }: DutyWeekNavProps) {
  const thisWeek = mondayOf(today)
  const end = addDays(weekStart, 6)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => onChange(addDays(weekStart, -7))} aria-label={t('Previous week')}>
        <ChevronLeft />
        <span className="hidden sm:inline">{t('Previous week')}</span>
      </Button>
      <Button variant={weekStart === thisWeek ? 'default' : 'outline'} size="sm" onClick={() => onChange(thisWeek)}>
        {t('This week')}
      </Button>
      <Button variant="outline" size="sm" onClick={() => onChange(addDays(weekStart, 7))} aria-label={t('Next week')}
        disabled={maxWeekStart != null && weekStart >= maxWeekStart}>
        <span className="hidden sm:inline">{t('Next week')}</span>
        <ChevronRight />
      </Button>
      <p className="text-sm font-semibold text-slate-700">
        {dayMonth(weekStart)} – {dayMonth(end)}/{end.slice(0, 4)}
      </p>
    </div>
  )
}

interface DutyBoardProps {
  week: DutyWeek
  /** Manager: open a shift to change it. Staff boards are read only. */
  onCell?: (cell: DutyCell) => void
  /** Staff: show only their own shifts. */
  onlyMine?: boolean
}

function AttendanceBadge({ cell }: { cell: DutyCell }) {
  if (cell.attendanceStatus === 'Absent') return <Badge tone="rose">{t('Absent')}</Badge>
  const late = cell.isLate ? <Badge tone="amber">{t('Late ·')}{' '}{clock(cell.checkInAt)}</Badge> : null
  if (cell.attendanceStatus === 'Working') return <>{tMaybe(late) ?? <Badge tone="emerald">{t('On shift ·')}{' '}{clock(cell.checkInAt)}</Badge>}</>
  if (cell.attendanceStatus === 'Completed') return <>{tMaybe(late)}<Badge tone="neutral">{clock(cell.checkInAt)}–{clock(cell.checkOutAt)}</Badge></>
  return null
}

function CellBody({ cell, hidden }: { cell: DutyCell; hidden: boolean }) {
  if (hidden) return <span className="text-xs text-slate-400">—</span>
  return (
    <span className="flex min-w-0 flex-col items-start gap-1">
      {cell.employeeName ? (
        <span className="w-full truncate text-sm font-semibold text-slate-900">{tMaybe(cell.employeeName)}</span>
      ) : (
        <span className="text-sm font-semibold text-rose-700">{cell.isPast ? t('Nobody') : t('No staff')}</span>
      )}
      <span className="flex flex-wrap gap-1">
        {cell.isMine && <Badge tone="indigo">{t('You')}</Badge>}
        {cell.employmentType === 'Backup' && <Badge tone="violet">{t('Backup')}</Badge>}
        {cell.onLeaveName && <Badge tone="amber">{t('{onLeaveName} on leave', { onLeaveName: cell.onLeaveName })}</Badge>}
        {cell.leavePending && <Badge tone="amber">{t('Leave pending')}</Badge>}
        {cell.isOneDayChange && !cell.onLeaveName && <Badge tone="sky">{t('This day only')}</Badge>}
        <AttendanceBadge cell={cell} />
      </span>
    </span>
  )
}

/**
 * The lot's week: 4 shifts (rows) × 7 days (columns). Scrolls sideways on a phone inside its card.
 * Empty upcoming shifts are red; today's column is highlighted; past shifts are dimmed.
 */
export function DutyBoard({ week, onCell, onlyMine = false }: DutyBoardProps) {
  const dates = weekDates(week.weekStart)
  const byKey = new Map(week.cells.map((c) => [cellKey(c), c]))
  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
      <table className="w-full min-w-[860px] table-fixed border-collapse text-left">
        <caption className="sr-only">{t('Duty board from {weekStart}', { weekStart: week.weekStart })}</caption>
        <thead>
          <tr className="bg-slate-50">
            <th scope="col" className="w-28 border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 uppercase">{t('Shift')}</th>
            {dates.map((date) => (
              <th key={date} scope="col"
                className={cn('border-b border-l border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800', date === week.today && 'bg-indigo-50 text-indigo-800')}>
                {weekdayOf(date)} <span className="font-normal text-slate-500">{dayMonth(date)}</span>
                {date === week.today && <span className="ml-1 text-xs font-bold">{t('· Today')}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DUTY_SLOTS.map(({ slot, label, hours }) => (
            <tr key={slot}>
              <th scope="row" className="border-b border-slate-200 bg-slate-50 px-3 py-3 align-top">
                <span className="block text-sm font-semibold text-slate-800">{tMaybe(label)}</span>
                <span className="block text-xs text-slate-500">{tMaybe(hours)}</span>
              </th>
              {dates.map((date) => {
                const cell = byKey.get(`${date}:${slot}`)
                if (!cell) return <td key={date} className="border-b border-l border-slate-200" />
                const hidden = onlyMine && !cell.isMine
                const empty = !cell.employeeId && !cell.isPast
                const className = cn(
                  'h-full min-h-20 w-full px-3 py-2.5 text-left align-top',
                  empty && !hidden && 'bg-rose-50',
                  cell.isMine && 'bg-indigo-50/70',
                  cell.isPast && 'opacity-60',
                  date === week.today && !empty && !cell.isMine && 'bg-indigo-50/30',
                )
                return (
                  <td key={date} className="h-px border-b border-l border-slate-200 p-0 align-top">
                    {onCell && !cell.isPast ? (
                      <button type="button" onClick={() => onCell(cell)}
                        className={cn(className, 'block transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-600')}
                        aria-label={t('{v} {v2} {hours}: {v3}. Change', { v: weekdayOf(date), v2: dayMonth(date), hours, v3: cell.employeeName ?? 'no staff' })}>
                        <CellBody cell={cell} hidden={hidden} />
                      </button>
                    ) : onCell ? (
                      <button type="button" onClick={() => onCell(cell)} className={cn(className, 'block hover:bg-slate-100')}
                        aria-label={t('{v} {v2} {hours}: {v3}. Attendance', { v: weekdayOf(date), v2: dayMonth(date), hours, v3: cell.employeeName ?? 'nobody' })}>
                        <CellBody cell={cell} hidden={hidden} />
                      </button>
                    ) : (
                      <div className={className}><CellBody cell={cell} hidden={hidden} /></div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
