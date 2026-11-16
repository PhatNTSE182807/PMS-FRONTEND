import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { useMyWorkSchedule } from '@/hooks/useWorkScheduling'
import { useStaffLot } from '@/hooks/useStaffLot'
import { getErrorMessage } from '@/api/apiError'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/card'
import { ErrorState, Spinner } from '@/components/ui/states'
import WorkScheduleCalendar, { ScheduleToolbar } from '@/components/features/manager/WorkScheduleCalendar'
import { calendarRange, type CalendarView } from '@/lib/workScheduleCalendar'
import { toIsoDate } from '@/lib/format'
import WorkRequestsBoard from '@/components/features/manager/WorkRequestsBoard'

export default function StaffWorkSchedulePage() {
  const today = toIsoDate(new Date())
  const [anchor, setAnchor] = useState(today)
  const [view, setView] = useState<CalendarView>('week')
  const [search, setSearch] = useState('')
  const { lots, lot, setLotId } = useStaffLot()
  const range = calendarRange(anchor, view)
  const schedule = useMyWorkSchedule(range.from, range.to)
  const rosters = (schedule.data ?? []).filter(r => r.status === 'Published' && r.parkingLotId.toString() === lot?.id)
  return <div className="space-y-6">
    <PageHeader title="My work schedule" description="Your published assignments, grouped by shift and start date. All times use the parking lot's local time." actions={<CalendarDays className="size-9 text-indigo-700" />} />
    {lot && <WorkRequestsBoard key={lot.id} lotId={lot.id} />}
    <Card className="min-w-0 overflow-hidden">
      <ScheduleToolbar anchor={anchor} view={view} search={search} today={today} onAnchor={setAnchor} onView={setView} onSearch={setSearch}
        lots={lots.data ?? []} lotId={lot?.id ?? ''} onLot={setLotId} />
      {lots.isPending || schedule.isPending ? <div className="p-8"><Spinner /></div>
        : (lots.isError && !lots.data) || (schedule.isError && !schedule.data) ? <ErrorState message={getErrorMessage(lots.error ?? schedule.error)} onRetry={() => { void lots.refetch(); void schedule.refetch() }} />
          : <WorkScheduleCalendar rosters={rosters} range={range} search={search} today={today} />}
    </Card>
  </div>
}
