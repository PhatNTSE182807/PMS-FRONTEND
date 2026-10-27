import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Ban, CircleCheck, DoorOpen, LogIn, ShieldAlert, TriangleAlert, Undo2 } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { Button } from '@/components/ui/button'
import { Checkbox, FieldError, Input, Label, NativeSelect } from '@/components/ui/form-controls'
import { QrCode } from '@/components/ui/qr-code'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useCancelEntry, useCheckIn, useConfirmEntry, useGates, useReservationLookup } from '@/hooks/useGate'
import { useVehicleTypes } from '@/hooks/useProfile'
import { cn } from '@/lib/utils'
import type { CheckInRequest, CheckInResultDTO, GateAlertDTO, GateReservationLookupDTO } from '@/types/operations.dto'
import { Panel, SectionTitle } from './StaffBits'
import { STAFF_TOAST, toastEntryAlerts, toastReservationLookup } from './staffToasts'

/** Alerts the Staff can clear on the next attempt, and the request flag that clears each one. */
const OVERRIDES: Partial<Record<string, { flag: keyof CheckInRequest; label: string }>> = {
  LOW_CONFIDENCE: { flag: 'plateConfirmed', label: 'I checked the plate against the camera image' },
  BLACKLISTED: { flag: 'allowBlacklisted', label: 'Let the blacklisted vehicle in' },
  ZONE_FULL: { flag: 'allowWhenFull', label: 'Let it in although the zone is full' },
  RESERVATION_PLATE_MISMATCH: { flag: 'allowPlateMismatch', label: 'Same account, same vehicle type: accept the changed vehicle' },
  RESERVATION_OUTSIDE_WINDOW: { flag: 'ignoreReservation', label: 'Enter as a walk-in (the booking is kept)' },
  RESERVATION_INVALID: { flag: 'ignoreReservation', label: 'Enter as a walk-in' },
}

const EMPTY: CheckInRequest = { plateNumber: '', anprConfidence: undefined }

const NO_PLATE_REASON_ERROR = 'Enter why the plate cannot be read.'

const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

/**
 * Entry lane console (SRS FR-OPS-01, 4.2.1). The Staff scans the reservation QR or types its code first:
 * the booking and its vehicle show at once and fill the plate and vehicle type. Walk-ins leave it empty and
 * type the plate. Every gate check then runs on the server; a blocked entry lists the alerts and the Staff
 * clears the ones they may override, with a reason. The lot's entry lane is picked automatically. Once the
 * barrier opens the session waits for the loop sensor (or the Staff's "Vehicle passed" press).
 * `embedded` drops the panel frame, for use inside the lanes panel (manual / walk-in entry).
 */
