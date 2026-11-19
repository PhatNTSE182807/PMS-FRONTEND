import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { DutyBoard, DutyWeekNav } from '@/components/features/duty/DutyBoard'
import { StaffLeave } from '@/components/features/duty/StaffLeave'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/card'
import { Checkbox, Label } from '@/components/ui/form-controls'
import { ErrorState, Spinner } from '@/components/ui/states'
import { useStaffDutyWeek } from '@/hooks/useDuty'
import { addDays, mondayOf } from '@/lib/duty'
import { toIsoDate } from '@/lib/format'

/** Staff: the lot's duty board (who works which shift), read only, plus their leave. */
export default function StaffWorkSchedulePage() {
  const thisWeek = mondayOf(toIsoDate(new Date()))
  const [weekStart, setWeekStart] = useState(thisWeek)
  const [onlyMine, setOnlyMine] = useState(false)
  const week = useStaffDutyWeek(weekStart)
  const myShifts = week.data?.cells.filter((c) => c.isMine).length ?? 0
  return (
    <div className="space-y-6">
      <PageHeader title="Duty board" eyebrow={week.data?.lotName}
        description="Who works each shift at your lot. Your shifts are highlighted."
        actions={<CalendarDays className="size-9 text-indigo-700" />} />
      <Card className="space-y-4 p-4 sm:p-5">
        {week.isPending ? <Spinner /> : week.isError ? (
          <ErrorState message={getErrorMessage(week.error)} onRetry={() => week.refetch()} />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <DutyWeekNav weekStart={week.data.weekStart} today={week.data.today} onChange={setWeekStart} maxWeekStart={addDays(thisWeek, 28)} />
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-600">{myShifts} shift(s) for you this week</span>
                <Label className="flex items-center gap-2"><Checkbox checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />Only my shifts</Label>
              </div>
            </div>
            <DutyBoard week={week.data} onlyMine={onlyMine} />
          </>
        )}
      </Card>
      <StaffLeave />
    </div>
  )
}
