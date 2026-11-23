import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRight, CircleCheck, CircleX, Clock, DoorOpen, Hourglass, Keyboard, LogIn, LogOut, Phone, ShieldAlert, SkipForward, UserRound } from 'lucide-react'
import { ApiError, getErrorMessage } from '@/api/apiError'
import { Button } from '@/components/ui/button'
import { Checkbox, Input } from '@/components/ui/form-controls'
import { useApproveGateRequest, useGateRequestQueue, useRefuseGateRequest } from '@/hooks/useGateRequests'
import { useConfirmEntry } from '@/hooks/useGate'
import { platesMatch, useLanePlate } from '@/hooks/useLanePlate'
import { useNow } from '@/hooks/useNow'
import { formatNumber } from '@/lib/format'
import { gateLaneSignals, laneVehicleKind } from '@/lib/gateLaneSignals'
import { cn } from '@/lib/utils'
import type { ApproveGateRequestRequest, GateRequestDecisionDTO, GateRequestDTO, GateRequestKind } from '@/types/gateRequest.dto'
import type { GateAlertDTO } from '@/types/operations.dto'
import { AlertRow, EntryLaneConsole } from './EntryLaneConsole'
import { LanePlateArea } from './LanePlateArea'
import { Panel, Plate } from './StaffBits'
import { STAFF_TOAST, toastEntryAlerts, toastUnsettled } from './staffToasts'
import { t, tMaybe, currentLocale } from '@/i18n'

const clock = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString(currentLocale(), { hour: '2-digit', minute: '2-digit' }) : '—')

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
 * The request the lane has just handled: barrier opened (the entry is confirmed at once, team decision
 * 2026-11-04: no "vehicle passed the sensor" step) or refused. The next vehicle can then be called.
 */
type Handled = { request: GateRequestDTO; phase: 'done'; sessionId: number | null; message: string }

/** The 3D camera of each lane: Check-in requests use the entry lane, Check-out requests the exit lane. */
const laneOf = (kind: GateRequestKind) => (kind === 'CheckIn' ? 'entry' : 'exit')

const laneVehicleOf = (r: GateRequestDTO) => ({ key: `request-${r.id}`, plate: r.plateNumber ?? '', kind: laneVehicleKind(r.vehicleTypeName), paint: r.paintColor })

/**
 * Staff lanes for the check-in / check-out requests. Check-in requests come from the customer app; the
 * Check-out lane also gets every paid vehicle (paid at the POS or in the app, walk-ins included), since the
 * exit barrier is only opened here (team decision, 2026-11-04). Each tab works through
 * its queue oldest first: the vehicle's details show, the Staff opens the barrier (the normal gate checks
 * run) or refuses with a reason, and "Next vehicle" moves to the next request. Each lane has a plate area: what the
 * lane camera read and the Staff plate filled from it; the barrier opens only once the Staff plate matches the
 * plate on record (the booking's plate at check-in, the parked vehicle's plate at check-out). Walk-ins and scanned
 * QR codes go through the walk-in form, always shown under the Check-in tab.
 */
