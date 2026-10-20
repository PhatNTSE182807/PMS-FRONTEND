import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Ban, CircleCheck, DoorOpen, LogIn, ShieldAlert, TriangleAlert, Undo2 } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { Button } from '@/components/ui/button'
import { Checkbox, Input, Label, NativeSelect } from '@/components/ui/form-controls'
import { QrCode } from '@/components/ui/qr-code'
import { useCancelEntry, useCheckIn, useConfirmEntry, useGates } from '@/hooks/useGate'
import { useVehicleTypes } from '@/hooks/useProfile'
import { cn } from '@/lib/utils'
import type { CheckInRequest, CheckInResultDTO, GateAlertDTO } from '@/types/operations.dto'
import { Panel, SectionTitle } from './StaffBits'

/** Alerts the Staff can clear on the next attempt, and the request flag that clears each one. */
const OVERRIDES: Partial<Record<string, { flag: keyof CheckInRequest; label: string }>> = {
  LOW_CONFIDENCE: { flag: 'plateConfirmed', label: 'I checked the plate against the camera image' },
  BLACKLISTED: { flag: 'allowBlacklisted', label: 'Let the blacklisted vehicle in' },
  ZONE_FULL: { flag: 'allowWhenFull', label: 'Let it in although the zone is full (BR-19)' },
  RESERVATION_PLATE_MISMATCH: { flag: 'allowPlateMismatch', label: 'Same account, same vehicle type: accept the changed vehicle' },
  RESERVATION_OUTSIDE_WINDOW: { flag: 'ignoreReservation', label: 'Enter as a walk-in (the booking is kept)' },
  RESERVATION_INVALID: { flag: 'ignoreReservation', label: 'Enter as a walk-in' },
}

const EMPTY: CheckInRequest = { plateNumber: '', anprConfidence: undefined, reservationQr: '', reservationCode: '' }

/**
 * Entry lane console (SRS FR-OPS-01, 4.2.1): plate from ANPR or typed, reservation QR / code, then every
 * gate check runs on the server. A blocked entry lists the alerts; the Staff clears the ones they may
 * override, with a reason. Once the barrier opens the session waits for the loop sensor (or the Staff's
 * "Vehicle passed" press when the sensor is down).
 */
export function EntryLaneConsole({ lotId }: { lotId: string }) {
  const gates = useGates(lotId)
  const vehicleTypes = useVehicleTypes()
  const checkIn = useCheckIn(lotId)
  const confirm = useConfirmEntry()
  const cancel = useCancelEntry()
  const [form, setForm] = useState<CheckInRequest>(EMPTY)
  const [result, setResult] = useState<CheckInResultDTO | null>(null)

  const entryGates = (gates.data ?? []).filter((g) => g.direction !== 'Out')
  const types = vehicleTypes.data ?? []
  const set = <K extends keyof CheckInRequest>(key: K, value: CheckInRequest[K]) => setForm((f) => ({ ...f, [key]: value }))
  const blocking = result?.outcome === 'Blocked' ? result.alerts.filter((a) => a.blocking) : []
  const overridable = blocking.filter((a) => a.canOverride && OVERRIDES[a.code])
  const usesOverride = overridable.some((a) => form[OVERRIDES[a.code]!.flag])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const request: CheckInRequest = {
      ...form,
      gateId: form.gateId ?? entryGates[0]?.id,
      vehicleTypeId: form.vehicleTypeId ?? types[0]?.id,
      plateNumber: form.noPlate ? undefined : form.plateNumber?.trim(),
      reservationQr: form.reservationQr?.trim() || undefined,
      reservationCode: form.reservationCode?.trim() || undefined,
      overrideReason: form.overrideReason?.trim() || undefined,
    }
    checkIn.mutate(request, {
      onSuccess: (r) => {
        setResult(r)
        if (r.outcome === 'Created') toast.success(`Barrier open for ${r.session?.plateNumber || 'the plate-less vehicle'}`, { description: 'Waiting for the loop sensor.' })
      },
      onError: (e) => toast.error(getErrorMessage(e)),
    })
  }

  const next = () => {
    setResult(null)
    setForm((f) => ({ ...EMPTY, gateId: f.gateId, vehicleTypeId: f.vehicleTypeId }))
  }

  const session = result?.outcome === 'Created' ? result.session : null

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

      {session ? (
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="lane-gate">Lane</Label>
              <NativeSelect id="lane-gate" value={form.gateId ?? entryGates[0]?.id ?? ''} onChange={(e) => set('gateId', Number(e.target.value))}>
                {entryGates.map((g) => (
                  <option key={g.id} value={g.id}>{g.code} • {g.name}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="lane-type">Vehicle type</Label>
              <NativeSelect id="lane-type" value={form.vehicleTypeId ?? types[0]?.id ?? ''} onChange={(e) => set('vehicleTypeId', Number(e.target.value))}>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </NativeSelect>
            </div>
          </div>
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
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <Checkbox checked={Boolean(form.noPlate)} onChange={(e) => set('noPlate', e.target.checked)} /> No plate (bicycle, e-bike): ticket and photo only
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="lane-qr">Reservation QR (scanned)</Label>
              <Input id="lane-qr" value={form.reservationQr ?? ''} onChange={(e) => set('reservationQr', e.target.value)} placeholder="rsv.…" className="font-mono" />
            </div>
            <div>
              <Label htmlFor="lane-code">or reservation code</Label>
              <Input id="lane-code" value={form.reservationCode ?? ''} onChange={(e) => set('reservationCode', e.target.value.toUpperCase())} placeholder="RSV…" className="font-mono uppercase" />
            </div>
          </div>

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
      )}
    </Panel>
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

