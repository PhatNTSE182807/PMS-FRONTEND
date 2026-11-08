import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { ArrowLeftRight, CalendarX, CircleCheck, HandCoins, ParkingSquare, TriangleAlert } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { vnd } from '@/components/features/manager/managerFormat'
import { Panel, Plate, SectionTitle } from '@/components/features/staff/StaffBits'
import { Button } from '@/components/ui/button'
import { FieldError, Label, NativeSelect } from '@/components/ui/form-controls'
import { Skeleton } from '@/components/ui/skeleton'
import { useBookedBayCases, useResolveBookedBay } from '@/hooks/useGate'
import { cn } from '@/lib/utils'
import type { BookedBayCaseDTO, BookedBayCaseStatus } from '@/types/operations.dto'

const clock = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const at = (iso: string | null | undefined) => (iso ? clock.format(Date.parse(iso)) : '—')

const OUTCOME: Record<Exclude<BookedBayCaseStatus, 'Open'>, { label: string; className: string }> = {
  Reassigned: { label: 'Moved', className: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  Compensated: { label: 'Refunded & compensated', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  Closed: { label: 'Closed', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-slate-600">{label}</dt>
      <dd className="text-right font-semibold text-slate-950">{children}</dd>
    </div>
  )
}

/** One open case: who booked, who parked there, and the way out (move the booking, or refund and compensate). */
function OpenCase({ bayCase, lotId }: { bayCase: BookedBayCaseDTO; lotId: string }) {
  const resolve = useResolveBookedBay(lotId)
  const [slotId, setSlotId] = useState<number | ''>(bayCase.freeBays[0]?.slotId ?? '')
  const [note, setNote] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasFreeBay = bayCase.freeBays.length > 0
  const payout = bayCase.depositHeld + bayCase.compensationAmount

  const move = () => {
    if (slotId === '') return setError('Pick the bay to move the booking to.')
    setError(null)
    resolve.mutate(
      { caseId: bayCase.id, kind: 'reassign', slotId },
      {
        onSuccess: (r) => toast.success(`Booking ${r.reservationCode} moved to bay ${r.newBayCode}. The customer was told and gets the first hour free.`),
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
            `Booking ${r.reservationCode} cancelled: ${vnd(r.depositRefunded + r.compensationPaid)} went to the customer's XXIV wallet.`,
          ),
        onError: (e) => {
          setConfirming(false)
          setError(getErrorMessage(e, 'Could not cancel the booking.'))
        },
      },
    )
  }

  return (
    <article className="space-y-4 rounded-xl p-4 ring-1 ring-amber-300" aria-label={`Bay ${bayCase.bayCode} taken`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-base font-bold text-slate-950">
          <ParkingSquare className="size-5 text-amber-500" aria-hidden /> Bay {bayCase.bayCode}
          <span className="font-mono text-sm font-semibold text-slate-600">· booking {bayCase.reservationCode}</span>
        </h3>
        <span className="text-xs text-slate-600">Reported {at(bayCase.createdAt)}</span>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <dl className="space-y-1.5 rounded-lg bg-slate-50 p-3">
          <p className="mb-1 text-xs font-bold tracking-wider text-slate-700 uppercase">Booked by</p>
          <Fact label="Customer">{bayCase.customerName ?? '—'}</Fact>
          <Fact label="Vehicle">
            <Plate>{bayCase.bookedPlate ?? '—'}</Plate> <span className="font-normal text-slate-700">{bayCase.vehicleTypeName}</span>
          </Fact>
          <Fact label="Arrives">{at(bayCase.arrivalTime)}</Fact>
          <Fact label="Hold ends">{at(bayCase.holdEndsAt)}</Fact>
        </dl>
        <dl className="space-y-1.5 rounded-lg bg-slate-50 p-3">
          <p className="mb-1 text-xs font-bold tracking-wider text-slate-700 uppercase">Parked there (walk-in)</p>
          <Fact label="Plate">
            <Plate>{bayCase.walkInPlate ?? '—'}</Plate>
          </Fact>
          <Fact label="Entered">{at(bayCase.walkInEntryTime)}</Fact>
          <Fact label="Session">
            <span className="font-mono text-xs">{bayCase.walkInSessionCode}</span>
          </Fact>
          <Fact label="Still inside">{bayCase.walkInInside ? 'Yes' : 'No'}</Fact>
        </dl>
      </div>

      {hasFreeBay ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1 space-y-1.5">
            <Label htmlFor={`bay-case-${bayCase.id}`}>Move the booking to a free bay</Label>
            <NativeSelect id={`bay-case-${bayCase.id}`} value={slotId} onChange={(e) => setSlotId(e.target.value ? Number(e.target.value) : '')}>
              {bayCase.freeBays.map((b) => (
                <option key={b.slotId} value={b.slotId}>
                  {b.code}
                  {b.zoneName ? ` · ${b.zoneName}` : ''}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button onClick={move} disabled={resolve.isPending}>
            <ArrowLeftRight /> Move booking
          </Button>
          <p className="w-full text-xs text-slate-600">
            {bayCase.freeBays.length} free {bayCase.vehicleTypeName ?? ''} bay{bayCase.freeBays.length === 1 ? '' : 's'}. The customer is told
            the new bay and gets the first hour free. Cancelling with a refund is only possible when no bay is free.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            No other {bayCase.vehicleTypeName ?? ''} bay is free. Cancel the booking: the deposit ({vnd(bayCase.depositHeld)}) and the
            compensation ({vnd(bayCase.compensationAmount)}) go to the customer's XXIV wallet, and the compensation comes off this lot's revenue.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor={`bay-case-note-${bayCase.id}`}>Note (optional)</Label>
            <textarea
              id={`bay-case-note-${bayCase.id}`}
              rows={2}
              maxLength={500}
              className="w-full rounded-lg bg-well p-3 text-sm text-slate-950 ring-1 ring-slate-200 focus-visible:outline-none"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. every car bay is full until the evening"
            />
          </div>
          {confirming ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="text-sm text-slate-950">Pay {vnd(payout)} into the customer's wallet and cancel the booking?</span>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={resolve.isPending}>
                Back
              </Button>
              <Button variant="destructive" onClick={compensate} disabled={resolve.isPending}>
                <HandCoins /> Confirm
              </Button>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button variant="destructive" onClick={() => setConfirming(true)}>
                <CalendarX /> Cancel booking, refund and compensate
              </Button>
            </div>
          )}
        </div>
      )}
      {error && <FieldError message={error} />}
    </article>
  )
}

/**
 * Booked bays a walk-in took (Exceptions screen): move the booking to a free bay of its type, or, when none is
 * left, cancel it with the deposit and the lot's compensation paid into the customer's XXIV wallet. Always shown,
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
            {open.length ? `${open.length} to resolve` : 'All resolved'}
          </span>
        }
      >
        Booked bays taken by a walk-in
      </SectionTitle>
      {!lotId && <p className="text-sm text-slate-700">You are not assigned to a parking lot yet.</p>}
      {lotId && cases.isPending && <Skeleton className="h-48 rounded-xl" />}
      {cases.isError && (
        <p className="text-sm text-rose-700">{getErrorMessage(cases.error, 'Could not load the booked bay cases.')}</p>
      )}
      <div className="space-y-4">
        {lotId &&
          open.map((c) => (
            <OpenCase key={c.id} bayCase={c} lotId={lotId} />
          ))}
        {lotId && open.length === 0 && !cases.isPending && !cases.isError && (
          <p className="flex items-center gap-2 text-sm text-slate-700">
            <CircleCheck className="size-4 text-emerald-600" aria-hidden /> No booked bay is taken right now.
          </p>
        )}
      </div>

      {recent.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-bold tracking-wider text-slate-700 uppercase">Recently resolved</p>
          <ul className="divide-y divide-slate-200 rounded-lg ring-1 ring-slate-200">
            {recent.map((c) => {
              const outcome = OUTCOME[c.status as Exclude<BookedBayCaseStatus, 'Open'>]
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                  <span className="font-semibold text-slate-950">Bay {c.bayCode}</span>
                  <span className="font-mono text-xs text-slate-600">{c.reservationCode}</span>
                  <span className={cn('rounded px-1.5 py-0.5 text-xs font-bold ring-1', outcome.className)}>{outcome.label}</span>
                  <span className="text-slate-700">
                    {c.status === 'Reassigned' && c.newBayCode && `to bay ${c.newBayCode}`}
                    {c.status === 'Compensated' && `${vnd(c.depositRefunded + c.compensationPaid)} to the wallet`}
                    {c.status === 'Closed' && c.resolutionNote}
                  </span>
                  <span className="ml-auto text-xs text-slate-600">
                    {c.resolvedByName} · {at(c.resolvedAt)}
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
