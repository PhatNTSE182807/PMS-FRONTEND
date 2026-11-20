import { useState } from 'react'
import { CalendarOff } from 'lucide-react'
import { dutyApi } from '@/api/duty.service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input, Label, NativeSelect } from '@/components/ui/form-controls'
import { EmptyState, ErrorState, Spinner } from '@/components/ui/states'
import { getErrorMessage } from '@/api/apiError'
import { useDutyCandidates, useDutyMutation, useLotLeave } from '@/hooks/useDuty'
import { LEAVE_TONE, leaveRange, shiftLabel } from '@/lib/duty'
import type { LeaveRequest, LeaveShift } from '@/types/duty.dto'
import { t, tMaybe } from '@/i18n'



function ReplacementRow({ lotId, shift, requesterId, value, onChange }: {
  lotId: string; shift: LeaveShift; requesterId: number; value: number | ''; onChange: (id: number | '') => void
}) {
  const candidates = useDutyCandidates(lotId, shift.date, shift.slot, requesterId)
  return (
    <li className="grid gap-2 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200 sm:grid-cols-[1fr_16rem] sm:items-center">
      <span className="text-sm font-semibold text-slate-900">{tMaybe(shiftLabel(shift.date, shift.slot))}</span>
      <NativeSelect aria-label={t('Replacement for {v}', { v: shiftLabel(shift.date, shift.slot) })} value={value}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}>
        <option value="">{t('Leave empty for now')}</option>
        {(candidates.data ?? []).filter((c) => c.eligible).map((c) => (
          <option key={c.employeeId} value={c.employeeId}>
            {c.fullName}{c.employmentType === 'Backup' ? t(' (Backup)') : ''}{c.warning ? ` · ${c.warning}` : ''}
          </option>
        ))}
      </NativeSelect>
    </li>
  )
}

function DecisionDialog({ lotId, request, onClose }: { lotId: string; request: LeaveRequest; onClose: () => void }) {
  const approve = useDutyMutation('Leave approved.')
  const reject = useDutyMutation('Leave rejected.')
  const [picked, setPicked] = useState<Record<string, number | ''>>({})
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const busy = approve.isPending || reject.isPending
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <div>
          <p className="text-xs font-bold tracking-wide text-amber-700 uppercase">{t('Leave request')}</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">{tMaybe(request.employeeName)} · {leaveRange(request)}</h2>
          <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-wrap text-slate-800">{tMaybe(request.reason)}</p>
          <p className="mt-2 text-sm text-slate-700">
            {t('If approved:')}{' '}<strong>{tMaybe(request.paidDays)}</strong>{' '}{t('paid day(s),')}{' '}<strong>{tMaybe(request.unpaidDays)}</strong>{' '}{t('unpaid day(s).')}
          </p>
        </div>

        {request.shifts.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-800">{t('Who takes each shift')}</p>
            <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {request.shifts.map((s) => {
                const key = `${s.date}:${s.slot}`
                return <ReplacementRow key={key} lotId={lotId} shift={s} requesterId={request.employeeId} value={picked[key] ?? ''}
                  onChange={(id) => setPicked((p) => ({ ...p, [key]: id }))} />
              })}
            </ul>
            <p className="text-xs text-slate-600">{t('Shifts left empty show in red on the board; you can fill them later.')}</p>
          </div>
        ) : <p className="text-sm text-slate-700">{t('No shifts in these days.')}</p>}

        {rejecting && (
          <Label className="grid gap-1">{t('Reason for rejecting')}
            <Input autoFocus maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('e.g. No staff available on these days')} />
          </Label>
        )}

        <div className="flex flex-wrap gap-2">
          {!rejecting ? (
            <>
              <Button disabled={busy} onClick={() => approve.mutate(() => dutyApi.approveLeave(lotId, request.id, {
                replacements: request.shifts.map((s) => {
                  const id = picked[`${s.date}:${s.slot}`]
                  return { date: s.date, slot: s.slot, employeeId: typeof id === 'number' ? id : null }
                }),
              }), { onSuccess: onClose })}>{approve.isPending && <Spinner />}{t('Approve')}</Button>
              <Button variant="outline" disabled={busy} onClick={() => setRejecting(true)}>{t('Reject…')}</Button>
            </>
          ) : (
            <>
              <Button variant="destructive" disabled={busy || !reason.trim()}
                onClick={() => reject.mutate(() => dutyApi.rejectLeave(lotId, request.id, { reason }), { onSuccess: onClose })}>
                {reject.isPending && <Spinner />}{t('Reject request')}
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => setRejecting(false)}>{t('Back')}</Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Manager: leave requests of the lot, waiting ones first. */
export function LeaveRequestsPanel({ lotId }: { lotId: string }) {
  const leave = useLotLeave(lotId)
  const [open, setOpen] = useState<LeaveRequest | null>(null)
  if (leave.isPending) return <Card className="p-6"><Spinner /></Card>
  if (leave.isError) return <Card><ErrorState message={tMaybe(getErrorMessage(leave.error))} onRetry={() => leave.refetch()} /></Card>
  const requests = leave.data
  if (requests.length === 0) return <Card><EmptyState icon={CalendarOff} title={t('No leave requests')} description={t('Requests from your Staff appear here.')} /></Card>
  return (
    <Card className="divide-y divide-slate-100">
      {requests.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900">{tMaybe(r.employeeName)} <span className="font-normal text-slate-600">· {leaveRange(r)}</span></p>
            <p className="truncate text-sm text-slate-600">{tMaybe(r.reason)}</p>
            {r.decisionReason && <p className="text-xs text-slate-500">{t('Note: {decisionReason}', { decisionReason: r.decisionReason })}</p>}
          </div>
          {r.status === 'Pending' && <span className="text-xs text-slate-600">{t('{length} shift(s)', { length: r.shifts.length })}</span>}
          <Badge tone={LEAVE_TONE[r.status]}>{tMaybe(r.status)}</Badge>
          {r.status === 'Pending' && <Button size="sm" onClick={() => setOpen(r)}>{t('Review')}</Button>}
        </div>
      ))}
      {open && <DecisionDialog lotId={lotId} request={open} onClose={() => setOpen(null)} />}
    </Card>
  )
}
