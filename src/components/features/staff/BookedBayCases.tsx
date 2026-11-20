import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { ArrowLeftRight, CalendarX, CircleCheck, HandCoins, ParkingSquare, TriangleAlert, Truck } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { vnd } from '@/components/features/manager/managerFormat'
import { Panel, Plate, SectionTitle } from '@/components/features/staff/StaffBits'
import { Button } from '@/components/ui/button'
import { FieldError, Label, NativeSelect } from '@/components/ui/form-controls'
import { Skeleton } from '@/components/ui/skeleton'
import { useBookedBayCases, useResolveBookedBay } from '@/hooks/useGate'
import { cn } from '@/lib/utils'
import type { BookedBayCaseDTO, BookedBayCaseStatus } from '@/types/operations.dto'
import { t, tMaybe, localDateFormat } from '@/i18n'

const clock = localDateFormat({ day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const at = (iso: string | null | undefined) => (iso ? clock.format(Date.parse(iso)) : '—')

const OUTCOME: Record<Exclude<BookedBayCaseStatus, 'Open'>, { label: string; className: string }> = {
  Relocated: { label: 'Towed', className: 'bg-orange-50 text-orange-800 ring-orange-200' },
  Reassigned: { label: 'Moved', className: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  Compensated: { label: 'Refunded & compensated', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  Closed: { label: 'Closed', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-slate-600">{tMaybe(label)}</dt>
      <dd className="text-right font-semibold text-slate-950">{children}</dd>
    </div>
  )
}

const towLabel = (bay: NonNullable<BookedBayCaseDTO['towBays']>[number]) =>
  `${bay.kind === 'Penalty' ? 'Penalty bay' : 'Walk-in bay'} ${bay.code}${bay.zoneName ? ` · ${bay.zoneName}` : ''}`

/**
 * One open case: who booked, who parked there, and the way out, in order: tow the vehicle to a penalty bay (or a
 * walk-in bay when every penalty bay is taken), move the booking, or, when nothing is left, refund and compensate.
 */
function OpenCase({ bayCase, lotId }: { bayCase: BookedBayCaseDTO; lotId: string }) {
  const resolve = useResolveBookedBay(lotId)
  const towBays = bayCase.towBays ?? []
  const canTow = bayCase.walkInInside && towBays.length > 0
  const [towTo, setTowTo] = useState<number | ''>(towBays[0]?.slotId ?? '')
  const [slotId, setSlotId] = useState<number | ''>(bayCase.freeBays[0]?.slotId ?? '')
  const [note, setNote] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasFreeBay = bayCase.freeBays.length > 0
  const payout = bayCase.depositHeld + bayCase.compensationAmount

  const tow = () => {
    if (towTo === '') return setError('Pick the bay to tow the vehicle to.')
    setError(null)
    resolve.mutate(
      { caseId: bayCase.id, kind: 'tow', slotId: towTo },
      {
        onSuccess: (r) =>
          toast.success(
            t('Vehicle towed to bay {towedToBayCode}. Booking {reservationCode} keeps bay {bayCode}; {v} penalty at check-out.', { towedToBayCode: r.towedToBayCode, reservationCode: r.reservationCode, bayCode: r.bayCode, v: vnd(r.penaltyFee ?? 0) }),
          ),
        onError: (e) => setError(getErrorMessage(e, 'Could not tow the vehicle.')),
      },
    )
  }

  const move = () => {
    if (slotId === '') return setError('Pick the bay to move the booking to.')
    setError(null)
    resolve.mutate(
      { caseId: bayCase.id, kind: 'reassign', slotId },
      {
        onSuccess: (r) => toast.success(t('Booking {reservationCode} moved to bay {newBayCode}. The customer was told and gets the first hour free.', { reservationCode: r.reservationCode, newBayCode: r.newBayCode })),
        onError: (e) => setError(getErrorMessage(e, 'Could not move the booking.')),
      },
    )
  }

  const compensate = () => {
    setError(null)
    resolve.mutate(
      { caseId: bayCase.id, kind: 'compensate', note: note.trim() || undefined },
      {
        onSuccess: (r) =>
          toast.success(
            t('Booking {reservationCode} cancelled: {v} went to the customer\'s XXIV wallet.', { reservationCode: r.reservationCode, v: vnd(r.depositRefunded + r.compensationPaid) }),
          ),
        onError: (e) => {
          setConfirming(false)
          setError(getErrorMessage(e, 'Could not cancel the booking.'))
        },
      },
    )
  }

  return (
    <article className="space-y-4 rounded-xl p-4 ring-1 ring-amber-300" aria-label={t('Bay {bayCode} taken', { bayCode: bayCase.bayCode })}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-base font-bold text-slate-950">
          <ParkingSquare className="size-5 text-amber-500" aria-hidden />{' '}{t('Bay {bayCode}', { bayCode: bayCase.bayCode })}
          <span className="font-mono text-sm font-semibold text-slate-600">{t('· booking {reservationCode}', { reservationCode: bayCase.reservationCode })}</span>
        </h3>
        <span className="text-xs text-slate-600">{t('Reported')}{' '}{at(bayCase.createdAt)}</span>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <dl className="space-y-1.5 rounded-lg bg-slate-50 p-3">
          <p className="mb-1 text-xs font-bold tracking-wider text-slate-700 uppercase">{t('Booked by')}</p>
          <Fact label={t('Customer')}>{tMaybe(bayCase.customerName) ?? '—'}</Fact>
          <Fact label={t('Vehicle')}>
            <Plate>{tMaybe(bayCase.bookedPlate) ?? '—'}</Plate> <span className="font-normal text-slate-700">{tMaybe(bayCase.vehicleTypeName)}</span>
          </Fact>
          <Fact label={t('Arrives')}>{at(bayCase.arrivalTime)}</Fact>
          <Fact label={t('Hold ends')}>{at(bayCase.holdEndsAt)}</Fact>
        </dl>
        <dl className="space-y-1.5 rounded-lg bg-slate-50 p-3">
          <p className="mb-1 text-xs font-bold tracking-wider text-slate-700 uppercase">
            {t('Parked there (')}{bayCase.offence === 'Overstay' ? 'stayed past its booking' : 'walk-in'})
          </p>
          <Fact label={t('Plate')}>
            <Plate>{tMaybe(bayCase.walkInPlate) ?? '—'}</Plate>
          </Fact>
          <Fact label={t('Entered')}>{at(bayCase.walkInEntryTime)}</Fact>
          <Fact label={t('Session')}>
            <span className="font-mono text-xs">{tMaybe(bayCase.walkInSessionCode)}</span>
          </Fact>
          <Fact label={t('Still inside')}>{bayCase.walkInInside ? t('Yes') : t('No')}</Fact>
        </dl>
      </div>

      {canTow && (
        <div className="space-y-2 rounded-lg bg-orange-50 p-3 ring-1 ring-orange-200">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1 space-y-1.5">
              <Label htmlFor={`bay-case-tow-${bayCase.id}`}>{t('Tow the vehicle to')}</Label>
              <NativeSelect id={`bay-case-tow-${bayCase.id}`} value={towTo} onChange={(e) => setTowTo(e.target.value ? Number(e.target.value) : '')}>
                {towBays.map((b) => (
                  <option key={b.slotId} value={b.slotId}>
                    {tMaybe(towLabel(b))}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button onClick={tow} disabled={resolve.isPending}>
              <Truck />{' '}{t('Tow vehicle')}
            </Button>
          </div>
          <p className="text-xs text-orange-900">
            {t('Recommended: the customer keeps the bay they booked. The towed vehicle pays a')}{' '}{vnd(bayCase.penaltyFee ?? 0)}{' '}{t('penalty at check-out')}
            {towBays[0]?.kind === 'Standard' ? t('. Every penalty bay is taken, so it goes to a free walk-in bay.') : '.'}
          </p>
        </div>
      )}

      {hasFreeBay ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1 space-y-1.5">
            <Label htmlFor={`bay-case-${bayCase.id}`}>{canTow ? t('Or move the booking to a free bay') : t('Move the booking to a free bay')}</Label>
            <NativeSelect id={`bay-case-${bayCase.id}`} value={slotId} onChange={(e) => setSlotId(e.target.value ? Number(e.target.value) : '')}>
              {bayCase.freeBays.map((b) => (
                <option key={b.slotId} value={b.slotId}>
                  {b.code}
                  {b.zoneName ? ` · ${b.zoneName}` : ''}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button variant={canTow ? 'outline' : 'default'} onClick={move} disabled={resolve.isPending}>
            <ArrowLeftRight />{' '}{t('Move booking')}
          </Button>
          <p className="w-full text-xs text-slate-600">
            {t('{length} free {v} bay', { length: bayCase.freeBays.length, v: bayCase.vehicleTypeName ?? '' })}{bayCase.freeBays.length === 1 ? '' : 's'}{t('. The customer is told the new bay and gets the first hour free. Cancelling with a refund is only possible when nothing can be towed and no bay is free.')}
          </p>
        </div>
      ) : canTow ? (
        <p className="text-xs text-slate-600">
          {t('No other {v} bay is free for the booking, so tow the vehicle. Cancelling with a refund is only possible when nothing can be towed.', { v: bayCase.vehicleTypeName ?? '' })}
        </p>
      ) : (
        <div className="space-y-3">
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t('Every penalty bay is taken and no other {v} bay is free. Cancel the booking: the deposit (', { v: bayCase.vehicleTypeName ?? '' })}{vnd(bayCase.depositHeld)}{t(') and the compensation (')}{vnd(bayCase.compensationAmount)}{t(') go to the customer\'s XXIV wallet, and the compensation comes off this lot\'s revenue.')}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor={`bay-case-note-${bayCase.id}`}>{t('Note (optional)')}</Label>
            <textarea
              id={`bay-case-note-${bayCase.id}`}
              rows={2}
              maxLength={500}
              className="w-full rounded-lg bg-well p-3 text-sm text-slate-950 ring-1 ring-slate-200 focus-visible:outline-none"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('e.g. every car bay is full until the evening')}
            />
          </div>
          {confirming ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="text-sm text-slate-950">{t('Pay')}{' '}{vnd(payout)}{' '}{t('into the customer\'s wallet and cancel the booking?')}</span>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={resolve.isPending}>
                {t('Back')}
              </Button>
              <Button variant="destructive" onClick={compensate} disabled={resolve.isPending}>
                <HandCoins />{' '}{t('Confirm')}
              </Button>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button variant="destructive" onClick={() => setConfirming(true)}>
                <CalendarX />{' '}{t('Cancel booking, refund and compensate')}
              </Button>
            </div>
          )}
        </div>
      )}
      {error && <FieldError message={tMaybe(error)} />}
    </article>
  )
}

/**
 * Booked bays a walk-in (or an overstaying vehicle) took (Exceptions screen): tow the vehicle to a penalty bay, move
 * the booking to a free bay of its type, or, when nothing is left, cancel it with the deposit and the lot's
 * compensation paid into the customer's XXIV wallet. Always shown,
 * so the Staff knows where these cases appear even before the first one.
 */
export function BookedBayCases({ lotId }: { lotId: string | undefined }) {
  const cases = useBookedBayCases(lotId)
  const all = cases.data ?? []
  const open = all.filter((c) => c.status === 'Open')
  const recent = all.filter((c) => c.status !== 'Open').slice(0, 5)

  return (
    <Panel id="booked-bay-cases" className={cn(open.length > 0 && 'ring-2 ring-amber-400')}>
      <SectionTitle
        icon={<ParkingSquare className="size-5 text-amber-500" aria-hidden />}
        aside={
          lotId && cases.isSuccess && <span className={cn('rounded px-2 py-0.5 text-xs font-bold', open.length ? 'bg-amber-50 text-amber-500' : 'bg-slate-100 text-slate-700')}>
            {open.length ? t('{length} to resolve', { length: open.length }) : t('All resolved')}
          </span>
        }
      >
        {t('Booked bays taken')}
      </SectionTitle>
      {!lotId && <p className="text-sm text-slate-700">{t('You are not assigned to a parking lot yet.')}</p>}
      {lotId && cases.isPending && <Skeleton className="h-48 rounded-xl" />}
      {cases.isError && (
        <p className="text-sm text-rose-700">{tMaybe(getErrorMessage(cases.error, 'Could not load the booked bay cases.'))}</p>
      )}
      <div className="space-y-4">
        {lotId &&
          open.map((c) => (
            <OpenCase key={c.id} bayCase={c} lotId={lotId} />
          ))}
        {lotId && open.length === 0 && !cases.isPending && !cases.isError && (
          <p className="flex items-center gap-2 text-sm text-slate-700">
            <CircleCheck className="size-4 text-emerald-600" aria-hidden />{' '}{t('No booked bay is taken right now.')}
          </p>
        )}
      </div>

      {recent.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-bold tracking-wider text-slate-700 uppercase">{t('Recently resolved')}</p>
          <ul className="divide-y divide-slate-200 rounded-lg ring-1 ring-slate-200">
            {recent.map((c) => {
              const outcome = OUTCOME[c.status as Exclude<BookedBayCaseStatus, 'Open'>]
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                  <span className="font-semibold text-slate-950">{t('Bay {bayCode}', { bayCode: c.bayCode })}</span>
                  <span className="font-mono text-xs text-slate-600">{tMaybe(c.reservationCode)}</span>
                  <span className={cn('rounded px-1.5 py-0.5 text-xs font-bold ring-1', outcome.className)}>{tMaybe(outcome.label)}</span>
                  <span className="text-slate-700">
                    {c.status === 'Relocated' && c.towedToBayCode && t('vehicle to bay {towedToBayCode} · {v} penalty', { towedToBayCode: c.towedToBayCode, v: vnd(c.penaltyFee ?? 0) })}
                    {c.status === 'Reassigned' && c.newBayCode && t('to bay {newBayCode}', { newBayCode: c.newBayCode })}
                    {c.status === 'Compensated' && t('{v} to the wallet', { v: vnd(c.depositRefunded + c.compensationPaid) })}
                    {c.status === 'Closed' && tMaybe(c.resolutionNote)}
                  </span>
                  <span className="ml-auto text-xs text-slate-600">
                    {tMaybe(c.resolvedByName)} · {at(c.resolvedAt)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Panel>
  )
}
