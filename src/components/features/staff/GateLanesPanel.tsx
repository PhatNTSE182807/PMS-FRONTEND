import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRight, CircleCheck, CircleX, Clock, DoorOpen, Hourglass, Keyboard, LogIn, LogOut, Phone, ShieldAlert, SkipForward, Undo2, UserRound } from 'lucide-react'
import { ApiError, getErrorMessage } from '@/api/apiError'
import { Button } from '@/components/ui/button'
import { Checkbox, Input } from '@/components/ui/form-controls'
import { useApproveGateRequest, useGateRequestQueue, useRefuseGateRequest } from '@/hooks/useGateRequests'
import { useCancelEntry, useConfirmEntry } from '@/hooks/useGate'
import { useNow } from '@/hooks/useNow'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ApproveGateRequestRequest, GateRequestDTO, GateRequestKind } from '@/types/gateRequest.dto'
import type { GateAlertDTO } from '@/types/operations.dto'
import { AlertRow, EntryLaneConsole } from './EntryLaneConsole'
import { Panel, Plate } from './StaffBits'
import { STAFF_TOAST, toastEntryAlerts, toastUnsettled } from './staffToasts'

const clock = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—')

/** "2 min ago" since the customer pressed the button. */
function waited(iso: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000))
  return minutes < 1 ? 'just now' : `${minutes} min ago`
}

/** Quick reasons for a refusal; the Staff can also type their own. */
const REFUSE_REASONS: Record<GateRequestKind, string[]> = {
  CheckIn: ['The vehicle at the lane does not match the booking.', 'Outside the check-in window: come back at your arrival time.', 'The lot is full right now.'],
  CheckOut: ['Please pay the parking fee in the app or at the lane first.', 'The plate at the lane does not match the parked vehicle.', 'Lost ticket: please see the Staff at the counter.'],
}

/** Alerts the Staff can clear on the next "Open barrier", with the request flag that clears each one. */
const OVERRIDES: Partial<Record<string, { flag: keyof ApproveGateRequestRequest; label: string }>> = {
  ZONE_FULL: { flag: 'allowWhenFull', label: 'Let it in although the zone is full' },
  RESERVATION_PLATE_MISMATCH: { flag: 'allowPlateMismatch', label: 'Same account, same vehicle type: accept the changed vehicle' },
  PLATE_MISMATCH: { flag: 'allowPlateMismatch', label: 'Plates differ but it is the same vehicle' },
}

/**
 * What the lane is doing with the request it handles: deciding, barrier open (check-in waits for the
 * vehicle to pass the sensor), or done (the next vehicle can be called).
 */
type Handled = { request: GateRequestDTO; phase: 'entering' | 'done'; sessionId: number | null; message: string }

/**
 * Staff lanes for the check-in / check-out requests. Check-in requests come from the customer app; the
 * Check-out lane also gets every paid vehicle (paid at the POS or in the app, walk-ins included), since the
 * exit barrier is only opened here (team decision, 2026-11-04). Each tab works through
 * its queue oldest first: the vehicle's details show, the Staff opens the barrier (the normal gate checks
 * run) or refuses with a reason, and "Next vehicle" moves to the next request. Walk-ins and scanned QR
 * codes still go through the manual entry form under the Check-in tab.
 */
