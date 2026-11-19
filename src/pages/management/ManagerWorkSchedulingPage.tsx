import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, CalendarDays } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { DutyBoard, DutyWeekNav } from '@/components/features/duty/DutyBoard'
import { DutyCellDialog } from '@/components/features/duty/DutyCellDialog'
import { LeaveRequestsPanel } from '@/components/features/duty/LeaveRequestsPanel'
import { WithManagerLot } from '@/components/features/manager/ManagerBits'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ErrorState, Spinner } from '@/components/ui/states'
import { useManagerDutyWeek } from '@/hooks/useDuty'
import { mondayOf } from '@/lib/duty'
import { toIsoDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DutyCell } from '@/types/duty.dto'
import type { ManagedLot } from '@/types/lot-management.dto'

function Board({ lot }: { lot: ManagedLot }) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(toIsoDate(new Date())))
  const [cell, setCell] = useState<DutyCell | null>(null)
  const week = useManagerDutyWeek(lot.id, weekStart)
  if (week.isPending) return <Card className="p-6"><Spinner /></Card>
  if (week.isError) return <Card><ErrorState message={getErrorMessage(week.error)} onRetry={() => week.refetch()} /></Card>
  const data = week.data
  const empty = data.cells.filter((c) => !c.employeeId && !c.isPast)
  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DutyWeekNav weekStart={data.weekStart} today={data.today} onChange={setWeekStart} />
        <p className="text-sm text-slate-600">{data.staff.filter((s) => s.isActive).length} Staff · click a shift to change it</p>
      </div>
      {empty.length > 0 && (
        <button type="button" onClick={() => setCell(empty[0])}
          className="flex w-full items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-left text-sm font-medium text-rose-800 ring-1 ring-rose-200 hover:bg-rose-100">
          <AlertTriangle className="size-4 shrink-0" />
          {empty.length} empty shift{empty.length === 1 ? '' : 's'} this week. Fill the first one
        </button>
      )}
      <DutyBoard week={data} onCell={setCell} />
      {cell && <DutyCellDialog lotId={lot.id} cell={cell} onClose={() => setCell(null)} />}
    </Card>
  )
}

function Scheduling({ lot }: { lot: ManagedLot }) {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'leave' ? 'leave' : 'board'
  const week = useManagerDutyWeek(lot.id, mondayOf(toIsoDate(new Date())))
  const pending = week.data?.pendingLeaveRequests ?? 0
  return (
    <div className="space-y-6">
      <PageHeader title="Work schedule" eyebrow={lot.name}
        description="Four 6-hour shifts a day. The weekly pattern repeats until you change it."
        actions={<CalendarDays className="size-9 text-indigo-700" />} />
      <div className="flex flex-wrap gap-2" role="tablist">
        {(['board', 'leave'] as const).map((value) => (
          <Button key={value} role="tab" aria-selected={tab === value} variant={tab === value ? 'default' : 'outline'}
            onClick={() => setParams(value === 'leave' ? { tab: 'leave' } : {}, { replace: true })}>
            {value === 'board' ? 'Duty board' : 'Leave requests'}
            {value === 'leave' && pending > 0 && (
              <span className={cn('rounded-full px-1.5 text-xs font-bold', tab === 'leave' ? 'bg-white/25' : 'bg-amber-100 text-amber-800')}>{pending}</span>
            )}
          </Button>
        ))}
      </div>
      {tab === 'board' ? <Board lot={lot} /> : <LeaveRequestsPanel lotId={lot.id} />}
    </div>
  )
}

export default function ManagerWorkSchedulingPage() {
  return <WithManagerLot>{(lot) => <Scheduling key={lot.id} lot={lot} />}</WithManagerLot>
}
