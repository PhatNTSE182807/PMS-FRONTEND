import { useMemo, useState } from 'react'
import {
  Archive,
  Bike,
  CalendarClock,
  Car,
  CarFront,
  Clock,
  Hourglass,
  LogIn,
  LogOut,
  Moon,
  Pencil,
  Plus,
  Power,
  ShieldCheck,
  Sun,
  Terminal,
  TicketX,
} from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { PricingRuleEditor } from '@/components/features/manager/PricingRuleEditor'
import { Kpi, WithManagerLot } from '@/components/features/manager/ManagerBits'
import { formatMinutes, vnd } from '@/components/features/manager/managerFormat'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Checkbox, Input, Label, NativeSelect } from '@/components/ui/form-controls'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { useVehicleTypes } from '@/hooks/useProfile'
import {
  useArchivePricingRule,
  useCreatePricingRule,
  usePricingRules,
  usePricingSimulation,
  useSetPricingRuleStatus,
  useUpdatePricingRule,
} from '@/hooks/usePricing'
import { cn } from '@/lib/utils'
import type { ManagedLot } from '@/types/lot-management.dto'
import type { PricingRuleDTO, PricingRuleInput } from '@/types/pricing.dto'
import type { VehicleTypeDTO } from '@/types/profile.dto'

/** Minutes a pre-paid vehicle has to leave (BR-10). A system setting, not part of a rule. */
const EXIT_WINDOW_MINUTES = 15

const typeIcon = (code: string) => (code === 'MOTORBIKE' ? Bike : code === 'CAR_7' ? CarFront : Car)

/** "2026-10-18T08:30" for <input type="datetime-local">, in local time. */
function localInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const STATUS_STYLE: Record<PricingRuleDTO['status'], string> = {
  Active: 'bg-emerald-100 text-emerald-700',
  Draft: 'bg-amber-100 text-amber-700',
  Inactive: 'bg-slate-100 text-slate-700',
  Archived: 'bg-slate-100 text-slate-700',
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

const money = (value: number | null | undefined) => (value ?? 0).toLocaleString('en-US')

/** One rule as the gates apply it, with its edit / activate / archive actions. */
function RuleCard({ lotId, rule }: { lotId: string; rule: PricingRuleDTO }) {
  const [editing, setEditing] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const update = useUpdatePricingRule(lotId)
  const setStatus = useSetPricingRuleStatus(lotId)
  const archive = useArchivePricingRule(lotId)
  const Icon = typeIcon(rule.vehicleTypeCode)
  const block = rule.blockMinutes ?? 60
  const dayNight = rule.chargeModel === 'DayNight'
  const active = rule.status === 'Active'

  const save = (input: Omit<PricingRuleInput, 'vehicleTypeId'>) =>
    update.mutate(
      { id: rule.id, input: { ...input, vehicleTypeId: rule.vehicleTypeId, status: rule.status, effectiveFrom: rule.effectiveFrom } },
      { onSuccess: () => setEditing(false) },
    )

  return (
    <Card className={cn('border-t-2 p-5', rule.vehicleTypeCode === 'MOTORBIKE' ? 'border-amber-500' : 'border-indigo-700')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-11 place-items-center rounded-lg bg-slate-100 text-indigo-700">
            <Icon className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="flex flex-wrap items-center gap-2 font-display text-xl font-semibold text-slate-950">
              {rule.vehicleTypeName}
              <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase', STATUS_STYLE[rule.status])}>{rule.status}</span>
            </h2>
            <p className="text-sm text-slate-700">
              {rule.name} • <span className="font-mono">{rule.code}</span> • version {rule.versionNo}
            </p>
          </div>
        </div>
        <div className="rounded-lg bg-[#060f16] px-3 py-2 text-right">
          <p className="text-[10px] font-bold tracking-wider text-slate-700 uppercase">Max per day</p>
          <p className="font-mono font-bold text-amber-500">{rule.maxDailyFee == null ? 'No cap' : vnd(rule.maxDailyFee)}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Rule icon={Hourglass} label="Grace period" value={String(rule.graceMinutes)} unit="min free" note="No charge if the vehicle leaves within this time." />
        {rule.firstBlockMinutes != null && rule.firstBlockPrice != null && (
          <Rule
            icon={Clock}
            label={`First block (${formatMinutes(rule.firstBlockMinutes)})`}
            value={money(rule.firstBlockPrice)}
            unit="VND"
            tone="gold"
            note="Billed once, on entry past the grace period."
          />
        )}
        {dayNight ? (
          <>
            <Rule
              icon={Sun}
              label={`Day • each ${formatMinutes(block)}`}
              value={money(rule.dayPrice)}
              unit="VND"
              tone="gold"
              note={`Blocks starting ${rule.dayStartTime?.slice(0, 5)} – ${rule.nightStartTime?.slice(0, 5)}.`}
            />
            <Rule
              icon={Moon}
              label={`Night • each ${formatMinutes(block)}`}
              value={money(rule.nightPrice)}
              unit="VND"
              note={`Blocks starting ${rule.nightStartTime?.slice(0, 5)} – ${rule.dayStartTime?.slice(0, 5)}.`}
            />
          </>
        ) : (
          <Rule
            icon={CalendarClock}
            label={`${rule.firstBlockMinutes != null ? 'Each next' : 'Each'} ${formatMinutes(block)}`}
            value={money(rule.blockPrice)}
            unit="VND"
            tone={rule.firstBlockMinutes != null ? undefined : 'gold'}
            note="Charged per started block, the same at any hour."
          />
        )}
        <Rule icon={LogOut} label="Exit window" value={String(EXIT_WINDOW_MINUTES)} unit="min" note="Time to leave after paying at the counter or in the app." />
        <Rule icon={TicketX} label="Lost ticket fee" value={money(rule.lostTicketFee)} unit="VND + stay" tone="red" note="Added to the parking fee, after identity checks." />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil /> Edit prices
        </Button>
        <Button variant="outline" size="sm" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: rule.id, status: active ? 'Inactive' : 'Active' })}>
          <Power /> {active ? 'Deactivate' : 'Activate'}
        </Button>
        {!active && (
          <Button variant="outline" size="sm" onClick={() => setArchiving(true)}>
            <Archive /> Archive
          </Button>
        )}
      </div>

      {editing && <PricingRuleEditor rule={rule} open={editing} saving={update.isPending} onOpenChange={setEditing} onSave={save} />}
      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        title="Archive this pricing rule?"
        description="It disappears from this page; its history is kept."
        confirmLabel="Archive"
        onConfirm={() => archive.mutate(rule.id, { onSuccess: () => setArchiving(false) })}
      />
    </Card>
  )
}

