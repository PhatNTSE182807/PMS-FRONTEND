import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Ban, CircleCheck, DoorOpen, LogIn, ShieldAlert, TriangleAlert } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { Button } from '@/components/ui/button'
import { Checkbox, Input, Label, NativeSelect } from '@/components/ui/form-controls'
import { QrCode } from '@/components/ui/qr-code'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useCheckIn, useConfirmEntry, useFindReservationByPlate, useGates, useReservationLookup } from '@/hooks/useGate'
import { useVehicleTypes } from '@/hooks/useProfile'
import { gateLaneSignals, laneVehicleKind } from '@/lib/gateLaneSignals'
import { cn } from '@/lib/utils'
import type { CheckInRequest, CheckInResultDTO, GateAlertDTO, GateReservationLookupDTO } from '@/types/operations.dto'
import { platesMatch, type LanePlate } from '@/hooks/useLanePlate'
import { PlateMatch } from './LanePlateArea'
import { Panel, SectionTitle } from './StaffBits'
import { STAFF_TOAST, toastEntryAlerts, toastReservationLookup } from './staffToasts'
import { t as tr, tMaybe, currentLocale } from '@/i18n'

/** Alerts the Staff can clear on the next attempt, and the request flag that clears each one. */
const OVERRIDES: Partial<Record<string, { flag: keyof CheckInRequest; label: string }>> = {
  LOW_CONFIDENCE: { flag: 'plateConfirmed', label: 'I checked the plate against the camera image' },
  BLACKLISTED: { flag: 'allowBlacklisted', label: 'Let the blacklisted vehicle in' },
  ZONE_FULL: { flag: 'allowWhenFull', label: 'Let it in although the zone is full' },
  RESERVATION_PLATE_MISMATCH: { flag: 'allowPlateMismatch', label: 'Same account, same vehicle type: accept the changed vehicle' },
  RESERVATION_OUTSIDE_WINDOW: { flag: 'ignoreReservation', label: 'Enter as a walk-in (the booking is kept)' },
  RESERVATION_INVALID: { flag: 'ignoreReservation', label: 'Enter as a walk-in' },
}

const EMPTY: CheckInRequest = {}

const clock = (iso: string) => new Date(iso).toLocaleTimeString(currentLocale(), { hour: '2-digit', minute: '2-digit' })

/**
 * Entry lane console (SRS FR-OPS-01, 4.2.1). The plate comes from the lane's plate area (`lane`): the camera
 * read fills it and the Staff corrects it. The Staff scans the reservation QR or types its code: the booking shows
 * and fills the vehicle type, and the barrier stays closed until the plate matches the booking's registered plate.
 * Walk-ins leave the code empty. Every gate check then runs on the server; a blocked entry lists the alerts and the Staff
 * clears the ones they may override, with a reason. The lot's entry lane is picked automatically. Opening the
 * barrier is the last step: the entry is confirmed at once (team decision 2026-11-04, no "vehicle passed" press).
 * `embedded` drops the panel frame, for use inside the lanes panel (manual / walk-in entry).
 */
