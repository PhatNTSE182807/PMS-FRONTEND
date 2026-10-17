import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Bike,
  CalendarClock,
  Car,
  Clock,
  Hourglass,
  LogIn,
  LogOut,
  Moon,
  Plug,
  ShieldCheck,
  Terminal,
  TicketX,
  Zap,
} from 'lucide-react'
import { Kpi, WithManagerLot } from '@/components/features/manager/ManagerBits'
import { formatMinutes, vnd } from '@/components/features/manager/managerFormat'
import { DemoTag, PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox, Input, Label, NativeSelect } from '@/components/ui/form-controls'
import { cn } from '@/lib/utils'
import { demoTariffs, EV_ENERGY_RATE, type TariffClass } from '@/mocks/managerOps.mock'
import type { ManagedLot } from '@/types/lot-management.dto'

const CLASS_ICON: Record<TariffClass['id'], typeof Car> = { CAR: Car, MOTORBIKE: Bike, EV: Zap }

/** "2026-10-18T08:30" for <input type="datetime-local">, in local time. */
function localInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Whether [start, end) touches the overnight window 23:00–06:00 on any night. */
function crossesOvernight(start: number, end: number) {
  for (let t = start; t < end; t += 15 * 60_000) {
    const h = new Date(t).getHours()
    if (h >= 23 || h < 6) return true
  }
  return false
}

interface Line {
  label: string
  amount: number
}

/** Fee for one visit under a tariff class: the same rules the gates apply at exit. */
function computeFee(t: TariffClass, start: number, end: number, opts: { deposit: number; lostTicket: boolean; kwh: number }) {
  const minutes = Math.max(0, Math.round((end - start) / 60_000))
  const lines: Line[] = []
  if (minutes <= t.graceMinutes) {
    lines.push({ label: `Grace period (${minutes} min ≤ ${t.graceMinutes} min)`, amount: 0 })
  } else {
    lines.push({ label: `First block (${formatMinutes(Math.min(minutes, t.firstBlockMinutes))})`, amount: t.firstBlockPrice })
    const rest = minutes - t.firstBlockMinutes
    if (rest > 0) {
      const blocks = Math.ceil(rest / t.nextBlockMinutes)
      lines.push({ label: `Next ${formatMinutes(rest)} (${blocks} × ${vnd(t.nextBlockPrice)})`, amount: blocks * t.nextBlockPrice })
    }
    if (crossesOvernight(start, end)) lines.push({ label: 'Overnight surcharge (23:00 – 06:00)', amount: t.overnightSurcharge })
    const parking = lines.reduce((s, l) => s + l.amount, 0)
    const cap = Math.ceil(minutes / 1440) * t.dailyCap
    if (parking > cap) lines.push({ label: `Daily cap (${Math.ceil(minutes / 1440)} × ${vnd(t.dailyCap)})`, amount: cap - parking })
  }
  if (t.id === 'EV' && opts.kwh > 0) lines.push({ label: `Energy (${opts.kwh} kWh × ${vnd(EV_ENERGY_RATE)})`, amount: opts.kwh * EV_ENERGY_RATE })
  if (opts.lostTicket) lines.push({ label: 'Lost ticket penalty', amount: t.lostTicketPenalty })
  const accrued = lines.reduce((s, l) => s + l.amount, 0)
  const deposit = Math.min(opts.deposit, accrued)
  return { minutes, lines, accrued, deposit, total: accrued - deposit }
}

function Rule({ icon: Icon, label, value, unit, note, tone }: { icon: typeof Car; label: string; value: string; unit?: string; note: string; tone?: 'gold' | 'red' }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-2">
        <p className={cn('text-xs font-bold tracking-wider uppercase', tone === 'red' ? 'text-rose-700' : 'text-slate-800')}>{label}</p>
        <Icon className={cn('size-4', tone === 'red' ? 'text-rose-400' : 'text-amber-500')} aria-hidden />
      </div>
      <p className={cn('mt-2 font-mono text-2xl font-bold', tone === 'gold' ? 'text-amber-500' : tone === 'red' ? 'text-rose-400' : 'text-slate-950')}>
        {value} {unit && <span className="font-sans text-xs font-medium text-slate-700">{unit}</span>}
      </p>
      <p className="mt-2 text-xs text-slate-700">{note}</p>
    </div>
  )
}