/** Fee calculator: asks the API what the gate would charge, with the lot's active rule. */
function Calculator({ lotId, types }: { lotId: string; types: VehicleTypeDTO[] }) {
  const now = new Date()
  const morning = new Date(now)
  morning.setHours(8, 30, 0, 0)
  const afternoon = new Date(now)
  afternoon.setHours(15, 45, 0, 0)

  const [typeId, setTypeId] = useState<number | null>(null)
  const [entry, setEntry] = useState(localInput(morning))
  const [exit, setExit] = useState(localInput(afternoon))
  const [deposit, setDeposit] = useState(0)
  const [lostTicket, setLostTicket] = useState(false)

  const vehicleTypeId = typeId ?? types[0]?.id
  const start = new Date(entry).getTime()
  const end = new Date(exit).getTime()
  const valid = Number.isFinite(start) && Number.isFinite(end) && end > start && vehicleTypeId != null
  const request = useMemo(
    () =>
      valid
        ? { vehicleTypeId, entryTime: new Date(start).toISOString(), exitTime: new Date(end).toISOString(), depositAmount: deposit, isLostTicket: lostTicket }
        : null,
    [valid, vehicleTypeId, start, end, deposit, lostTicket],
  )
  const simulation = usePricingSimulation(lotId, request)
  const result = simulation.data

  return (
    <Card className="border-t-2 border-amber-500 p-5 xl:sticky xl:top-24">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-slate-950">
          <Terminal className="size-5 text-amber-500" aria-hidden /> Fee calculator
        </h2>
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-700 uppercase">Same as the gates</span>
      </div>
      <p className="mt-2 text-sm text-slate-700">What the exit gate would charge for a stay, with the active rule of this lot.</p>

      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="calc-type">Vehicle type</Label>
          <NativeSelect id="calc-type" value={vehicleTypeId ?? ''} onChange={(e) => setTypeId(Number(e.target.value))}>
            {types.map((t) => (
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
            <Label htmlFor="calc-deposit">Booking deposit</Label>
            <NativeSelect id="calc-deposit" value={deposit} onChange={(e) => setDeposit(Number(e.target.value))}>
              <option value={0}>None</option>
              <option value={30_000}>30,000 VND</option>
            </NativeSelect>
          </div>
          <label className="mt-6 flex items-center gap-2 text-sm text-slate-800">
            <Checkbox checked={lostTicket} onChange={(e) => setLostTicket(e.target.checked)} /> Lost ticket
          </label>
        </div>
      </div>

      {!valid ? (
        <p className="mt-5 text-sm text-rose-700">The exit time must be after the entry time.</p>
      ) : simulation.isError ? (
        <p className="mt-5 text-sm text-rose-700">{getErrorMessage(simulation.error)}</p>
      ) : !result ? (
        <Skeleton className="mt-5 h-40 rounded-xl" />
      ) : (
        <div className={cn('mt-5 rounded-xl bg-[#060f16] p-4 ring-1 ring-slate-200', simulation.isFetching && 'opacity-70')}>
          <p className="flex justify-between text-xs font-bold tracking-wider text-slate-700 uppercase">
            Billing ledger <span className="font-mono text-amber-500">{formatMinutes(result.durationMinutes)} stay</span>
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {result.withinGrace && (
              <li className="flex justify-between gap-3 text-slate-700">
                Within the grace period
                <span className="font-mono font-bold text-slate-950">{vnd(0)}</span>
              </li>
            )}
            {result.days.map((d) => (
              <li key={d.date} className="flex justify-between gap-3 text-slate-700">
                <span>
                  {new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} • {formatMinutes(d.minutes)}, {d.blocks} {d.blocks === 1 ? 'block' : 'blocks'}
                  {d.capped && <span className="ml-1 text-amber-500">(daily cap)</span>}
                </span>
                <span className="shrink-0 font-mono font-bold text-slate-950">{vnd(d.amount)}</span>
              </li>
            ))}
            {result.lostTicketFee > 0 && (
              <li className="flex justify-between gap-3 text-slate-700">
                Lost ticket fee
                <span className="font-mono font-bold text-slate-950">{vnd(result.lostTicketFee)}</span>
              </li>
            )}
            {result.depositApplied > 0 && (
              <li className="flex justify-between gap-3 text-indigo-700">
                Deposit deducted
                <span className="font-mono font-bold">−{vnd(result.depositApplied)}</span>
              </li>
            )}
          </ul>
          <div className="mt-4 flex items-end justify-between gap-3 rounded-lg bg-slate-50 p-3">
            <span className="text-xs font-bold tracking-wider text-slate-800 uppercase">Due at the exit gate</span>
            <span className="font-display text-3xl font-bold text-amber-500">{vnd(result.amountDue)}</span>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            Rule: {result.ruleName}
            {result.ruleVersion != null && ` (version ${result.ruleVersion})`}
          </p>
        </div>
      )}
    </Card>
  )
}

/** Default prices for a vehicle type that has no rule yet (the API's defaults). */
function starterRule(type: VehicleTypeDTO): PricingRuleInput {
  const bike = type.code === 'MOTORBIKE'
  return {
    code: `${type.code.replace('_', '')}-STD`,
    name: `${type.name} standard`,
    vehicleTypeId: type.id,
    chargeModel: 'Block',
    graceMinutes: 15,
    firstBlockMinutes: null,
    firstBlockPrice: null,
    blockMinutes: bike ? 240 : 60,
    blockPrice: bike ? 5_000 : 20_000,
    dayStartTime: null,
    nightStartTime: null,
    dayPrice: null,
    nightPrice: null,
    maxDailyFee: bike ? 20_000 : 150_000,
    lostTicketFee: bike ? 50_000 : 100_000,
    status: 'Draft',
  }
}

function Pricing({ lot }: { lot: ManagedLot }) {
  const rules = usePricingRules(lot.id)
  const { data: types = [] } = useVehicleTypes()
  const create = useCreatePricingRule(lot.id)
  const [typeFilter, setTypeFilter] = useState<'ALL' | number>('ALL')

  // Cards follow the vehicle-type order (4-seat, 7-seat, motorbike), Active rules first within a type
  const typeOrder = (id: number) => types.find((t) => t.id === id)?.sortOrder ?? 99
  const list = [...(rules.data ?? [])].sort(
    (a, b) => typeOrder(a.vehicleTypeId) - typeOrder(b.vehicleTypeId) || Number(b.status === 'Active') - Number(a.status === 'Active'),
  )
  const shown = list.filter((r) => typeFilter === 'ALL' || r.vehicleTypeId === typeFilter)
  const activeCount = list.filter((r) => r.status === 'Active').length
  const missing = types.filter((t) => !list.some((r) => r.vehicleTypeId === t.id))
  const carRule = list.find((r) => r.status === 'Active' && r.vehicleTypeCode === 'CAR_4')

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-700">Applied at every gate checkout</span>}
        title="Pricing Rules & Fee Calculator"
        description={`${lot.name} • 4-seat cars, 7-seat cars and motorbikes. Saved prices apply from the next checkout.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Active rules" icon={<ShieldCheck />}>
          <p className="mt-3 font-display text-3xl font-bold text-slate-950">
            {activeCount} <span className="text-sm font-medium text-slate-700">of {list.length}</span>
          </p>
        </Kpi>
        <Kpi label="Opening hours" icon={<Clock />}>
          <p className="mt-3 font-display text-3xl font-bold text-slate-950">{lot.is24Hours ? '24/7' : `${lot.openTime} – ${lot.closeTime}`}</p>
        </Kpi>
        <Kpi label="Grace period (cars)" icon={<Hourglass />}>
          <p className="mt-3 font-display text-3xl font-bold text-slate-950">
            {carRule ? `${carRule.graceMinutes} min` : '—'} <span className="text-sm font-medium text-slate-700">free</span>
          </p>
        </Kpi>
        <Kpi label="Day / night pricing" icon={<Sun />}>
          <p className="mt-3 font-display text-3xl font-bold text-amber-500">
            {list.filter((r) => r.chargeModel === 'DayNight').length} <span className="text-sm font-medium text-slate-700">rules by the hour</span>
          </p>
        </Kpi>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <div role="tablist" aria-label="Vehicle type" className="flex flex-wrap gap-1 rounded-xl bg-white p-1.5 ring-1 ring-slate-200">
            {[{ id: 'ALL' as const, name: `All (${list.length})` }, ...types].map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={typeFilter === t.id}
                onClick={() => setTypeFilter(t.id)}
                className={cn('rounded-lg px-3.5 py-2 text-sm font-medium transition-colors', typeFilter === t.id ? 'bg-[#124e66] text-indigo-800' : 'text-slate-700 hover:bg-slate-100')}
              >
                {t.name}
              </button>
            ))}
          </div>

          {rules.isPending && Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
          {rules.isError && (
            <Card>
              <ErrorState message={getErrorMessage(rules.error)} onRetry={() => rules.refetch()} />
            </Card>
          )}
          {shown.map((r) => (
            <RuleCard key={r.id} lotId={lot.id} rule={r} />
          ))}

          {!rules.isPending && missing.length > 0 && (
            <Card className="space-y-3 p-5">
              <p className="text-sm text-slate-700">
                No rule yet for <strong className="text-slate-950">{missing.map((t) => t.name).join(', ')}</strong>: the gates use the system default
                price until you add and activate one.
              </p>
              <div className="flex flex-wrap gap-2">
                {missing.map((t) => (
                  <Button key={t.id} variant="outline" size="sm" disabled={create.isPending} onClick={() => create.mutate(starterRule(t))}>
                    <Plus /> Add {t.name} rule
                  </Button>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Calculator lotId={lot.id} types={types} />
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-slate-950">
              <ShieldCheck className="size-5 text-indigo-700" aria-hidden /> How the gates charge
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li>✓ Leaving within the grace period is free; past it, the time is charged from the first minute.</li>
              <li>✓ Each started block is charged in full; with day and night prices a block costs the price of the hour it starts in.</li>
              <li>✓ The daily cap applies per calendar day (midnight, Vietnam time); fees are rounded up to 1,000 VND.</li>
              <li>✓ Only Active rules are used; without one the system default price applies.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}

/** /management/pricing: the lot's pricing rules (ManagerPricingController) and a fee calculator using the same engine. */
export default function ManagerPricingPage() {
  return <WithManagerLot>{(lot) => <Pricing lot={lot} />}</WithManagerLot>
}
