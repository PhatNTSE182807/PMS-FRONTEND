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
  Truck,
} from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { PricingDraftList } from '@/components/features/manager/PricingDraftList'
import { PricingHistoryPanel } from '@/components/features/manager/PricingHistoryPanel'
import { PricingRuleEditor, type PricingEditorValues } from '@/components/features/manager/PricingRuleEditor'
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
  useApplyPricingDraft,
  useArchivePricingRule,
  useCreatePricingRule,
  useDiscardPricingDraft,
  usePricingDrafts,
  usePricingRules,
  useSavePricingDraft,
  useSetPricingRuleStatus,
  useUpdatePricingRule,
} from '@/hooks/usePricing'
import { cn } from '@/lib/utils'
import type { ManagedLot } from '@/types/lot-management.dto'
import type { PricingRuleDraftDTO, PricingRuleDTO, PricingRuleInput } from '@/types/pricing.dto'
import type { VehicleTypeDTO } from '@/types/profile.dto'
import { t as tr, tMaybe, numberLocale } from '@/i18n'

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
        <p className={cn('text-xs font-bold tracking-wider uppercase', tone === 'red' ? 'text-rose-700' : 'text-slate-800')}>{tMaybe(label)}</p>
        <Icon className={cn('size-4', tone === 'red' ? 'text-rose-400' : 'text-amber-500')} aria-hidden />
      </div>
      <p className={cn('mt-2 font-mono text-2xl font-bold', tone === 'gold' ? 'text-amber-500' : tone === 'red' ? 'text-rose-400' : 'text-slate-950')}>
        {tMaybe(value)} {unit && <span className="font-sans text-xs font-medium text-slate-700">{tMaybe(unit)}</span>}
      </p>
      <p className="mt-2 text-xs text-slate-700">{tMaybe(note)}</p>
    </div>
  )
}

const money = (value: number | null | undefined) => (value ?? 0).toLocaleString(numberLocale())

const capText = (value: number | null) => (value == null ? 'No cap' : vnd(value))

/**
 * What a vehicle owes the moment it enters: the first block's price, or one normal block (the day price
 * for day/night rules, as a guide; the gate prices it by the hour of entry).
 */
const startingPrice = (prices: PricingRuleDTO) =>
  prices.chargeModel === 'PerEntry'
    ? prices.entryFee
    : (prices.firstBlockPrice ?? (prices.chargeModel === 'DayNight' ? prices.dayPrice : prices.blockPrice) ?? 0)