function TariffCard({ t }: { t: TariffClass }) {
  const Icon = CLASS_ICON[t.id]
  return (
    <Card className={cn('border-t-2 p-5', t.id === 'MOTORBIKE' ? 'border-amber-500' : 'border-indigo-700')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-11 place-items-center rounded-lg bg-slate-100 text-indigo-700">
            <Icon className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="flex flex-wrap items-center gap-2 font-display text-xl font-semibold text-slate-950">
              {t.name}
              <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-indigo-700 uppercase">Active tier</span>
            </h2>
            <p className="text-sm text-slate-700">{t.description}</p>
          </div>
        </div>
        <div className="rounded-lg bg-[#060f16] px-3 py-2 text-right">
          <p className="text-[10px] font-bold tracking-wider text-slate-700 uppercase">Max 24h</p>
          <p className="font-mono font-bold text-amber-500">{vnd(t.dailyCap)}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Rule icon={Hourglass} label="Grace period" value={String(t.graceMinutes)} unit="min free" note="No charge if the vehicle leaves within this time." />
        <Rule icon={Clock} label={`First block (${formatMinutes(t.firstBlockMinutes)})`} value={t.firstBlockPrice.toLocaleString('en-US')} unit="VND" tone="gold" note="Billed once, on entry past the grace period." />
        <Rule icon={CalendarClock} label={`Each next ${formatMinutes(t.nextBlockMinutes)}`} value={t.nextBlockPrice.toLocaleString('en-US')} unit="VND" note="Charged per started block after the first one." />
        <Rule icon={Moon} label="Overnight surcharge" value={t.overnightSurcharge.toLocaleString('en-US')} unit="VND flat" note="Added once when the stay touches 23:00 – 06:00." />
        <Rule icon={LogOut} label="Exit grace window" value={String(t.exitGraceMinutes)} unit="min" note="Time to leave after paying before charging resumes." />
        <Rule icon={TicketX} label="Lost ticket penalty" value={t.lostTicketPenalty.toLocaleString('en-US')} unit="VND + dwell" tone="red" note="Added to the dwell fee, after identity checks." />
      </div>
      {t.id === 'EV' && (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          <Plug className="size-4 text-amber-500" aria-hidden />
          Energy is metered per bay: <strong className="font-mono text-amber-500">{vnd(EV_ENERGY_RATE)} / kWh</strong> on top of the Class 1 parking fee.
        </p>
      )}
    </Card>
  )
}

function Calculator() {
  const now = new Date()
  const morning = new Date(now)
  morning.setHours(8, 30, 0, 0)
  const afternoon = new Date(now)
  afternoon.setHours(15, 45, 0, 0)

  const [classId, setClassId] = useState<TariffClass['id']>('CAR')
  const [entry, setEntry] = useState(localInput(morning))
  const [exit, setExit] = useState(localInput(afternoon))
  const [deposit, setDeposit] = useState(50_000)
  const [lostTicket, setLostTicket] = useState(false)
  const [kwh, setKwh] = useState(0)

  const tariff = demoTariffs.find((t) => t.id === classId) ?? demoTariffs[0]
  const start = new Date(entry).getTime()
  const end = new Date(exit).getTime()
  const valid = Number.isFinite(start) && Number.isFinite(end) && end > start
  const result = useMemo(
    () => (valid ? computeFee(tariff, start, end, { deposit, lostTicket, kwh }) : null),
    [valid, tariff, start, end, deposit, lostTicket, kwh],
  )

  return (
    <Card className="border-t-2 border-amber-500 p-5 xl:sticky xl:top-24">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-slate-950">
          <Terminal className="size-5 text-amber-500" aria-hidden /> Real-time fee calculator
        </h2>
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-700 uppercase">Sandbox</span>
      </div>
      <p className="mt-2 text-sm text-slate-700">Simulate a barrier checkout under the current tariff before changing it.</p>

      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="calc-class">Vehicle classification</Label>
          <NativeSelect id="calc-class" value={classId} onChange={(e) => setClassId(e.target.value as TariffClass['id'])}>
            {demoTariffs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="calc-entry" className="flex items-center gap-1"><LogIn className="size-3.5" aria-hidden /> Entry</Label>
            <Input id="calc-entry" type="datetime-local" value={entry} onChange={(e) => setEntry(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="calc-exit" className="flex items-center gap-1"><LogOut className="size-3.5" aria-hidden /> Exit</Label>
            <Input id="calc-exit" type="datetime-local" value={exit} onChange={(e) => setExit(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="calc-deposit">Pre-booking deposit</Label>
            <NativeSelect id="calc-deposit" value={deposit} onChange={(e) => setDeposit(Number(e.target.value))}>
              <option value={0}>None</option>
              <option value={20_000}>20,000 VND</option>
              <option value={50_000}>50,000 VND</option>
            </NativeSelect>
          </div>
          {classId === 'EV' ? (
            <div className="space-y-1.5">
              <Label htmlFor="calc-kwh">Energy (kWh)</Label>
              <Input id="calc-kwh" type="number" min={0} value={kwh} onChange={(e) => setKwh(Math.max(0, Number(e.target.value) || 0))} />
            </div>
          ) : (
            <label className="mt-6 flex items-center gap-2 text-sm text-slate-800">
              <Checkbox checked={lostTicket} onChange={(e) => setLostTicket(e.target.checked)} /> Lost ticket
            </label>
          )}
        </div>
      </div>

      {result ? (
        <div className="mt-5 rounded-xl bg-[#060f16] p-4 ring-1 ring-slate-200">
          <p className="flex justify-between text-xs font-bold tracking-wider text-slate-700 uppercase">
            Billing ledger <span className="font-mono text-amber-500">{formatMinutes(result.minutes)} dwell</span>
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {result.lines.map((l) => (
              <li key={l.label} className="flex justify-between gap-3 text-slate-700">
                {l.label}
                <span className="shrink-0 font-mono font-bold text-slate-950">{vnd(l.amount)}</span>
              </li>
            ))}
            {result.deposit > 0 && (
              <li className="flex justify-between gap-3 text-indigo-700">
                Deposit deducted
                <span className="font-mono font-bold">−{vnd(result.deposit)}</span>
              </li>
            )}
          </ul>
          <div className="mt-4 flex items-end justify-between gap-3 rounded-lg bg-slate-50 p-3">
            <span className="text-xs font-bold tracking-wider text-slate-800 uppercase">Settlement at exit gate</span>
            <span className="font-display text-3xl font-bold text-amber-500">{vnd(result.total)}</span>
          </div>
        </div>
      ) : (
        <p className="mt-5 text-sm text-rose-700">The exit time must be after the entry time.</p>
      )}

      <Button
        variant="gold"
        size="lg"
        className="mt-5 w-full"
        onClick={() => toast.info('Tariff deployment will be available once the pricing API exists.')}
      >
        Deploy tariff update to gateways
      </Button>
    </Card>
  )
}

function Pricing({ lot }: { lot: ManagedLot }) {
  const [classFilter, setClassFilter] = useState<'ALL' | TariffClass['id']>('ALL')
  const shown = demoTariffs.filter((t) => classFilter === 'ALL' || t.id === classFilter)
  const car = demoTariffs[0]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-700">Rule engine active</span>
            <span>Schedule v2.4</span>
            <DemoTag />
          </>
        }
        title="Pricing Schedules, Tariff Rules & Simulation"
        description={`${lot.name} • The gates apply these rules at checkout.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Tariff classes" icon={<ShieldCheck />}>
          <p className="mt-3 font-display text-3xl font-bold text-slate-950">{demoTariffs.length} active</p>
        </Kpi>
        <Kpi label="Active window" icon={<Clock />}>
          <p className="mt-3 font-display text-3xl font-bold text-slate-950">{lot.is24Hours ? 'Standard 24/7' : `${lot.openTime} – ${lot.closeTime}`}</p>
        </Kpi>
        <Kpi label="Grace window" icon={<Hourglass />}>
          <p className="mt-3 font-display text-3xl font-bold text-slate-950">{car.graceMinutes} mins <span className="text-sm font-medium text-slate-700">free</span></p>
        </Kpi>
        <Kpi label="EV energy meter" icon={<Zap />}>
          <p className="mt-3 font-display text-3xl font-bold text-amber-500">{vnd(EV_ENERGY_RATE)}<span className="text-sm font-medium text-slate-700">/kWh</span></p>
        </Kpi>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <div role="tablist" aria-label="Tariff class" className="flex flex-wrap gap-1 rounded-xl bg-white p-1.5 ring-1 ring-slate-200">
            {[{ id: 'ALL' as const, name: `All classes (${demoTariffs.length})` }, ...demoTariffs].map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={classFilter === t.id}
                onClick={() => setClassFilter(t.id)}
                className={cn(
                  'rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
                  classFilter === t.id ? 'bg-[#124e66] text-indigo-800' : 'text-slate-700 hover:bg-slate-100',
                )}
              >
                {t.name.split(':')[0]}
              </button>
            ))}
          </div>
          {shown.map((t) => (
            <TariffCard key={t.id} t={t} />
          ))}
        </div>

        <div className="space-y-6">
          <Calculator />
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-slate-950">
              <ShieldCheck className="size-5 text-indigo-700" aria-hidden /> Validation constraints
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li>✓ The grace period is not cumulative: re-entering within 60 minutes continues the previous dwell.</li>
              <li>✓ The daily cap resets at 06:00 (GMT+7) at every gate.</li>
              <li>✓ Gates keep a cached copy of the tariff if the connection to the server drops.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}

/** /management/pricing. Tariffs are demo data until the pricing API exists; the calculator applies them. */
export default function ManagerPricingPage() {
  return <WithManagerLot>{(lot) => <Pricing lot={lot} />}</WithManagerLot>
}
