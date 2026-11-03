import { useState } from 'react'
import { CalendarClock, Coins, FlaskConical, Power, RotateCcw, Save, TriangleAlert } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { EndOfDayPanel } from '@/components/features/simulation/EndOfDayPanel'
import { WalkInSimulationPanel } from '@/components/features/simulation/WalkInSimulationPanel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError, Input, Label } from '@/components/ui/form-controls'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { getErrorMessage } from '@/api/apiError'
import { useParkingSimulation, useUpdateParkingSimulation } from '@/hooks/useParkingSimulation'
import { cn } from '@/lib/utils'
import {
  SIMULATION_MAX_SECONDS,
  SIMULATION_MIN_SECONDS,
  type ParkingSimulationDTO,
  type ParkingSimulationNormalDTO,
  type ParkingSimulationTimes,
} from '@/types/simulation.dto'

type TimeKey = keyof ParkingSimulationTimes
/** Typed values, kept as text so a field can be cleared while editing. */
type Draft = Record<TimeKey, string>

/** Values the screen starts from when "Demo values" is pressed. */
const DEMO_VALUES: ParkingSimulationTimes = {
  blockSeconds: 5,
  depositHoldSeconds: 15,
  holdSeconds: 15,
  depositPaymentSeconds: 15,
  earlyArrivalSeconds: 15,
  cancelRefundSeconds: 15,
  exitWindowSeconds: 15,
}

/** Quick picks for the block length; any other number can be typed. */
const BLOCK_PRESETS = [3, 4, 5, 7, 10, 15]

interface BookingField {
  key: Exclude<TimeKey, 'blockSeconds'>
  label: string
  help: string
  normal: (n: ParkingSimulationNormalDTO) => number
}

const BOOKING_FIELDS: BookingField[] = [
  { key: 'depositHoldSeconds', label: 'Hold with deposit', help: 'How long the bay waits after the arrival time for a booking with a paid deposit.', normal: (n) => n.depositHoldMinutes },
  { key: 'holdSeconds', label: 'Hold without deposit', help: 'How long the bay waits after the arrival time for a booking without a deposit.', normal: (n) => n.holdMinutes },
  { key: 'depositPaymentSeconds', label: 'Deposit payment deadline', help: 'Time to pay the deposit after booking; later the booking expires.', normal: (n) => n.depositPaymentMinutes },
  { key: 'earlyArrivalSeconds', label: 'Early check-in', help: 'Check-in opens this long before the arrival time.', normal: (n) => n.earlyArrivalMinutes },
  { key: 'cancelRefundSeconds', label: 'Free cancellation', help: 'Cancel with a full refund, or change the booking, until this long before arrival.', normal: (n) => n.cancelRefundMinutes },
  { key: 'exitWindowSeconds', label: 'Exit window', help: 'Time to leave after paying at the counter or in the app; later a late fee is added.', normal: (n) => n.exitWindowMinutes },
]

const toDraft = (times: ParkingSimulationTimes): Draft =>
  Object.fromEntries(Object.entries(times).map(([k, v]) => [k, String(v)])) as Draft

const timesOf = (s: ParkingSimulationDTO): ParkingSimulationTimes => ({
  blockSeconds: s.blockSeconds,
  depositHoldSeconds: s.depositHoldSeconds,
  holdSeconds: s.holdSeconds,
  depositPaymentSeconds: s.depositPaymentSeconds,
  earlyArrivalSeconds: s.earlyArrivalSeconds,
  cancelRefundSeconds: s.cancelRefundSeconds,
  exitWindowSeconds: s.exitWindowSeconds,
})

