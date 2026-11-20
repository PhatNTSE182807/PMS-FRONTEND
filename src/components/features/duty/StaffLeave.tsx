import { useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import { dutyApi } from '@/api/duty.service'
import { getErrorMessage } from '@/api/apiError'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/form-controls'
import { ErrorState, Spinner } from '@/components/ui/states'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useDutyMutation, useLeavePreview, useMyLeave } from '@/hooks/useDuty'
import { LEAVE_TONE, fullDate, leaveRange, shiftLabel } from '@/lib/duty'
import { toIsoDate } from '@/lib/format'
import { t, tMaybe } from '@/i18n'


function RequestLeaveDialog({ onClose }: { onClose: () => void }) {
  const today = toIsoDate(new Date())
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [reason, setReason] = useState('')
  const range = useDebouncedValue(`${from}|${to}`, 250)
  const [pf, pt] = range.split('|')
  const preview = useLeavePreview(pf, pt)
  const send = useDutyMutation('Leave request sent to your Manager.')
  const problem = preview.data?.problem
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <h2 className="text-xl font-semibold text-slate-950">{t('Request leave')}</h2>
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault()
          send.mutate(() => dutyApi.requestLeave({ fromDate: from, toDate: to, reason }), { onSuccess: onClose })
        }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Label className="grid gap-1">{t('From')}<Input type="date" required min={today} value={from}
              onChange={(e) => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value) }} /></Label>
            <Label className="grid gap-1">{t('To')}<Input type="date" required min={from} value={to} onChange={(e) => setTo(e.target.value)} /></Label>
          </div>
          <Label className="grid gap-1">{t('Reason')}
            <textarea required maxLength={500} rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:outline-2 focus:outline-indigo-500" />
          </Label>
          <div className="rounded-lg bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
            {preview.isPending ? <Spinner /> : preview.data ? (
              <div className="space-y-2">
                <p className="text-slate-800">
                  {t('{calendarDays} day(s) · {length} shift(s) ·', { calendarDays: preview.data.calendarDays, length: preview.data.shifts.length })}
                  <strong>{tMaybe(preview.data.paidDays)}</strong>{' '}{t('paid,')}{' '}<strong>{tMaybe(preview.data.unpaidDays)}</strong>{' '}{t('unpaid')}
                </p>
                {preview.data.shifts.length > 0 && (
                  <ul className="flex flex-wrap gap-1">{preview.data.shifts.map((s) => <li key={`${s.date}:${s.slot}`}><Badge>{tMaybe(shiftLabel(s.date, s.slot))}</Badge></li>)}</ul>
                )}
                {problem && <p role="alert" className="font-medium text-rose-700">{tMaybe(problem)}</p>}
              </div>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={send.isPending || !reason.trim() || Boolean(problem) || preview.isPending}>{send.isPending && <Spinner />}{t('Send request')}</Button>
            <Button variant="outline" onClick={onClose}>{t('Cancel')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Staff: paid leave left, the request button and their requests. */
export function StaffLeave() {
  const leave = useMyLeave()
  const cancel = useDutyMutation('Leave request cancelled.')
  const [asking, setAsking] = useState(false)
  if (leave.isPending) return <Card className="p-6"><Spinner /></Card>
  if (leave.isError) return <Card><ErrorState message={tMaybe(getErrorMessage(leave.error))} onRetry={() => leave.refetch()} /></Card>
  const { balance, requests, noLeaveUntil } = leave.data
  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{t('My leave')}</h2>
          <p className="text-sm text-slate-600">
            {t('{remainingPaidDays} of {entitledDays} paid days left in {year} · {daysThisMonth} of {maxDaysPerMonth} days used this month', { remainingPaidDays: balance.remainingPaidDays, entitledDays: balance.entitledDays, year: balance.year, daysThisMonth: balance.daysThisMonth, maxDaysPerMonth: balance.maxDaysPerMonth })}
          </p>
        </div>
        <Button onClick={() => setAsking(true)} disabled={Boolean(noLeaveUntil)}><CalendarPlus />{t('Request leave')}</Button>
      </div>
      {noLeaveUntil && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{t('Leave is not available in your first month. You can ask from')}{' '}{fullDate(noLeaveUntil)}.</p>}
      {requests.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{leaveRange(r)}</p>
                <p className="truncate text-xs text-slate-600">{tMaybe(r.reason)}{r.decisionReason ? t(' · Manager: {decisionReason}', { decisionReason: r.decisionReason }) : ''}</p>
              </div>
              {r.status === 'Approved' && <span className="text-xs text-slate-600">{t('{paidDays} paid · {unpaidDays} unpaid', { paidDays: r.paidDays, unpaidDays: r.unpaidDays })}</span>}
              <Badge tone={LEAVE_TONE[r.status]}>{tMaybe(r.status)}</Badge>
              {r.status === 'Pending' && (
                <Button size="sm" variant="ghost" disabled={cancel.isPending} onClick={() => cancel.mutate(() => dutyApi.cancelLeave(r.id))}>{t('Cancel')}</Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {asking && <RequestLeaveDialog onClose={() => setAsking(false)} />}
    </Card>
  )
}
