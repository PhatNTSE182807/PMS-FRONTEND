import { useState } from 'react'
import {
  Archive,
  Bike,
  CalendarClock,
  Car,
  CarFront,
  Clock,
  Hourglass,
  LogOut,
  Moon,
  Pencil,
  Plus,
  Power,
  ShieldCheck,
  Sun,
  TicketX,
  HandCoins,
} from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { PricingRuleEditor } from '@/components/features/manager/PricingRuleEditor'
import { Kpi, WithManagerLot } from '@/components/features/manager/ManagerBits'
import { formatMinutes, vnd } from '@/components/features/manager/managerFormat'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { useVehicleTypes } from '@/hooks/useProfile'
import {
  useArchivePricingRule,
  useCreatePricingRule,
  usePricingRules,
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

const STATUS_STYLE: Record<PricingRuleDTO['status'], string> = {
  Active: 'bg-emerald-100 text-emerald-700',
  Draft: 'bg-amber-100 text-amber-700',
  Inactive: 'bg-slate-100 text-slate-700',
  Archived: 'bg-slate-100 text-slate-700',
}

type RuleProps = {
  icon: typeof Car
  label: string
  value: string
  unit?: string
  note: string
  tone?: 'gold' | 'red'
}

function Rule({ icon: Icon, label, value, unit, note, tone }: RuleProps) {
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

const capText = (value: number | null) => (value == null ? 'No cap' : vnd(value))

/**
 * What a vehicle owes the moment it enters: the first block's price, or one normal block (the day price
 * for day/night rules, as a guide; the gate prices it by the hour of entry).
 */
const startingPrice = (prices: PricingRuleDTO) =>
  prices.chargeModel === 'PerEntry'
    ? prices.entryFee
    : (prices.firstBlockPrice ?? (prices.chargeModel === 'DayNight' ? prices.dayPrice : prices.blockPrice) ?? 0)

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
  const perEntry = rule.chargeModel === 'PerEntry'
  const active = rule.status === 'Active'

  const save =(input: Omit<PricingRuleInput, 'vehicleTypeId'>) =>
    update.mutate(
      {
        id: rule.id,
        input: {
          ...input,
          // Fields this page does not edit go back as they are: the API replaces the whole rule
          graceMinutes: rule.graceMinutes,
          overnightSurcharge: rule.overnightSurcharge,
          overstayAfterHours: rule.overstayAfterHours,
          overstaySurchargePerDay: rule.overstaySurchargePerDay,
          noShowFee: rule.noShowFee,
          vehicleTypeId: rule.vehicleTypeId,
          status: rule.status,
          effectiveFrom: rule.effectiveFrom,
        },
      },
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
          <p className="font-mono font-bold text-amber-500">{capText(rule.maxDailyFee)}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {perEntry ? (
          <Rule icon={CalendarClock} label="Fee per day" value={money(rule.entryFee)} unit="VND" tone="gold" note="Charged once for each calendar day of the stay, from entry." />
        ) : (
          <Rule
            icon={Hourglass}
            label={`Starting price (${formatMinutes(rule.firstBlockMinutes ?? block)})`}
            value={money(startingPrice(rule))}
            unit="VND"
            tone="gold"
            note={rule.firstBlockMinutes != null ? 'First block, charged as soon as the vehicle enters.' : 'The first block, charged as soon as the vehicle enters.'}
          />
        )}
        {perEntry ? null : dayNight ? (
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
            label={`Each next ${formatMinutes(block)}`}
            value={money(rule.blockPrice)}
            unit="VND"
            note="Charged per started block, the same at any hour."
          />
        )}
        <Rule icon={LogOut} label="Exit window" value={String(EXIT_WINDOW_MINUTES)} unit="min" note="Time to leave after paying at the counter or in the app." />
        <Rule icon={TicketX} label="Lost ticket fee" value={money(rule.lostTicketFee)} unit="VND + stay" tone="red" note="Added to the parking fee, after identity checks." />
        <Rule
          icon={HandCoins}
          label="Booked bay compensation"
          value={money(rule.bookedBayCompensation ?? 0)}
          unit="VND"
          note="Paid to the wallet when a walk-in took the booked bay and no other bay was free. Off this lot's revenue."
        />
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

/** Default prices for a vehicle type that has no rule yet (the API's defaults). */
function starterRule(type: VehicleTypeDTO): PricingRuleInput {
  const bike = type.code === 'MOTORBIKE'
  return {
    code: `${type.code.replace('_', '')}-STD`,
    name: `${type.name} standard`,
    vehicleTypeId: type.id,
    chargeModel: 'Block',
    entryFee: 0,
    graceMinutes: 0,
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
    // Booked bay compensation: 50,000 VND for motorbikes, 100,000 VND for 4- and 7-seat cars
    bookedBayCompensation: bike ? 50_000 : 100_000,
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
        title="Pricing Rules"
        description={`${lot.name} • 4-seat cars, 7-seat cars and motorbikes. Saved prices apply at once to vehicles entering from now on.`}
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
        <Kpi label="Starting price (4-seat cars)" icon={<Hourglass />}>
          <p className="mt-3 font-display text-3xl font-bold text-slate-950">
            {carRule ? vnd(startingPrice(carRule)) : '—'} <span className="text-sm font-medium text-slate-700">on entry</span>
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

        <div className="space-y-6 xl:sticky xl:top-24">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-slate-950">
              <ShieldCheck className="size-5 text-indigo-700" aria-hidden /> How the gates charge
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li>✓ The first block (the first hour by default) is charged as soon as the vehicle enters: a stay is never free.</li>
              <li>✓ Each started block is charged in full; with day and night prices a block costs the price of the hour it starts in.</li>
              <li>✓ The daily cap applies per calendar day (midnight, Vietnam time); fees are rounded up to 1,000 VND.</li>
              <li>✓ A booking deposit is deducted from the fee at checkout; a lost ticket adds the lost ticket fee to the stay.</li>
              <li>
                ✓ After paying at the counter or in the app the driver has {EXIT_WINDOW_MINUTES} minutes to leave; later, the stay is priced again
                and a late-exit fee is added.
              </li>
              <li>✓ Only Active rules are used; without one the system default price applies.</li>
              <li>✓ While the Admin&apos;s parking simulation is on, every block lasts a few seconds and the daily cap is off.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}

/** /management/pricing: the lot's pricing rules (ManagerPricingController) and how the gates apply them. */
export default function ManagerPricingPage() {
  return <WithManagerLot>{(lot) => <Pricing lot={lot} />}</WithManagerLot>
}