/** One rule as the gates apply it, with its edit / activate / archive actions and its saved price drafts. */
function RuleCard({ lotId, rule, drafts }: { lotId: string; rule: PricingRuleDTO; drafts: PricingRuleDraftDTO[] }) {
  // "live": editing the live prices; a draft: editing that saved draft
  const [editing, setEditing] = useState<'live' | PricingRuleDraftDTO | null>(null)
  const [archiving, setArchiving] = useState(false)
  const update = useUpdatePricingRule(lotId)
  const setStatus = useSetPricingRuleStatus(lotId)
  const archive = useArchivePricingRule(lotId)
  const saveDraft = useSavePricingDraft(lotId)
  const applyDraft = useApplyPricingDraft(lotId)
  const discardDraft = useDiscardPricingDraft(lotId)
  const editedDraft = editing && editing !== 'live' ? editing : null
  const Icon = typeIcon(rule.vehicleTypeCode)
  const block = rule.blockMinutes ?? 60
  const dayNight = rule.chargeModel === 'DayNight'
  const perEntry = rule.chargeModel === 'PerEntry'
  const active = rule.status === 'Active'

  /** The full rule values for the API: fields this page does not edit go back as they are (the API replaces the whole rule). */
  const full = (input: PricingEditorValues): PricingRuleInput => ({
    ...input,
    graceMinutes: rule.graceMinutes,
    overnightSurcharge: rule.overnightSurcharge,
    overstayAfterHours: rule.overstayAfterHours,
    overstaySurchargePerDay: rule.overstaySurchargePerDay,
    noShowFee: rule.noShowFee,
    vehicleTypeId: rule.vehicleTypeId,
    status: rule.status,
    effectiveFrom: rule.effectiveFrom,
  })
  const close = () => setEditing(null)

  // Applying from the editor: the live prices, or the edited draft (saved with its latest values first)
  const save = (input: PricingEditorValues, note: string) =>
    editedDraft
      ? applyDraft.mutate({ ruleId: rule.id, draftId: editedDraft.id, input: { values: full(input), note } }, { onSuccess: close })
      : update.mutate({ id: rule.id, input: full(input) }, { onSuccess: close })

  const keepDraft = (input: PricingEditorValues, note: string) =>
    saveDraft.mutate({ ruleId: rule.id, draftId: editedDraft?.id, input: { values: full(input), note } }, { onSuccess: close })

  return (
    <Card className={cn('border-t-2 p-5', rule.vehicleTypeCode === 'MOTORBIKE' ? 'border-amber-500' : 'border-indigo-700')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-11 place-items-center rounded-lg bg-slate-100 text-indigo-700">
            <Icon className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="flex flex-wrap items-center gap-2 font-display text-xl font-semibold text-slate-950">
              {tMaybe(rule.vehicleTypeName)}
              <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase', STATUS_STYLE[rule.status])}>{tMaybe(rule.status)}</span>
            </h2>
            <p className="text-sm text-slate-700">
              {tMaybe(rule.name)} • <span className="font-mono">{rule.code}</span>{' '}{tr('• version {versionNo}', { versionNo: rule.versionNo })}
            </p>
          </div>
        </div>
        <div className="rounded-lg bg-well px-3 py-2 text-right">
          <p className="text-[10px] font-bold tracking-wider text-slate-700 uppercase">{tr('Max per day')}</p>
          <p className="font-mono font-bold text-amber-500">{tMaybe(capText(rule.maxDailyFee))}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {perEntry ? (
          <Rule icon={CalendarClock} label={tr('Fee per day')} value={money(rule.entryFee)} unit={tr('VND')} tone="gold" note={tr('Charged once for each calendar day of the stay, from entry.')} />
        ) : (
          <Rule
            icon={Hourglass}
            label={tr('Starting price ({v})', { v: formatMinutes(rule.firstBlockMinutes ?? block) })}
            value={money(startingPrice(rule))}
            unit={tr('VND')}
            tone="gold"
            note={rule.firstBlockMinutes != null ? tr('First block, charged as soon as the vehicle enters.') : tr('The first block, charged as soon as the vehicle enters.')}
          />
        )}
        {perEntry ? null : dayNight ? (
          <>
            <Rule
              icon={Sun}
              label={tr('Day • each {v}', { v: formatMinutes(block) })}
              value={money(rule.dayPrice)}
              unit={tr('VND')}
              tone="gold"
              note={tr('Blocks starting {v} – {v2}.', { v: rule.dayStartTime?.slice(0, 5), v2: rule.nightStartTime?.slice(0, 5) })}
            />
            <Rule
              icon={Moon}
              label={tr('Night • each {v}', { v: formatMinutes(block) })}
              value={money(rule.nightPrice)}
              unit={tr('VND')}
              note={tr('Blocks starting {v} – {v2}.', { v: rule.nightStartTime?.slice(0, 5), v2: rule.dayStartTime?.slice(0, 5) })}
            />
          </>
        ) : (
          <Rule
            icon={CalendarClock}
            label={tr('Each next {v}', { v: formatMinutes(block) })}
            value={money(rule.blockPrice)}
            unit={tr('VND')}
            note={tr('Charged per started block, the same at any hour.')}
          />
        )}
        <Rule icon={LogOut} label={tr('Exit window')} value={String(EXIT_WINDOW_MINUTES)} unit={tr('min')} note={tr('Time to leave after paying at the counter or in the app.')} />
        <Rule icon={TicketX} label={tr('Lost ticket fee')} value={money(rule.lostTicketFee)} unit={tr('VND + stay')} tone="red" note={tr('Added to the parking fee, after identity checks.')} />
        <Rule
          icon={HandCoins}
          label={tr('Booked bay compensation')}
          value={money(rule.bookedBayCompensation ?? 0)}
          unit={tr('VND')}
          note={tr('Paid to the wallet when a walk-in took the booked bay and no other bay was free. Off this lot\'s revenue.')}
        />
        <Rule
          icon={Truck}
          label={tr('Towing penalty')}
          value={money(rule.penaltyFee ?? 0)}
          unit={tr('VND + stay')}
          tone="red"
          note={tr('Added to the fee of a vehicle towed out of a booked bay into a penalty bay.')}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditing('live')}>
          <Pencil />{' '}{tr('Edit prices')}
        </Button>
        <Button variant="outline" size="sm" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: rule.id, status: active ? 'Inactive' : 'Active' })}>
          <Power /> {active ? tr('Deactivate') : tr('Activate')}
        </Button>
        {!active && (
          <Button variant="outline" size="sm" onClick={() => setArchiving(true)}>
            <Archive />{' '}{tr('Archive')}
          </Button>
        )}
      </div>

      <PricingDraftList
        rule={rule}
        drafts={drafts}
        applying={applyDraft.isPending}
        discarding={discardDraft.isPending}
        onEdit={setEditing}
        onApply={(draft, done) => applyDraft.mutate({ ruleId: rule.id, draftId: draft.id }, { onSuccess: done })}
        onDiscard={(draft, done) => discardDraft.mutate({ ruleId: rule.id, draftId: draft.id }, { onSuccess: done })}
      />

      {editing && (
        <PricingRuleEditor
          // A new form for each draft, so its values are read again
          key={editedDraft ? `draft-${editedDraft.id}` : 'live'}
          rule={rule}
          open
          saving={update.isPending || applyDraft.isPending}
          savingDraft={saveDraft.isPending}
          draftValues={editedDraft?.values}
          draftNote={editedDraft?.note}
          onOpenChange={(open) => !open && close()}
          onSave={save}
          onSaveDraft={keepDraft}
        />
      )}
      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        title={tr('Archive this pricing rule?')}
        description={tr('It disappears from this page; its history is kept.')}
        confirmLabel={tr('Archive')}
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
    // Towing penalty: 50,000 VND for motorbikes, 200,000 VND for cars
    penaltyFee: bike ? 50_000 : 200_000,
    status: 'Draft',
  }
}