export function EntryLaneConsole({ lotId, embedded = false }: { lotId: string; embedded?: boolean }) {
  const gates = useGates(lotId)
  const vehicleTypes = useVehicleTypes()
  const checkIn = useCheckIn(lotId)
  const confirm = useConfirmEntry()
  const cancel = useCancelEntry()
  const [form, setForm] = useState<CheckInRequest>(EMPTY)
  const [reasonError, setReasonError] = useState<string>()
  const [result, setResult] = useState<CheckInResultDTO | null>(null)
  // Reservation QR payload or RSV… code, looked up as the Staff types or scans
  const [entry, setEntry] = useState('')
  const lookupEntry = useDebouncedValue(entry.trim(), 350)
  const lookup = useReservationLookup(lotId, lookupEntry)
  const found = entry.trim() && lookupEntry === entry.trim() ? lookup.data ?? null : null
  const lookupFailed = Boolean(entry.trim()) && lookupEntry === entry.trim() && lookup.isError
  const [filledFor, setFilledFor] = useState<number | null>(null)

  // One popup per scanned ticket: loaded, used, invalid or expired
  const announced = useRef<string | null>(null)
  useEffect(() => {
    const key = found ? `found:${lookupEntry}` : lookupFailed ? `failed:${lookupEntry}` : null
    if (!key || key === announced.current) return
    announced.current = key
    if (found) toastReservationLookup(found)
    else toast.error(STAFF_TOAST.invalidTicket)
  }, [found, lookupFailed, lookupEntry])

  // A newly found booking fills the plate and vehicle type (adjusting state while rendering, not in an effect)
  if (found && found.reservation.id !== filledFor) {
    setFilledFor(found.reservation.id)
    setForm((f) => ({
      ...f,
      noPlate: false,
      plateNumber: found.reservation.plateNumber ?? f.plateNumber,
      anprConfidence: undefined,
      vehicleTypeId: found.vehicleTypeId || f.vehicleTypeId,
    }))
  }

  const entryGate = (gates.data ?? []).find((g) => g.direction !== 'Out')
  const types = vehicleTypes.data ?? []
  const set = <K extends keyof CheckInRequest>(key: K, value: CheckInRequest[K]) => setForm((f) => ({ ...f, [key]: value }))
  const blocking = result?.outcome === 'Blocked' ? result.alerts.filter((a) => a.blocking) : []
  const overridable = blocking.filter((a) => a.canOverride && OVERRIDES[a.code])
  const usesOverride = overridable.some((a) => form[OVERRIDES[a.code]!.flag])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const reservationEntry = entry.trim()
    const isCode = /^RSV/i.test(reservationEntry)
    // Without a plate the backend skips the duplicate-vehicle and blacklist checks, so the Staff must say why
    // (the reason is kept on the session as a manual entry). A missing reason is a form mistake: shown under the field.
    const noPlate = Boolean(form.noPlate)
    const manualReason = form.manualReason?.trim()
    if (noPlate && !manualReason) {
      setReasonError(NO_PLATE_REASON_ERROR)
      return
    }
    setReasonError(undefined)
    const request: CheckInRequest = {
      ...form,
      gateId: entryGate?.id,
      vehicleTypeId: form.vehicleTypeId ?? types[0]?.id,
      isManual: noPlate || undefined,
      manualReason: noPlate ? manualReason : undefined,
      plateNumber: noPlate ? undefined : form.plateNumber?.trim(),
      reservationQr: reservationEntry && !isCode ? reservationEntry : undefined,
      reservationCode: reservationEntry && isCode ? reservationEntry.toUpperCase() : undefined,
      overrideReason: form.overrideReason?.trim() || undefined,
    }
    checkIn.mutate(request, {
      onSuccess: (r) => {
        setResult(r)
        if (r.outcome === 'Created') toast.success(STAFF_TOAST.checkedIn)
        else toastEntryAlerts(r.alerts, found?.reservation)
      },
      onError: (e) => toast.error(getErrorMessage(e)),
    })
  }

  const next = () => {
    setResult(null)
    setEntry('')
    announced.current = null
    setFilledFor(null)
    setReasonError(undefined)
    setForm((f) => ({ ...EMPTY, vehicleTypeId: f.vehicleTypeId }))
  }

  const session = result?.outcome === 'Created' ? result.session : null

  const body = session ? (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3 rounded-xl bg-[#060f16] p-5 ring-1 ring-slate-200">
            <div>
              <p className="text-xs font-bold tracking-wider text-amber-500 uppercase">{session.sessionType === 'Reservation' ? `Reservation ${session.reservationCode}` : session.sessionType ?? 'Walk-in'}</p>
              <p className="mt-1 font-mono text-3xl font-bold tracking-[0.15em] text-slate-950">{session.plateNumber || 'NO PLATE'}</p>
              <p className="mt-1 text-sm text-slate-700">
                {session.vehicleTypeName} • {session.slotCode ? `Bay ${session.slotCode}` : session.zoneName ?? 'No zone'} • <span className="font-mono">{session.code}</span>
              </p>
            </div>
            {result?.ticket && (
              <div className="w-28 shrink-0 text-center">
                <QrCode value={result.ticket} label={`Entry ticket ${session.code}`} />
                <p className="mt-1 text-[10px] font-bold tracking-wider text-slate-700 uppercase">Signed ticket</p>
              </div>
            )}
          </div>
          {result?.alerts.filter((a) => !a.blocking).map((a) => <AlertRow key={a.code} alert={a} />)}
          {session.status === 'PendingEntry' ? (
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="success"
                disabled={confirm.isPending}
                onClick={() =>
                  confirm.mutate(session.id, {
                    onSuccess: (s) => {
                      setResult((r) => (r ? { ...r, session: s } : r))
                      toast.success(`${s.plateNumber || s.code} is in`, { description: 'Session valid; slot and zone counter updated.' })
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
                  cancel.mutate(session.id, {
                    onSuccess: () => {
                      toast.info('Entry cancelled: the vehicle turned around.')
                      next()
                    },
                    onError: (e) => toast.error(getErrorMessage(e)),
                  })
                }
              >
                <Undo2 /> Turned around
              </Button>
            </div>
          ) : (
            <Button className="w-full" onClick={next}>
              <CircleCheck /> Next vehicle
            </Button>
          )}
        </div>
      ) : (
        <form className="space-y-3" onSubmit={submit}>
          <div>
            <Label htmlFor="lane-reservation">Check-in code or QR (leave empty for a walk-in)</Label>
            <Input
              id="lane-reservation"
              value={entry}
              onChange={(e) => setEntry(/^rsv(?!\.)/i.test(e.target.value) ? e.target.value.toUpperCase() : e.target.value)}
              placeholder="RSV… or scan the QR"
              className="font-mono"
              autoComplete="off"
            />
          </div>

          {entry.trim().length >= 6 && (
            found ? (
              <ReservationCard info={found} />
            ) : lookup.isError && lookupEntry === entry.trim() ? (
              <p className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-200">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {getErrorMessage(lookup.error)}
              </p>
            ) : (
              <p className="text-sm text-slate-600">Looking up the reservation…</p>
            )
          )}

          <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
            <div>
              <Label htmlFor="lane-plate">Plate (ANPR or typed)</Label>
              <Input id="lane-plate" value={form.plateNumber ?? ''} disabled={form.noPlate} onChange={(e) => set('plateNumber', e.target.value.toUpperCase())} placeholder="51A-123.45" className="font-mono uppercase" />
            </div>
            <div>
              <Label htmlFor="lane-conf">ANPR %</Label>
              <Input
                id="lane-conf"
                inputMode="numeric"
                value={form.anprConfidence == null ? '' : Math.round(form.anprConfidence * 100)}
                onChange={(e) => set('anprConfidence', e.target.value === '' ? undefined : Math.min(100, Number(e.target.value.replace(/\D/g, ''))) / 100)}
                placeholder="typed"
                className="font-mono"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="lane-type">Vehicle type</Label>
            <NativeSelect id="lane-type" value={form.vehicleTypeId ?? types[0]?.id ?? ''} onChange={(e) => set('vehicleTypeId', Number(e.target.value))}>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </NativeSelect>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <Checkbox
              checked={Boolean(form.noPlate)}
              onChange={(e) => {
                set('noPlate', e.target.checked)
                setReasonError(undefined)
              }}
            />{' '}
            Plate unreadable or missing: ticket and photo only
          </label>
          {form.noPlate && (
            <div className="space-y-2 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
              <p className="flex items-start gap-2 text-sm text-amber-800">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                Without a plate the duplicate-vehicle and blacklist checks are skipped. Compare the ticket and the photo yourself.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="lane-manual-reason">Reason (required)</Label>
                <Input
                  id="lane-manual-reason"
                  value={form.manualReason ?? ''}
                  placeholder="e.g. Plate covered by mud"
                  autoComplete="off"
                  aria-invalid={Boolean(reasonError)}
                  aria-describedby={reasonError ? 'lane-manual-reason-error' : undefined}
                  onChange={(e) => {
                    set('manualReason', e.target.value)
                    if (reasonError) setReasonError(undefined)
                  }}
                />
                <div id="lane-manual-reason-error">
                  <FieldError message={reasonError} />
                </div>
              </div>
            </div>
          )}

          {blocking.length > 0 && (
            <div className="space-y-2 rounded-xl bg-rose-50 p-3 ring-1 ring-rose-200">
              {blocking.map((a) => <AlertRow key={a.code} alert={a} />)}
              {overridable.map((a) => {
                const { flag, label } = OVERRIDES[a.code]!
                return (
                  <label key={a.code} className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <Checkbox checked={Boolean(form[flag])} onChange={(e) => set(flag, e.target.checked as never)} /> {label}
                  </label>
                )
              })}
              {usesOverride && (
                <Input value={form.overrideReason ?? ''} onChange={(e) => set('overrideReason', e.target.value)} placeholder="Reason (required, kept in the session log)" />
              )}
            </div>
          )}

          <Button type="submit" variant="gold" className="h-11 w-full" disabled={checkIn.isPending || (!form.noPlate && !form.plateNumber?.trim())}>
            <DoorOpen /> {blocking.length ? 'Check again' : 'Check in & open barrier'}
          </Button>
        </form>
      )

  if (embedded) return <div>{body}</div>

  return (
    <Panel>
      <SectionTitle
        icon={<LogIn />}
        aside={
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wider uppercase', session ? 'bg-emerald-100 text-emerald-700' : blocking.length ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700')}>
            {session ? (session.status === 'PendingEntry' ? 'Barrier open' : session.status) : blocking.length ? 'Barrier held' : 'Ready'}
          </span>
        }
      >
        Entry lane
      </SectionTitle>
      {body}
    </Panel>
  )
}

/** Reused by the lanes panel for the alerts of an app request. */
export { AlertRow }

/** The booking behind the scanned QR / typed code: who, which car, which bay, and whether it may enter now. */
function ReservationCard({ info }: { info: GateReservationLookupDTO }) {
  const r = info.reservation
  const car = [info.vehicleBrand, info.vehicleModel].filter(Boolean).join(' ')
  return (
    <div className={cn('space-y-3 rounded-xl p-4 ring-1', info.canCheckIn ? 'bg-emerald-50 ring-emerald-200' : 'bg-rose-50 ring-rose-200')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-wider text-amber-500 uppercase">Reservation {r.code}</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-[0.12em] text-slate-950">{r.plateNumber ?? '—'}</p>
          <p className="mt-0.5 truncate text-sm text-slate-700">
            {[car || null, info.vehicleColor, info.vehicleTypeName].filter(Boolean).join(' • ') || 'Vehicle details unavailable'}
          </p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wider uppercase', info.canCheckIn ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
          {r.status}
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-slate-600">Customer</dt>
          <dd className="truncate font-medium text-slate-900">{info.customerName ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-600">Bay</dt>
          <dd className="font-mono font-medium text-slate-900">{r.slotCode ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-600">Check-in window</dt>
          <dd className="font-mono font-medium text-slate-900">{clock(r.checkInFrom)}–{clock(r.checkInUntil)}</dd>
        </div>
      </dl>
      <p className={cn('flex items-start gap-2 text-sm font-medium', info.canCheckIn ? 'text-emerald-700' : 'text-rose-800')}>
        {info.canCheckIn ? <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> : <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}
        {info.canCheckIn ? 'Ready to check in: plate and vehicle type filled from the booking.' : info.problem}
      </p>
    </div>
  )
}

function AlertRow({ alert }: { alert: GateAlertDTO }) {
  const Icon = alert.code === 'BLACKLISTED' ? Ban : alert.blocking ? ShieldAlert : TriangleAlert
  return (
    <p className={cn('flex items-start gap-2 text-sm', alert.blocking ? 'text-rose-800' : 'text-amber-700')}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        <span className="font-mono text-xs font-bold">{alert.code}</span> {alert.message}
      </span>
    </p>
  )
}