export function GateLanesPanel({ lotId, initialTab = 'CheckIn' }: { lotId: string; initialTab?: GateRequestKind }) {
  const [tab, setTab] = useState<GateRequestKind>(initialTab)
  const checkIns = useGateRequestQueue(lotId, 'CheckIn')
  const checkOuts = useGateRequestQueue(lotId, 'CheckOut')
  const counts = { CheckIn: checkIns.data?.length ?? 0, CheckOut: checkOuts.data?.length ?? 0 }

  // The gate cameras show the lane of the open tab when vehicles wait at both barriers
  useEffect(() => {
    gateLaneSignals.setActive(laneOf(tab))
    return () => gateLaneSignals.setActive(null)
  }, [tab])

  return (
    <Panel className="flex flex-col">
      <div role="tablist" aria-label={t('Gate lanes')} className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-50 p-1">
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
                tab === kind ? 'bg-selected text-indigo-800' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950',
              )}
            >
              <Icon className="size-4" aria-hidden /> {kind === 'CheckIn' ? t('Check-in') : t('Check-out')}
              {counts[kind] > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-[11px] text-(--color-on-gold) tabular-nums">{tMaybe(counts[kind])}</span>}
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

  // The vehicle being handled: the picked one while it waits, else the oldest in the queue
  const current = handled ? null : (queue.find((r) => r.id === currentId) ?? queue[0] ?? null)
  const others = queue.filter((r) => r.id !== (handled?.request.id ?? current?.id))

  // The 3D camera of this lane shows the vehicle waiting at its closed barrier, whichever tab is open: a vehicle
  // waiting to check in stands at the entry camera while another waits at the exit camera. Once one is let
  // through, the next one comes up after it has driven out (gateLaneSignals keeps it until then).
  const currentKey = current ? laneVehicleOf(current).key : null
  useEffect(() => {
    gateLaneSignals.wait(laneOf(kind), current ? laneVehicleOf(current) : null)
    // Only when the handled vehicle changes, not on every queue refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey, kind])

  /** Moves to the next request (after the current one was handled, or to skip it for now). */
  const next = () => {
    const position = current ? queue.findIndex((r) => r.id === current.id) : -1
    const candidate = handled ? others[0] : (queue[position + 1] ?? queue.find((r) => r.id !== current?.id))
    setHandled(null)
    setCurrentId(candidate?.id ?? null)
  }

  const lane = kind === 'CheckIn' ? 'entry' : 'exit'
  // The Staff plate starts empty for each vehicle the lane handles, then each camera read fills it
  const plate = useLanePlate(lane, handled ? `handled-${handled.request.id}` : (currentKey ?? 'none'))
  const recorded = current?.plateNumber ?? null
  const recordedLabel = kind === 'CheckOut' ? 'plate of the parked vehicle' : current?.isSimulated ? 'plate on the request' : "booking's registered plate"
  const plateArea = <LanePlateArea lane={plate} recorded={recorded} recordedLabel={recordedLabel} />

  return (
    <div className="space-y-4">
      {handled ? (
        <HandledView handled={handled} kind={kind} />
      ) : current ? (
        <RequestView
          key={current.id}
          request={current}
          now={now}
          plateArea={plateArea}
          plateMatches={!recorded || platesMatch(plate.plate, recorded)}
          onHandled={(h) => setHandled(h)}
        />
      ) : kind === 'CheckIn' ? (
        <p className="flex items-center gap-2 text-sm text-slate-700">
          <Hourglass className="size-4 shrink-0 text-slate-600" aria-hidden /> {loading ? t('Loading app check-in requests…') : t('No app check-in requests waiting.')}
        </p>
      ) : (
        <div className="rounded-xl bg-slate-50 p-6 text-center ring-1 ring-slate-200">
          <Hourglass className="mx-auto size-6 text-slate-600" aria-hidden />
          <p className="mt-2 font-semibold text-slate-950">{loading ? t('Loading requests…') : t('No check-out requests')}</p>
          <p className="mt-1 text-sm text-slate-700">{t('Paid vehicles (at the POS or in the app, walk-ins too) and customers who press "Check out" appear here, oldest first.')}</p>
        </div>
      )}

      {(handled?.phase === 'done' || (!handled && current && queue.length > 1)) && (
        <Button className="h-11 w-full" variant={handled ? 'gold' : 'outline'} onClick={next} disabled={!handled && queue.length < 2}>
          {handled ? <ArrowRight /> : <SkipForward />}
          {handled
            ? others.length ? t('Next vehicle ({length} waiting)', { length: others.length }) : t('Next vehicle')
            : t('Skip to next vehicle ({length} more waiting)', { length: others.length })}
        </Button>
      )}

      {others.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold tracking-wider text-slate-700 uppercase">{t('Waiting at the {lane} lane', { lane })}</p>
          <ul className="space-y-1.5">
            {others.slice(0, 4).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <Plate>{tMaybe(r.plateNumber) ?? '—'}</Plate>
                <span className="min-w-0 flex-1 truncate text-slate-700">{tMaybe(r.vehicleLabel) ?? tMaybe(r.customerName) ?? ''}</span>
                <span className="shrink-0 text-xs text-slate-600">{waited(r.createdAt, now)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {kind === 'CheckIn' ? (
        // Always shown: walk-ins and bookings scanned at the lane use the same plate area
        <div className="space-y-4 border-t border-slate-200 pt-4">
          <LaneHeader title={current && !handled ? t('Other vehicle: walk-in or booking code') : t('Walk-in or booking code')} detail={t('Walk-in, or scan the reservation QR at the lane')} />
          {(handled || !current) && tMaybe(plateArea)}
          <EntryLaneConsole lotId={lotId} lane={plate} embedded />
        </div>
      ) : (
        <Button variant="secondary" className="w-full" asChild>
          <Link to="/staff/checkout">
            <Keyboard />{' '}{t('Walk-up exit or fee at the POS')}
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
        <p className="text-xs font-bold tracking-wider text-amber-500 uppercase">{tMaybe(title)}</p>
        {detail && <p className="mt-0.5 text-sm text-slate-700">{tMaybe(detail)}</p>}
      </div>
      {tMaybe(aside)}
    </div>
  )
}

/** One waiting request: the vehicle and customer, what may block it, and the Open barrier / Refuse decision. */
function RequestView({
  request,
  now,
  plateArea,
  plateMatches,
  onHandled,
}: {
  request: GateRequestDTO
  now: number
  /** The lane's camera read and Staff plate, shown under the vehicle card. */
  plateArea: ReactNode
  /** The Staff plate matches the request's plate on record (or it has none): the barrier may open. */
  plateMatches: boolean
  onHandled: (h: Handled) => void
}) {
  const approve = useApproveGateRequest()
  const confirmEntry = useConfirmEntry()
  const refuse = useRefuseGateRequest()
  const [alerts, setAlerts] = useState<GateAlertDTO[]>([])
  const [options, setOptions] = useState<ApproveGateRequestRequest>({})
  const [refusing, setRefusing] = useState(false)
  const [reason, setReason] = useState('')
  const checkIn = request.kind === 'CheckIn'
  const overridable = alerts.filter((a) => a.canOverride && OVERRIDES[a.code])
  const usesOverride = overridable.some((a) => options[OVERRIDES[a.code]!.flag])
  const minutesInside = request.entryTime ? Math.floor((now - Date.parse(request.entryTime)) / 60_000) : null

  // mutateAsync, not mutate with callbacks: the queue refresh a decision pushes can remove this view before the answer
  // arrives, and mutate's callbacks do not run once the view is gone
  const open = async () => {
    let decision: GateRequestDecisionDTO
    try {
      decision = await approve.mutateAsync({
        requestId: request.id,
        // A matching Staff plate means the Staff checked the plate on the vehicle
        request: { ...options, plateConfirmed: options.plateConfirmed || (Boolean(request.plateNumber) && plateMatches) || undefined, overrideReason: options.overrideReason?.trim() || undefined },
      })
    } catch (e) {
      // A check-out request is refused by the server while the fee is not settled
      if (!checkIn && e instanceof ApiError && e.status === 400 && request.sessionStatus !== 'Paid') toastUnsettled(request.exitWindowEndsAt)
      else toast.error(getErrorMessage(e, 'Could not open the barrier.'))
      return
    }
    if (!decision.barrierOpen) {
      // The alerts show below; only those the spec has a popup for are toasted
      setAlerts(decision.alerts)
      if (checkIn) toastEntryAlerts(decision.alerts, { status: request.reservationStatus, checkInUntil: request.checkInUntil })
      return
    }
    // The barrier lifts in the lane's 3D camera and the vehicle drives through
    gateLaneSignals.open(laneOf(request.kind), laneVehicleOf(request))
    if (!checkIn) {
      const refund = decision.checkOut?.depositRefund ?? 0
      const message = refund > 0 ? `Exit barrier opened. ${formatNumber(refund)} VND of the deposit goes back to the customer.` : 'Exit barrier opened. Session completed.'
      toast.success(STAFF_TOAST.checkedOut)
      onHandled({ request: decision.request, phase: 'done', sessionId: request.sessionId, message })
      return
    }
    const session = decision.checkIn?.session ?? null
    toast.success(STAFF_TOAST.checkedIn)
    // The API confirms the entry itself; only demo data still answers with a vehicle at the barrier
    if (session?.status !== 'PendingEntry') {
      onHandled({ request: decision.request, phase: 'done', sessionId: session?.id ?? null, message: session?.slotCode ? t('Checked in to bay {slotCode}.', { slotCode: session.slotCode }) : t('Checked in.') })
      return
    }
    try {
      const s = await confirmEntry.mutateAsync(session.id)
      onHandled({ request: decision.request, phase: 'done', sessionId: s.id, message: t('Checked in to {v}.', { v: s.slotCode ? `bay ${s.slotCode}` : (s.zoneName ?? 'the lot') }) })
    } catch (e) {
      onHandled({ request: decision.request, phase: 'done', sessionId: session.id, message: t('Barrier opened, but the entry was not recorded: {v}', { v: getErrorMessage(e) }) })
    }
  }

  const sendRefusal = async (text: string) => {
    try {
      const r = await refuse.mutateAsync({ requestId: request.id, reason: text })
      toast.info(t('{v} refused', { v: request.plateNumber ?? 'Request' }), {
        description: request.customerName ? t('The customer sees your reason in the app.') : t('Walk-in: tell the driver the reason at the lane.'),
      })
      onHandled({ request: r, phase: 'done', sessionId: null, message: t('Refused: {text}', { text }) })
    } catch (e) {
      toast.error(getErrorMessage(e, 'Could not refuse the request.'))
    }
  }

  return (
    <div className="space-y-4">
      <LaneHeader
        title={
          checkIn
            ? request.isSimulated
              ? t('Walk-in check-in · Simulated vehicle')
              : t('App check-in · Reservation {v}', { v: request.reservationCode ?? '' })
            : t('{v} · Session {v2}', { v: request.customerName ? 'Check-out' : 'Walk-in check-out', v2: request.sessionCode ?? '' })
        }
        aside={
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
            <Clock className="size-3.5" aria-hidden /> {waited(request.createdAt, now)}
          </span>
        }
      />

      <div className="rounded-xl bg-well p-5 ring-1 ring-slate-200">
        <p className="font-mono text-3xl font-bold tracking-[0.15em] text-slate-950">{tMaybe(request.plateNumber) ?? t('NO PLATE')}</p>
        <p className="mt-1 text-sm text-slate-700">
          {[request.vehicleLabel, request.vehicleColor, request.vehicleTypeName].filter(Boolean).join(' • ') || t('Vehicle details unavailable')}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-slate-600">{t('Customer')}</dt>
            <dd className="flex items-center gap-1.5 font-medium text-slate-900">
              <UserRound className="size-3.5 text-slate-600" aria-hidden /> {tMaybe(request.customerName) ?? t('Walk-in (no account)')}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-600">{t('Phone')}</dt>
            <dd className="flex items-center gap-1.5 font-mono font-medium text-slate-900">
              <Phone className="size-3.5 text-slate-600" aria-hidden /> {tMaybe(request.customerPhone) ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-600">{t('Bay')}</dt>
            <dd className="font-mono font-medium text-slate-900">{tMaybe(request.slotCode) ?? '—'}</dd>
          </div>
          {checkIn && request.isSimulated ? (
            <div>
              <dt className="text-xs text-slate-600">{t('Entry')}</dt>
              <dd className="font-medium text-slate-900">{t('Walk-in, no booking')}</dd>
            </div>
          ) : checkIn ? (
            <div>
              <dt className="text-xs text-slate-600">{t('Check-in window')}</dt>
              <dd className="font-mono font-medium text-slate-900">
                {clock(request.checkInFrom)}–{clock(request.checkInUntil)}
              </dd>
            </div>
          ) : (
            <div>
              <dt className="text-xs text-slate-600">{t('Parked')}</dt>
              <dd className="font-mono font-medium text-slate-900">
                {clock(request.entryTime)}
                {minutesInside != null && ` • ${Math.floor(minutesInside / 60)}h ${minutesInside % 60}m`}
              </dd>
            </div>
          )}
          {!checkIn && (
            <>
              <div>
                <dt className="text-xs text-slate-600">{t('Payment')}</dt>
                <dd className={cn('font-medium', request.sessionStatus === 'Paid' ? 'text-emerald-700' : 'text-amber-500')}>
                  {request.sessionStatus === 'Paid' ? t('Paid {v} VND', { v: formatNumber(request.paidAmount) }) : t('Not paid yet')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-600">{t('Exit window')}</dt>
                <dd className="font-mono font-medium text-slate-900">{request.exitWindowEndsAt ? t('until {v}', { v: clock(request.exitWindowEndsAt) }) : '—'}</dd>
              </div>
            </>
          )}
        </dl>
      </div>

      {tMaybe(plateArea)}

      {request.problem ? (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            {tMaybe(request.problem)}
            {!checkIn && request.sessionStatus !== 'Paid' && (
              <>
                {' '}
                <Link to="/staff/checkout" className="font-semibold underline">{t('Open the POS')}</Link>
              </>
            )}
          </span>
        </p>
      ) : plateMatches ? (
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
          <CircleCheck className="size-4 shrink-0" aria-hidden />{' '}{t('Check the vehicle at the')}{' '}{checkIn ? 'entry' : 'exit'}{' '}{t('lane matches, then open the barrier.')}
        </p>
      ) : null}

      {alerts.length > 0 && (
        <div className="space-y-2 rounded-xl bg-rose-50 p-3 ring-1 ring-rose-200">
          {alerts.map((a) => <AlertRow key={a.code} alert={a} />)}
          {overridable.map((a) => {
            const { flag, label } = OVERRIDES[a.code]!
            return (
              <label key={a.code} className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <Checkbox checked={Boolean(options[flag])} onChange={(e) => setOptions((o) => ({ ...o, [flag]: e.target.checked }))} /> {tMaybe(label)}
              </label>
            )
          })}
          {usesOverride && (
            <Input value={options.overrideReason ?? ''} onChange={(e) => setOptions((o) => ({ ...o, overrideReason: e.target.value }))} placeholder={t('Reason (required, kept in the session log)')} />
          )}
        </div>
      )}

      {refusing ? (
        <div className="space-y-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <p className="text-xs font-bold tracking-wider text-slate-700 uppercase">{t('Reason for the customer')}</p>
          <div className="flex flex-wrap gap-1.5">
            {REFUSE_REASONS[request.kind].map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)} className={cn('rounded-full px-2.5 py-1 text-xs ring-1', reason === r ? 'bg-selected text-indigo-800 ring-indigo-300' : 'text-slate-800 ring-slate-200 hover:bg-slate-100')}>
                {tMaybe(r)}
              </button>
            ))}
          </div>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('Or type the reason')} maxLength={500} />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="destructive" disabled={!reason.trim() || refuse.isPending} onClick={() => sendRefusal(reason.trim())}>
              <CircleX />{' '}{t('Refuse request')}
            </Button>
            <Button variant="outline" onClick={() => setRefusing(false)}>{t('Back')}</Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
          <Button variant="gold" className="h-11" disabled={!plateMatches || approve.isPending || confirmEntry.isPending || (usesOverride && !options.overrideReason?.trim())}
            title={plateMatches ? undefined : t('The Staff plate must match the plate on record')}
            onClick={open}
          >
            <DoorOpen /> {alerts.length ? t('Check again & open barrier') : t('Open barrier')}
          </Button>
          <Button variant="outline" className="h-11 text-rose-700" onClick={() => setRefusing(true)}>
            <CircleX />{' '}{t('Refuse')}
          </Button>
        </div>
      )}
    </div>
  )
}

/** After the barrier opened (the vehicle is in or out) or the request was refused. */
function HandledView({ handled, kind }: { handled: Handled; kind: GateRequestKind }) {
  const r = handled.request
  return (
    <div className="space-y-4">
      <LaneHeader title={kind === 'CheckIn' ? t('Entry barrier') : t('Exit barrier')} />
      <div className={cn('rounded-xl p-5 ring-1', r.status === 'Refused' ? 'bg-rose-50 ring-rose-200' : 'bg-emerald-50 ring-emerald-200')}>
        <p className="font-mono text-3xl font-bold tracking-[0.15em] text-slate-950">{tMaybe(r.plateNumber) ?? t('NO PLATE')}</p>
        <p className="mt-1 text-sm text-slate-700">{[r.vehicleLabel, r.customerName].filter(Boolean).join(' • ')}</p>
        <p className={cn('mt-3 flex items-start gap-2 text-sm font-medium', r.status === 'Refused' ? 'text-rose-800' : 'text-emerald-700')}>
          {r.status === 'Refused' ? <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />}
          {tMaybe(handled.message)}
        </p>
      </div>
    </div>
  )
}
