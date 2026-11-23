import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { CalendarDays, Clock, LockKeyhole, LogIn, Wallet } from 'lucide-react'
import { dutyApi } from '@/api/duty.service'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/states'
import { useDutyMutation, useDutyRealtime, useDutyStatus } from '@/hooks/useDuty'
import { clock, shiftLabel, slotHours, startsIn } from '@/lib/duty'
import type { DutyShift, DutyStatus } from '@/types/duty.dto'
import { t, tMaybe } from '@/i18n'

function StartButton({ size = 'default' }: { size?: 'sm' | 'default' | 'lg' }) {
  const start = useDutyMutation('Shift started. The POS is open.')
  return (
    <Button variant="success" size={size} disabled={start.isPending} onClick={() => start.mutate(() => dutyApi.startShift())}>
      {start.isPending ? <Spinner /> : <LogIn />}{t('Start shift')}
    </Button>
  )
}

function NextShift({ shift }: { shift: DutyShift | null }) {
  if (!shift) return <p className="text-slate-700">{t('No upcoming shifts.')}</p>
  return (
    <p className="text-slate-700">
      {t('Next shift:')}{' '}<strong className="text-slate-950">{tMaybe(shiftLabel(shift.date, shift.slot))}</strong>
      <span className="text-slate-500"> · {startsIn(shift.startsAt)}</span>
    </p>
  )
}

/** The shift's fixed break. Display only: the POS keeps working during it. */
function BreakNote({ shift }: { shift: DutyShift }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  if (!shift.breakStartsAt || !shift.breakEndsAt) return null
  const starts = new Date(shift.breakStartsAt).getTime()
  const ends = new Date(shift.breakEndsAt).getTime()
  if (now >= ends) return null
  if (now >= starts)
    return <span className="font-semibold text-sky-700">{' '}{t('· On break until {v}', { v: clock(shift.breakEndsAt) })}</span>
  return <span className="text-slate-500">{' '}{t('· break {v}–{v2}', { v: clock(shift.breakStartsAt), v2: clock(shift.breakEndsAt) })}</span>
}

/**
 * Staff console banner: start the shift when its window is open, or end it while on shift.
 * Nothing is shown when the Staff has no shift around now.
 */
export function ShiftBanner() {
  useDutyRealtime()
  const status = useDutyStatus()
  const s = status.data
  if (!s?.current) return null
  if (s.canStart)
    return (
      <div role="status" className="mx-auto mb-4 flex max-w-[1400px] flex-wrap items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-200">
        <Clock className="size-5 text-emerald-700" />
        <p className="min-w-0 flex-1 text-sm font-semibold text-emerald-900">
          {t('Your shift')}{' '}{slotHours(s.current.date, s.current.slot)} {new Date(s.current.startsAt).getTime() <= Date.now() ? 'has started: you will be marked late' : t('starts {v}', { v: startsIn(s.current.startsAt) })}.
          {s.requireShiftForPos && t(' Start it to use the POS.')}
        </p>
        <StartButton size="sm" />
      </div>
    )
  if (s.onShift)
    return (
      <div className="mx-auto mb-4 flex max-w-[1400px] flex-wrap items-center gap-3 rounded-xl bg-white px-4 py-2.5 ring-1 ring-slate-200">
        <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
        <p className="min-w-0 flex-1 text-sm text-slate-700">
          {t('On shift')}{' '}<strong className="text-slate-950">{slotHours(s.current.date, s.current.slot)}</strong>{' '}{t('since')}{' '}{clock(s.current.checkInAt)}
          {s.current.isLate && <span className="text-amber-700">{' '}{t('· late')}</span>}
          <span className="text-slate-500">{' '}{t('· ends by itself at')}{' '}{clock(s.current.endsAt)}</span>
          <BreakNote shift={s.current} />
        </p>
      </div>
    )
  return null
}

const posOpen = (s: DutyStatus) => !s.requireShiftForPos || s.onShift

/** POS pages: shown only while the Staff is on shift; otherwise a locked screen with the shift to start or the next one. */
export function PosShiftGate({ children }: { children: ReactNode }) {
  const status = useDutyStatus()
  if (status.isPending) return <Skeleton className="h-96 rounded-xl" />
  // Status unavailable (network): let the page load; the backend still refuses actions off shift
  if (!status.data || posOpen(status.data)) return <>{children}</>
  const s = status.data
  return (
    <Card className="mx-auto max-w-xl space-y-4 p-6 text-center sm:p-8">
      <LockKeyhole className="mx-auto size-10 text-slate-400" />
      <div>
        <h1 className="text-xl font-semibold text-slate-950">{t('Available during your shift')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('Gate, checkout, exceptions, cash and verifications open once you start your shift.')}</p>
      </div>
      {s.canStart && s.current ? (
        <div className="space-y-3">
          <p className="text-slate-700">{t('Your shift')}{' '}<strong>{tMaybe(shiftLabel(s.current.date, s.current.slot))}</strong>{' '}{t('is open.')}</p>
          <StartButton size="lg" />
        </div>
      ) : <NextShift shift={s.next} />}
      <Button asChild variant="outline"><Link to="/staff/work-schedule"><CalendarDays />{t('Duty board')}</Link></Button>
    </Card>
  )
}

/** Staff start page: the POS when on shift (or about to start), otherwise Off duty. */
export function StaffHome() {
  const status = useDutyStatus()
  if (status.isPending) return <Skeleton className="h-96 rounded-xl" />
  const s = status.data
  return <Navigate to={!s || posOpen(s) || s.canStart ? '/staff/gate' : '/staff/off-duty'} replace />
}

/** Staff off shift: the next shift and shortcuts to what they can still do. */
export function OffDutyPanel() {
  const status = useDutyStatus()
  if (status.isPending) return <Skeleton className="h-72 rounded-xl" />
  const s = status.data
  if (s && posOpen(s)) return <Navigate to="/staff/gate" replace />
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card className="space-y-4 p-6 sm:p-8">
        <div>
          <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">{s?.employmentType === 'Backup' ? t('Backup Staff') : t('Gate staff')}</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">{t('You\'re off duty')}</h1>
        </div>
        {s?.canStart && s.current ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-slate-700">{t('Your shift')}{' '}<strong>{tMaybe(shiftLabel(s.current.date, s.current.slot))}</strong>{' '}{t('is open.')}</p>
            <StartButton />
          </div>
        ) : <NextShift shift={s?.next ?? null} />}
      </Card>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button asChild variant="outline" size="lg" className="justify-start"><Link to="/staff/work-schedule"><CalendarDays />{t('Duty board & leave')}</Link></Button>
        <Button asChild variant="outline" size="lg" className="justify-start"><Link to="/staff/payroll"><Wallet />{t('My payslips')}</Link></Button>
      </div>
    </div>
  )
}