export function EntryLaneConsole({ lotId, lane, embedded = false }: { lotId: string; lane: LanePlate; embedded?: boolean }) {
  const gates = useGates(lotId)
  const vehicleTypes = useVehicleTypes()
  const checkIn = useCheckIn(lotId)
  const confirm = useConfirmEntry()
  const [form, setForm] = useState<CheckInRequest>(EMPTY)
  const [result, setResult] = useState<CheckInResultDTO | null>(null)
  // Reservation QR payload or RSV… code, looked up as the Staff types or scans
  const [entry, setEntry] = useState('')
  const lookupEntry = useDebouncedValue(entry.trim(), 350)
  const lookup = useReservationLookup(lotId, lookupEntry)
  const found = entry.trim() && lookupEntry === entry.trim() ? lookup.data ?? null : null
  const lookupFailed = Boolean(entry.trim()) && lookupEntry === entry.trim() && lookup.isError
  const [filledFor, setFilledFor] = useState<number | null>(null)
  const findByPlate = useFindReservationByPlate(lotId)

  // The customer has no code: the plate finds the booking, and its RSV code fills the field above
  const findBooking = () =>
    findByPlate.mutate(lane.plate.trim(), {
      onSuccess: (r) => setEntry(r.reservation.code),
      onError: (e) => toast.error(getErrorMessage(e)),
    })

  // One popup per scanned ticket: loaded, used, invalid or expired
  const announced = useRef<string | null>(null)
  useEffect(() => {
    const key = found ? `found:${lookupEntry}` : lookupFailed ? `failed:${lookupEntry}` : null
    if (!key || key === announced.current) return
    announced.current = key
    if (found) toastReservationLookup(found)
    else toast.error(STAFF_TOAST.invalidTicket)
  }, [found, lookupFailed, lookupEntry])

  // A newly found booking fills the vehicle type (adjusting state while rendering, not in an effect). The plate is
  // not filled from it: the Staff plate must match the booking's plate on its own
  if (found && found.reservation.id !== filledFor) {
    setFilledFor(found.reservation.id)
    setForm((f) => ({ ...f, noPlate: false, vehicleTypeId: found.vehicleTypeId || f.vehicleTypeId }))
  }
  const bookedPlate = found?.reservation.plateNumber ?? null
  // A booking with a registered plate opens the barrier only once the Staff plate matches it
  const plateMismatch = Boolean(bookedPlate && !form.noPlate && !platesMatch(lane.plate, bookedPlate))

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
    const request: CheckInRequest = {
      ...form,
      gateId: entryGate?.id,
      vehicleTypeId: form.vehicleTypeId ?? types[0]?.id,
      plateNumber: form.noPlate ? '' : lane.plate.trim(),
      anprConfidence: form.noPlate ? undefined : lane.confidence,
      noPlateReason: form.noPlate ? form.noPlateReason?.trim() : undefined,
      reservationQr: reservationEntry && !isCode ? reservationEntry : undefined,
      reservationCode: reservationEntry && isCode ? reservationEntry.toUpperCase() : undefined,
      overrideReason: form.overrideReason?.trim() || undefined,
    }
    checkIn.mutate(request, {
      onSuccess: (r) => {
        setResult(r)
        if (r.outcome !== 'Created') {
          toastEntryAlerts(r.alerts, found?.reservation)
          return
        }
        toast.success(STAFF_TOAST.checkedIn)
        lane.clear()
        const s = r.session
        if (!s) return
        // The entry camera shows the barrier lifting and the vehicle driving in
        gateLaneSignals.open('entry', { key: `manual-${s.id}`, plate: s.plateNumber ?? '', kind: laneVehicleKind(s.vehicleTypeName), paint: s.paintColor })
        // Opening the barrier is the last step: the entry is confirmed at once, no "vehicle passed" press
        if (s.status === 'PendingEntry') {
          confirm.mutate(s.id, {
            onSuccess: (confirmed) => setResult((current) => (current ? { ...current, session: confirmed } : current)),
            onError: (e) => toast.error(getErrorMessage(e, 'The barrier opened, but the entry was not recorded.')),
          })
        }
      },
      onError: (e) => toast.error(getErrorMessage(e)),
    })
  }

  const next = () => {
    setResult(null)
    setEntry('')
    announced.current = null
    setFilledFor(null)
    setForm((f) => ({ ...EMPTY, vehicleTypeId: f.vehicleTypeId }))
  }

  const session = result?.outcome === 'Created' ? result.session : null

  const body = session ? (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3 rounded-xl bg-well p-5 ring-1 ring-slate-200">
            <div>
              <p className="text-xs font-bold tracking-wider text-amber-500 uppercase">{session.sessionType === 'Reservation' ? tr('Reservation {reservationCode}', { reservationCode: session.reservationCode }) : tMaybe(session.sessionType) ?? tr('Walk-in')}</p>
              <p className="mt-1 font-mono text-3xl font-bold tracking-[0.15em] text-slate-950">{tMaybe(session.plateNumber) || tr('NO PLATE')}</p>
              <p className="mt-1 text-sm text-slate-700">
                {tMaybe(session.vehicleTypeName)} • {session.slotCode ? tr('Bay {slotCode}', { slotCode: session.slotCode }) : tMaybe(session.zoneName) ?? tr('No zone')} • <span className="font-mono">{session.code}</span>
              </p>
            </div>
            {result?.ticket && (
              <div className="w-28 shrink-0 text-center">
                <QrCode value={result.ticket} label={tr('Entry ticket {code}', { code: session.code })} />
                <p className="mt-1 text-[10px] font-bold tracking-wider text-slate-700 uppercase">{tr('Signed ticket')}</p>
              </div>
            )}
          </div>
          {result?.alerts.filter((a) => !a.blocking).map((a) => <AlertRow key={a.code} alert={a} />)}
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
            <CircleCheck className="size-4 shrink-0" aria-hidden />
            {session.status === 'PendingEntry' ? tr('Barrier open: recording the entry…') : tr('Barrier open: the vehicle is in.')}
          </p>
          <Button className="w-full" disabled={confirm.isPending} onClick={next}>
            <CircleCheck />{' '}{tr('Next vehicle')}
          </Button>
        </div>
      ) : (
        <form className="space-y-3" onSubmit={submit}>
          <div>
            <Label htmlFor="lane-reservation">{tr('Check-in code or QR (leave empty for a walk-in)')}</Label>
            <Input
              id="lane-reservation"
              value={entry}
              onChange={(e) => setEntry(/^rsv(?!\.)/i.test(e.target.value) ? e.target.value.toUpperCase() : e.target.value)}
              placeholder={tr('RSV… or scan the QR')}
              className="font-mono"
              autoComplete="off"
            />
          </div>

          {entry.trim().length >= 6 && (
            found ? (
              <ReservationCard info={found} />
            ) : lookup.isError && lookupEntry === entry.trim() ? (
              <p className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-200">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {tMaybe(getErrorMessage(lookup.error))}
              </p>
            ) : (
              <p className="text-sm text-slate-600">{tr('Looking up the reservation…')}</p>
            )
          )}

          {found && bookedPlate && !form.noPlate && <PlateMatch plate={lane.plate} recorded={bookedPlate} label={tr('booking\'s registered plate')} />}

          {!entry.trim() && !form.noPlate && lane.plate.trim() && (
            <Button type="button" variant="secondary" className="w-full" disabled={findByPlate.isPending} onClick={findBooking}>
              {tr('Find the booking by this plate')}
            </Button>
          )}
          <div>
            <Label htmlFor="lane-type">{tr('Vehicle type')}</Label>
            <NativeSelect id="lane-type" value={form.vehicleTypeId ?? types[0]?.id ?? ''} onChange={(e) => set('vehicleTypeId', Number(e.target.value))}>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{tMaybe(t.name)}</option>
              ))}
            </NativeSelect>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <Checkbox
              checked={Boolean(form.noPlate)}
              onChange={(e) => setForm((f) => ({
                ...f,
                noPlate: e.target.checked,
                ...(e.target.checked ? {} : { noPlateReason: undefined }),
              }))}
            />{' '}{tr('Plate unreadable or missing: ticket and photo only')}
          </label>
          {form.noPlate && (
            <div>
              <Label htmlFor="lane-no-plate-reason">{tr('Reason for no plate')}</Label>
              <Input
                id="lane-no-plate-reason"
                value={form.noPlateReason ?? ''}
                maxLength={500}
                required
                onChange={(e) => set('noPlateReason', e.target.value)}
                placeholder={tr('e.g. plate torn off, covered by mud')}
                autoComplete="off"
              />
            </div>
          )}

          {blocking.length > 0 && (
            <div className="space-y-2 rounded-xl bg-rose-50 p-3 ring-1 ring-rose-200">
              {blocking.map((a) => <AlertRow key={a.code} alert={a} />)}
              {overridable.map((a) => {
                const { flag, label } = OVERRIDES[a.code]!
                return (
                  <label key={a.code} className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <Checkbox checked={Boolean(form[flag])} onChange={(e) => set(flag, e.target.checked as never)} /> {tMaybe(label)}
                  </label>
                )
              })}
              {usesOverride && (
                <Input value={form.overrideReason ?? ''} onChange={(e) => set('overrideReason', e.target.value)} placeholder={tr('Reason (required, kept in the session log)')} />
              )}
            </div>
          )}

          <Button type="submit" variant="gold" className="h-11 w-full" disabled={checkIn.isPending || plateMismatch || (form.noPlate ? !form.noPlateReason?.trim() : !lane.plate.trim())}>
            <DoorOpen /> {blocking.length ? tr('Check again') : tr('Check in & open barrier')}
          </Button>
        </form>
      )

  if (embedded) return <div>{tMaybe(body)}</div>

  return (
    <Panel>
      <SectionTitle
        icon={<LogIn />}
        aside={
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wider uppercase', session ? 'bg-emerald-100 text-emerald-700' : blocking.length ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700')}>
            {session ? (session.status === 'PendingEntry' ? tr('Barrier open') : tMaybe(session.status)) : blocking.length ? tr('Barrier held') : tr('Ready')}
          </span>
        }
      >
        {tr('Entry lane')}
      </SectionTitle>
      {tMaybe(body)}
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
          <p className="text-xs font-bold tracking-wider text-amber-500 uppercase">{tr('Reservation {code}', { code: r.code })}</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-[0.12em] text-slate-950">{tMaybe(r.plateNumber) ?? '—'}</p>
          <p className="mt-0.5 truncate text-sm text-slate-700">
            {[car || null, info.vehicleColor, info.vehicleTypeName].filter(Boolean).join(' • ') || tr('Vehicle details unavailable')}
          </p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wider uppercase', info.canCheckIn ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
          {tMaybe(r.status)}
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-slate-600">{tr('Customer')}</dt>
          <dd className="truncate font-medium text-slate-900">{tMaybe(info.customerName) ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-600">{tr('Bay')}</dt>
          <dd className="font-mono font-medium text-slate-900">{tMaybe(r.slotCode) ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-600">{tr('Check-in window')}</dt>
          <dd className="font-mono font-medium text-slate-900">{clock(r.checkInFrom)}–{clock(r.checkInUntil)}</dd>
        </div>
      </dl>
      <p className={cn('flex items-start gap-2 text-sm font-medium', info.canCheckIn ? 'text-emerald-700' : 'text-rose-800')}>
        {info.canCheckIn ? <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> : <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}
        {info.canCheckIn ? tr('Ready to check in: vehicle type filled from the booking. The Staff plate must match its plate.') : tMaybe(info.problem)}
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
        <span className="font-mono text-xs font-bold">{alert.code}</span> {tMaybe(alert.message)}
      </span>
    </p>
  )
}