export function GateLanesPanel({ lotId, initialTab = 'CheckIn' }: { lotId: string; initialTab?: GateRequestKind }) {
  const [tab, setTab] = useState<GateRequestKind>(initialTab)
  const checkIns = useGateRequestQueue(lotId, 'CheckIn')
  const checkOuts = useGateRequestQueue(lotId, 'CheckOut')
  const counts = { CheckIn: checkIns.data?.length ?? 0, CheckOut: checkOuts.data?.length ?? 0 }

  return (
    <Panel className="flex flex-col">
      <div role="tablist" aria-label="Gate lanes" className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-50 p-1">
        {(['CheckIn', 'CheckOut'] as const).map((kind) => {
          const Icon = kind === 'CheckIn' ? LogIn : LogOut
          return (
            <button
              key={kind}
              type="button"
              role="tab"
              aria-selected={tab === kind}
              onClick={() => setTab(kind)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold tracking-wide uppercase transition-colors',
                tab === kind ? 'bg-[#124e66] text-indigo-800' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950',
              )}
            >
              <Icon className="size-4" aria-hidden /> {kind === 'CheckIn' ? 'Check-in' : 'Check-out'}
              {counts[kind] > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-[11px] text-(--color-on-gold) tabular-nums">{counts[kind]}</span>}
            </button>
          )
        })}
      </div>

      {/* Both lanes stay mounted so switching tabs keeps the vehicle each one is handling */}
      <div hidden={tab !== 'CheckIn'}>
        <Lane lotId={lotId} kind="CheckIn" queue={checkIns.data ?? []} loading={checkIns.isPending} />
      </div>
      <div hidden={tab !== 'CheckOut'}>
        <Lane lotId={lotId} kind="CheckOut" queue={checkOuts.data ?? []} loading={checkOuts.isPending} />
      </div>
    </Panel>
  )
}