/** The whole-number value of a field, or null when it is not a valid number of seconds. */
function secondsOf(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null
  const value = Number(text)
  return value >= SIMULATION_MIN_SECONDS && value <= SIMULATION_MAX_SECONDS ? value : null
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`
const RANGE_ERROR = `Enter a whole number from ${SIMULATION_MIN_SECONDS} to ${SIMULATION_MAX_SECONDS}.`

function SecondsField({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const invalid = secondsOf(value) === null
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Input
          id={id}
          inputMode="numeric"
          className="w-28 tabular-nums"
          value={value}
          aria-invalid={invalid}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
        />
        <span className="text-sm text-slate-500">seconds</span>
      </div>
      {invalid && <FieldError message={RANGE_ERROR} />}
    </div>
  )
}

function SimulationForm({ current }: { current: ParkingSimulationDTO }) {
  const save = useUpdateParkingSimulation()
  const [enabled, setEnabled] = useState(current.enabled)
  const [draft, setDraft] = useState<Draft>(() => toDraft(timesOf(current)))

  const set = (key: TimeKey) => (value: string) => setDraft((d) => ({ ...d, [key]: value }))
  const parsed = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, secondsOf(v)])) as Record<TimeKey, number | null>
  const valid = Object.values(parsed).every((v) => v !== null)
  const block = parsed.blockSeconds

  const submit = (nextEnabled: boolean) => {
    if (!valid) return
    setEnabled(nextEnabled)
    save.mutate({ enabled: nextEnabled, ...(parsed as ParkingSimulationTimes) })
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        submit(enabled)
      }}
    >
      <Card className={cn(current.enabled && 'ring-2 ring-amber-400')}>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Power className="size-4" aria-hidden /> Simulation status
            </CardTitle>
            <CardDescription>Applies to every parking lot as soon as it is saved.</CardDescription>
          </div>
          <Badge tone={current.enabled ? 'amber' : 'neutral'}>{current.enabled ? 'Simulation on' : 'Normal rules'}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {current.enabled && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              Every lot now charges and times bookings in seconds, for every customer. Turn it off after the demo.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {current.enabled ? (
              <Button variant="outline" disabled={save.isPending || !valid} onClick={() => submit(false)}>
                <Power aria-hidden /> Turn off
              </Button>
            ) : (
              <Button variant="gold" disabled={save.isPending || !valid} onClick={() => submit(true)}>
                <FlaskConical aria-hidden /> Turn on with these values
              </Button>
            )}
            <Button type="submit" variant="secondary" disabled={save.isPending || !valid}>
              <Save aria-hidden /> {save.isPending ? 'Saving…' : 'Save values'}
            </Button>
            <Button variant="ghost" disabled={save.isPending} onClick={() => setDraft(toDraft(DEMO_VALUES))}>
              <RotateCcw aria-hidden /> Demo values
            </Button>
          </div>
          {save.isError && <FieldError message={getErrorMessage(save.error)} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Coins className="size-4" aria-hidden /> Parking fee
            </CardTitle>
            <CardDescription>
              Every pricing rule keeps its block price, but one block lasts this many seconds instead of its minutes or hours.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sim-blockSeconds">Block length</Label>
            <SecondsField id="sim-blockSeconds" value={draft.blockSeconds} onChange={set('blockSeconds')} />
            <div className="flex flex-wrap gap-1.5">
              {BLOCK_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  size="sm"
                  variant={block === preset ? 'default' : 'outline'}
                  onClick={() => set('blockSeconds')(String(preset))}
                >
                  {preset}s
                </Button>
              ))}
            </div>
          </div>
          {block !== null && (
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              Example: a rule of <strong>30,000 VND per hour</strong> charges <strong>30,000 VND every {plural(block, 'second')}</strong>.
              A car that stays {block * 3} seconds pays 3 blocks = 90,000 VND. The daily cap is not applied while the simulation is on;
              turned off, the Manager&apos;s pricing rules apply again exactly as set.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4" aria-hidden /> Booking and exit times
            </CardTitle>
            <CardDescription>
              Bookings and payments made while the simulation is on use these times. Expired bookings and no-shows are checked every second.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-slate-100">
            {BOOKING_FIELDS.map((field) => (
              <li key={field.key} className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto] sm:items-start">
                <div>
                  <Label htmlFor={`sim-${field.key}`}>{field.label}</Label>
                  <p className="mt-0.5 text-sm text-slate-500">{field.help}</p>
                  <p className="mt-1 text-xs text-slate-400">Normally {plural(field.normal(current.normal), 'minute')}</p>
                </div>
                <SecondsField id={`sim-${field.key}`} value={draft[field.key]} onChange={set(field.key)} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </form>
  )
}

/** Admin screen to run fees and booking times in seconds for demos (every lot). */
export default function ParkingSimulationPage() {
  const simulation = useParkingSimulation()

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Demo tools"
        title="Parking Simulation"
        description="Speed up time to show fees and booking rules in a few seconds: charge a pricing block every few seconds and shorten holds and deadlines."
      />
      {simulation.isPending && <Skeleton className="h-96 rounded-xl" />}
      {simulation.isError && (
        <ErrorState message={getErrorMessage(simulation.error, 'Could not load the parking simulation.')} onRetry={() => void simulation.refetch()} />
      )}
      {simulation.data && (
        // Re-mount when the saved values change so the form shows what the server stored
        <SimulationForm key={`${simulation.data.updatedAt ?? 'new'}-${simulation.data.enabled}`} current={simulation.data} />
      )}
      {simulation.data && <WalkInSimulationPanel simulating={simulation.data.enabled} />}
      {simulation.data && <EndOfDayPanel />}
    </div>
  )
}