function Pricing({ lot }: { lot: ManagedLot }) {
  const rules = usePricingRules(lot.id)
  const drafts = usePricingDrafts(lot.id)
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
        title={tr('Pricing Rules')}
       
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={tr('Active rules')} icon={<ShieldCheck />}>
          <p className="mt-3 font-display text-3xl font-bold text-slate-950">
            {tMaybe(activeCount)} <span className="text-sm font-medium text-slate-700">{tr('of {length}', { length: list.length })}</span>
          </p>
        </Kpi>
        <Kpi label={tr('Opening hours')} icon={<Clock />}>
          <p className="mt-3 font-display text-3xl font-bold text-slate-950">{lot.is24Hours ? '24/7' : `${lot.openTime} – ${lot.closeTime}`}</p>
        </Kpi>
        <Kpi label={tr('Starting price (4-seat cars)')} icon={<Hourglass />}>
          <p className="mt-3 font-display text-3xl font-bold text-slate-950">
            {carRule ? vnd(startingPrice(carRule)) : '—'} <span className="text-sm font-medium text-slate-700">{tr('on entry')}</span>
          </p>
        </Kpi>
        <Kpi label={tr('Day / night pricing')} icon={<Sun />}>
          <p className="mt-3 font-display text-3xl font-bold text-amber-500">
            {list.filter((r) => r.chargeModel === 'DayNight').length} <span className="text-sm font-medium text-slate-700">{tr('rules by the hour')}</span>
          </p>
        </Kpi>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <div role="tablist" aria-label={tr('Vehicle type')} className="flex flex-wrap gap-1 rounded-xl bg-white p-1.5 ring-1 ring-slate-200">
            {[{ id: 'ALL' as const, name: `All (${list.length})` }, ...types].map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={typeFilter === t.id}
                onClick={() => setTypeFilter(t.id)}
                className={cn('rounded-lg px-3.5 py-2 text-sm font-medium transition-colors', typeFilter === t.id ? 'bg-selected text-indigo-800' : 'text-slate-700 hover:bg-slate-100')}
              >
                {tMaybe(t.name)}
              </button>
            ))}
          </div>

          {rules.isPending && Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
          {rules.isError && (
            <Card>
              <ErrorState message={tMaybe(getErrorMessage(rules.error))} onRetry={() => rules.refetch()} />
            </Card>
          )}
          {shown.map((r) => (
            <RuleCard key={r.id} lotId={lot.id} rule={r} drafts={(drafts.data ?? []).filter((d) => d.pricingRuleId === r.id)} />
          ))}

          {!rules.isPending && missing.length > 0 && (
            <Card className="space-y-3 p-5">
              <p className="text-sm text-slate-700">
                {tr('No rule yet for')}{' '}<strong className="text-slate-950">{missing.map((t) => t.name).join(', ')}</strong>{tr(': the gates use the system default price until you add and activate one.')}
              </p>
              <div className="flex flex-wrap gap-2">
                {missing.map((t) => (
                  <Button key={t.id} variant="outline" size="sm" disabled={create.isPending} onClick={() => create.mutate(starterRule(t))}>
                    <Plus />{' '}{tr('Add {name} rule', { name: t.name })}
                  </Button>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6 xl:sticky xl:top-24">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-slate-950">
              <ShieldCheck className="size-5 text-indigo-700" aria-hidden />{' '}{tr('How the gates charge')}
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li>{tr('✓ The first block (the first hour by default) is charged as soon as the vehicle enters: a stay is never free.')}</li>
              <li>{tr('✓ Each started block is charged in full; with day and night prices a block costs the price of the hour it starts in.')}</li>
              <li>{tr('✓ The daily cap applies per calendar day (midnight, Vietnam time); fees are rounded up to 1,000 VND.')}</li>
              <li>{tr('✓ A booking deposit is deducted from the fee at checkout; a lost ticket adds the lost ticket fee to the stay.')}</li>
              <li>
                {tr('✓ After paying at the counter or in the app the driver has {EXIT_WINDOW_MINUTES} minutes to leave; later, the stay is priced again and a late-exit fee is added.', { EXIT_WINDOW_MINUTES })}
              </li>
              <li>{tr('✓ Only Active rules are used; without one the system default price applies.')}</li>
              <li>{tr('✓ While the Admin\'s parking simulation is on, every block lasts a few seconds and the daily cap is off.')}</li>
            </ul>
          </Card>
        </div>
      </div>

      <PricingHistoryPanel lotId={lot.id} rules={list.map((r) => ({ id: r.id, label: `${r.vehicleTypeName} • ${r.name}` }))} />
    </div>
  )
}

/** /management/pricing: the lot's pricing rules (ManagerPricingController) and how the gates apply them. */
export default function ManagerPricingPage() {
  return <WithManagerLot>{(lot) => <Pricing lot={lot} />}</WithManagerLot>
}