function Lane({ lotId, kind, queue, loading }: { lotId: string; kind: GateRequestKind; queue: GateRequestDTO[]; loading: boolean }) {
  const now = useNow(15_000)
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [handled, setHandled] = useState<Handled | null>(null)
  const [manual, setManual] = useState(false)

  // The vehicle being handled: the picked one while it waits, else the oldest in the queue
  const current = handled ? null : (queue.find((r) => r.id === currentId) ?? queue[0] ?? null)
  const others = queue.filter((r) => r.id !== (handled?.request.id ?? current?.id))

  /** Moves to the next request (after the current one was handled, or to skip it for now). */
  const next = () => {
    const position = current ? queue.findIndex((r) => r.id === current.id) : -1
    const candidate = handled ? others[0] : (queue[position + 1] ?? queue.find((r) => r.id !== current?.id))
    setHandled(null)
    setCurrentId(candidate?.id ?? null)
  }

  const lane = kind === 'CheckIn' ? 'entry' : 'exit'

  if (manual && kind === 'CheckIn') {
    return (
      <div className="space-y-3">
        <LaneHeader title="Manual entry" detail="Walk-in, or scan the reservation QR at the lane" />
        <EntryLaneConsole lotId={lotId} embedded />
        <Button variant="outline" className="w-full" onClick={() => setManual(false)}>
          <Undo2 /> Back to app requests{queue.length ? ` (${queue.length} waiting)` : ''}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {handled ? (
        <HandledView handled={handled} kind={kind} onDone={(message) => setHandled({ ...handled, phase: 'done', message })} />
      ) : current ? (
        <RequestView
          key={current.id}
          request={current}
          now={now}
          onHandled={(h) => setHandled(h)}
        />
      ) : (
        <div className="rounded-xl bg-slate-50 p-6 text-center ring-1 ring-slate-200">
          <Hourglass className="mx-auto size-6 text-slate-600" aria-hidden />
          <p className="mt-2 font-semibold text-slate-950">{loading ? 'Loading requests…' : `No ${kind === 'CheckIn' ? 'check-in' : 'check-out'} requests`}</p>
          <p className="mt-1 text-sm text-slate-700">
            {kind === 'CheckIn'
              ? 'Customers who press "Check in" on their booking appear here, oldest first.'
              : 'Paid vehicles (at the POS or in the app, walk-ins too) and customers who press "Check out" appear here, oldest first.'}
          </p>
        </div>
      )}

      {(handled?.phase === 'done' || (!handled && current && queue.length > 1)) && (
        <Button className="h-11 w-full" variant={handled ? 'gold' : 'outline'} onClick={next} disabled={!handled && queue.length < 2}>
          {handled ? <ArrowRight /> : <SkipForward />}
          {handled
            ? others.length ? `Next vehicle (${others.length} waiting)` : 'Next vehicle'
            : `Skip to next vehicle (${others.length} more waiting)`}
        </Button>
      )}

      {others.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold tracking-wider text-slate-700 uppercase">Waiting at the {lane} lane</p>
          <ul className="space-y-1.5">
            {others.slice(0, 4).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <Plate>{r.plateNumber ?? '—'}</Plate>
                <span className="min-w-0 flex-1 truncate text-slate-700">{r.vehicleLabel ?? r.customerName ?? ''}</span>
                <span className="shrink-0 text-xs text-slate-600">{waited(r.createdAt, now)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {kind === 'CheckIn' ? (
        <Button variant="secondary" className="w-full" onClick={() => setManual(true)}>
          <Keyboard /> Manual entry (walk-in or scan QR)
        </Button>
      ) : (
        <Button variant="secondary" className="w-full" asChild>
          <Link to="/staff/checkout">
            <Keyboard /> Walk-up exit or fee at the POS
          </Link>
        </Button>
      )}
    </div>
  )
}

function LaneHeader({ title, detail, aside }: { title: string; detail?: string; aside?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-bold tracking-wider text-amber-500 uppercase">{title}</p>
        {detail && <p className="mt-0.5 text-sm text-slate-700">{detail}</p>}
      </div>
      {aside}
    </div>
  )
}

/** One waiting request: the vehicle and customer, what may block it, and the Open barrier / Refuse decision. */
function RequestView({ request, now, onHandled }: { request: GateRequestDTO; now: number; onHandled: (h: Handled) => void }) {
  const approve = useApproveGateRequest()
  const refuse = useRefuseGateRequest()
  const [alerts, setAlerts] = useState<GateAlertDTO[]>([])
  const [options, setOptions] = useState<ApproveGateRequestRequest>({})
  const [refusing, setRefusing] = useState(false)
  const [reason, setReason] = useState('')
  const checkIn = request.kind === 'CheckIn'
  const overridable = alerts.filter((a) => a.canOverride && OVERRIDES[a.code])
  const usesOverride = overridable.some((a) => options[OVERRIDES[a.code]!.flag])
  const minutesInside = request.entryTime ? Math.floor((now - Date.parse(request.entryTime)) / 60_000) : null

  const open = () =>
    approve.mutate(
      { requestId: request.id, request: { ...options, overrideReason: options.overrideReason?.trim() || undefined } },
      {
        onSuccess: (decision) => {
          if (!decision.barrierOpen) {
            // The alerts show below; only those the spec has a popup for are toasted
            setAlerts(decision.alerts)
            if (checkIn) toastEntryAlerts(decision.alerts, { status: request.reservationStatus, checkInUntil: request.checkInUntil })
            return
          }
          if (checkIn) {
            const session = decision.checkIn?.session ?? null
            toast.success(STAFF_TOAST.checkedIn)
            onHandled({ request: decision.request, phase: 'entering', sessionId: session?.id ?? null, message: '' })
          } else {
            const refund = decision.checkOut?.depositRefund ?? 0
            const message = refund > 0 ? `Exit barrier opened. ${formatNumber(refund)} VND of the deposit goes back to the customer.` : 'Exit barrier opened. Session completed.'
            toast.success(STAFF_TOAST.checkedOut)
            onHandled({ request: decision.request, phase: 'done', sessionId: request.sessionId, message })
          }
        },
        onError: (e) => {
          // A check-out request is refused by the server while the fee is not settled
          if (!checkIn && e instanceof ApiError && e.status === 400 && request.sessionStatus !== 'Paid') toastUnsettled(request.exitWindowEndsAt)
          else toast.error(getErrorMessage(e, 'Could not open the barrier.'))
        },
      },
    )

  const sendRefusal = (text: string) =>
    refuse.mutate(
      { requestId: request.id, reason: text },
      {
        onSuccess: (r) => {
          toast.info(`${request.plateNumber ?? 'Request'} refused`, {
            description: request.customerName ? 'The customer sees your reason in the app.' : 'Walk-in: tell the driver the reason at the lane.',
          })
          onHandled({ request: r, phase: 'done', sessionId: null, message: `Refused: ${text}` })
        },
        onError: (e) => toast.error(getErrorMessage(e, 'Could not refuse the request.')),
      },
    )

  return (
    <div className="space-y-4">
      <LaneHeader
        title={
          checkIn
            ? `App check-in · Reservation ${request.reservationCode ?? ''}`
            : `${request.customerName ? 'Check-out' : 'Walk-in check-out'} · Session ${request.sessionCode ?? ''}`
        }
        aside={
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
            <Clock className="size-3.5" aria-hidden /> {waited(request.createdAt, now)}
          </span>
        }
      />

      <div className="rounded-xl bg-[#060f16] p-5 ring-1 ring-slate-200">
        <p className="font-mono text-3xl font-bold tracking-[0.15em] text-slate-950">{request.plateNumber ?? 'NO PLATE'}</p>
        <p className="mt-1 text-sm text-slate-700">
          {[request.vehicleLabel, request.vehicleColor, request.vehicleTypeName].filter(Boolean).join(' • ') || 'Vehicle details unavailable'}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-slate-600">Customer</dt>
            <dd className="flex items-center gap-1.5 font-medium text-slate-900">
              <UserRound className="size-3.5 text-slate-600" aria-hidden /> {request.customerName ?? 'Walk-in (no account)'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-600">Phone</dt>
            <dd className="flex items-center gap-1.5 font-mono font-medium text-slate-900">
              <Phone className="size-3.5 text-slate-600" aria-hidden /> {request.customerPhone ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-600">Bay</dt>
            <dd className="font-mono font-medium text-slate-900">{request.slotCode ?? '—'}</dd>
          </div>
          {checkIn ? (
            <div>
              <dt className="text-xs text-slate-600">Check-in window</dt>
              <dd className="font-mono font-medium text-slate-900">
                {clock(request.checkInFrom)}–{clock(request.checkInUntil)}
              </dd>
            </div>
          ) : (
            <div>
              <dt className="text-xs text-slate-600">Parked</dt>
              <dd className="font-mono font-medium text-slate-900">
                {clock(request.entryTime)}
                {minutesInside != null && ` • ${Math.floor(minutesInside / 60)}h ${minutesInside % 60}m`}
              </dd>
            </div>
          )}
          {!checkIn && (
            <>
              <div>
                <dt className="text-xs text-slate-600">Payment</dt>
                <dd className={cn('font-medium', request.sessionStatus === 'Paid' ? 'text-emerald-700' : 'text-amber-500')}>
                  {request.sessionStatus === 'Paid' ? `Paid ${formatNumber(request.paidAmount)} VND` : 'Not paid yet'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-600">Exit window</dt>
                <dd className="font-mono font-medium text-slate-900">{request.exitWindowEndsAt ? `until ${clock(request.exitWindowEndsAt)}` : '—'}</dd>
              </div>
            </>
          )}
        </dl>
      </div>

      {request.problem ? (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {request.problem}
            {!checkIn && request.sessionStatus !== 'Paid' && (
              <>
                {' '}
                <Link to="/staff/checkout" className="font-semibold underline">Open the POS</Link>
              </>
            )}
          </span>
        </p>
      ) : (
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
          <CircleCheck className="size-4 shrink-0" aria-hidden /> Check the vehicle at the {checkIn ? 'entry' : 'exit'} lane matches, then open the barrier.
        </p>
      )}

      {alerts.length > 0 && (
        <div className="space-y-2 rounded-xl bg-rose-50 p-3 ring-1 ring-rose-200">
          {alerts.map((a) => <AlertRow key={a.code} alert={a} />)}
          {overridable.map((a) => {
            const { flag, label } = OVERRIDES[a.code]!
            return (
              <label key={a.code} className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <Checkbox checked={Boolean(options[flag])} onChange={(e) => setOptions((o) => ({ ...o, [flag]: e.target.checked }))} /> {label}
              </label>
            )
          })}
          {usesOverride && (
            <Input value={options.overrideReason ?? ''} onChange={(e) => setOptions((o) => ({ ...o, overrideReason: e.target.value }))} placeholder="Reason (required, kept in the session log)" />
          )}
        </div>
      )}

      {refusing ? (
        <div className="space-y-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <p className="text-xs font-bold tracking-wider text-slate-700 uppercase">Reason for the customer</p>
          <div className="flex flex-wrap gap-1.5">
            {REFUSE_REASONS[request.kind].map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)} className={cn('rounded-full px-2.5 py-1 text-xs ring-1', reason === r ? 'bg-[#124e66] text-indigo-800 ring-indigo-300' : 'text-slate-800 ring-slate-200 hover:bg-slate-100')}>
                {r}
              </button>
            ))}
          </div>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Or type the reason" maxLength={500} />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="destructive" disabled={!reason.trim() || refuse.isPending} onClick={() => sendRefusal(reason.trim())}>
              <CircleX /> Refuse request
            </Button>
            <Button variant="outline" onClick={() => setRefusing(false)}>Back</Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
          <Button variant="gold" className="h-11" disabled={approve.isPending || (usesOverride && !options.overrideReason?.trim())} onClick={open}>
            <DoorOpen /> {alerts.length ? 'Check again & open barrier' : 'Open barrier'}
          </Button>
          <Button variant="outline" className="h-11 text-rose-700" onClick={() => setRefusing(true)}>
            <CircleX /> Refuse
          </Button>
        </div>
      )}
    </div>
  )
}

/** After the barrier opened (check-in waits for the sensor) or the request was refused. */
function HandledView({ handled, kind, onDone }: { handled: Handled; kind: GateRequestKind; onDone: (message: string) => void }) {
  const confirm = useConfirmEntry()
  const cancel = useCancelEntry()
  const r = handled.request

  return (
    <div className="space-y-4">
      <LaneHeader title={kind === 'CheckIn' ? 'Entry barrier' : 'Exit barrier'} />
      <div className={cn('rounded-xl p-5 ring-1', handled.phase === 'entering' ? 'bg-emerald-50 ring-emerald-200' : r.status === 'Refused' ? 'bg-rose-50 ring-rose-200' : 'bg-slate-50 ring-slate-200')}>
        <p className="font-mono text-3xl font-bold tracking-[0.15em] text-slate-950">{r.plateNumber ?? 'NO PLATE'}</p>
        <p className="mt-1 text-sm text-slate-700">{[r.vehicleLabel, r.customerName].filter(Boolean).join(' • ')}</p>
        <p className={cn('mt-3 flex items-start gap-2 text-sm font-medium', r.status === 'Refused' ? 'text-rose-800' : 'text-emerald-700')}>
          {r.status === 'Refused' ? <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />}
          {handled.phase === 'entering' ? 'Barrier open: confirm when the vehicle has passed the sensor.' : handled.message}
        </p>
      </div>

      {handled.phase === 'entering' && handled.sessionId != null && (
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="success"
            disabled={confirm.isPending}
            onClick={() =>
              confirm.mutate(handled.sessionId!, {
                onSuccess: (s) => {
                  toast.success(`${s.plateNumber || s.code} is in`, { description: 'Session valid; bay and zone counter updated.' })
                  onDone(`Checked in to ${s.slotCode ? `bay ${s.slotCode}` : (s.zoneName ?? 'the lot')}.`)
                },
                onError: (e) => toast.error(getErrorMessage(e)),
              })
            }
          >
            <DoorOpen /> Vehicle passed (sensor)
          </Button>
          <Button
            variant="secondary"
            disabled={cancel.isPending}
            onClick={() =>
              cancel.mutate(handled.sessionId!, {
                onSuccess: () => {
                  toast.info('Entry cancelled: the vehicle turned around.')
                  onDone('Entry cancelled: the vehicle turned around.')
                },
                onError: (e) => toast.error(getErrorMessage(e)),
              })
            }
          >
            <Undo2 /> Turned around
          </Button>
        </div>
      )}
    </div>
  )
}
