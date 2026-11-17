import { useState } from 'react'
import { History } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { formatMinutes, vnd } from '@/components/features/manager/managerFormat'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/form-controls'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { usePricingHistory } from '@/hooks/usePricing'
import { formatDate, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PricingFieldChangeDTO, PricingHistoryEntryDTO } from '@/types/pricing.dto'

const PAGE = 20

/** Title and badge colour of each kind of history entry. */
const KIND: Record<string, { label: string; style: string }> = {
  Create: { label: 'Rule created', style: 'bg-indigo-100 text-indigo-700' },
  Update: { label: 'Prices changed', style: 'bg-emerald-100 text-emerald-700' },
  StatusChange: { label: 'Status changed', style: 'bg-slate-100 text-slate-700' },
  Delete: { label: 'Rule archived', style: 'bg-slate-100 text-slate-700' },
  DraftSaved: { label: 'Draft saved', style: 'bg-amber-100 text-amber-700' },
  DraftUpdated: { label: 'Draft edited', style: 'bg-amber-100 text-amber-700' },
  DraftDiscarded: { label: 'Draft discarded', style: 'bg-rose-100 text-rose-700' },
}

const MODEL_LABEL: Record<string, string> = {
  Block: 'Same price all day',
  Hourly: 'Same price all day',
  DayNight: 'Day and night prices',
  PerEntry: 'One fee per day',
}

type Format = (value: string | number | null) => string
const moneyOr = (empty: string): Format => (v) => (v == null || v === '' ? empty : vnd(Number(v)))
const minutesOr = (empty: string): Format => (v) => (v == null || v === '' ? empty : formatMinutes(Number(v)))
const clock: Format = (v) => (v == null || v === '' ? '—' : String(v).slice(0, 5))
const text: Format = (v) => (v == null || v === '' ? '—' : String(v))

/** Label and formatting of each rule field the history compares. */
const FIELDS: Record<string, { label: string; format: Format }> = {
  name: { label: 'Rule name', format: text },
  chargeModel: { label: 'Pricing model', format: (v) => MODEL_LABEL[String(v)] ?? text(v) },
  entryFee: { label: 'Fee per day / entry fee', format: moneyOr('—') },
  firstBlockMinutes: { label: 'First block length', format: minutesOr('None') },
  firstBlockPrice: { label: 'First block price', format: moneyOr('None') },
  blockMinutes: { label: 'Block length', format: minutesOr('—') },
  blockPrice: { label: 'Price per block', format: moneyOr('—') },
  dayStartTime: { label: 'Day starts', format: clock },
  nightStartTime: { label: 'Night starts', format: clock },
  dayPrice: { label: 'Day price', format: moneyOr('—') },
  nightPrice: { label: 'Night price', format: moneyOr('—') },
  maxDailyFee: { label: 'Daily cap', format: moneyOr('No cap') },
  lostTicketFee: { label: 'Lost ticket fee', format: moneyOr('—') },
  bookedBayCompensation: { label: 'Booked bay compensation', format: moneyOr('—') },
  penaltyFee: { label: 'Towing penalty', format: moneyOr('—') },
  status: { label: 'Status', format: text },
}

function changeLine(entry: PricingHistoryEntryDTO, change: PricingFieldChangeDTO) {
  const field = FIELDS[change.field] ?? { label: change.field, format: text }
  // A created rule lists its starting values
  if (entry.changeType === 'Create') return `${field.label}: ${field.format(change.newValue)}`
  return `${field.label}: ${field.format(change.oldValue)} → ${field.format(change.newValue)}`
}

function Entry({ entry, showRule }: { entry: PricingHistoryEntryDTO; showRule: boolean }) {
  const kind = KIND[entry.changeType] ?? { label: entry.changeType, style: 'bg-slate-100 text-slate-700' }
  const fromDraft = entry.changeType === 'Update' && entry.draftId != null
  const who = entry.changedByName ?? 'Unknown user'
  return (
    <li className="relative border-l-2 border-slate-200 pb-4 pl-4 last:pb-0">
      <span className="absolute top-1.5 -left-[5px] size-2 rounded-full bg-slate-400" aria-hidden />
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase', kind.style)}>{kind.label}</span>
        {fromDraft && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-700 uppercase">From a draft</span>}
        {showRule && (
          <span className="text-sm font-semibold text-slate-950">
            {entry.vehicleTypeName ?? 'Rule'} • {entry.ruleName}
          </span>
        )}
        {entry.versionNo != null && <span className="text-xs text-slate-600">version {entry.versionNo}</span>}
      </div>
      <p className="mt-1 text-xs text-slate-600">
        {formatDate(entry.changedAt)} {formatTime(entry.changedAt)} • {who}
        {entry.changedByRole && entry.changedByRole !== 'User' ? ` (${entry.changedByRole})` : ''}
      </p>
      {entry.reason && <p className="mt-1 text-sm break-words text-slate-700">{entry.reason}</p>}
      {entry.changes.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {entry.changes.map((change) => (
            <li key={change.field} className="font-mono text-xs text-slate-800">
              {changeLine(entry, change)}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * The pricing history of one lot: every price change, status change and price draft, newest first, with who made
 * it and what changed. Used by the Manager pricing page and the Admin pricing history page.
 */
export function PricingHistoryPanel({
  lotId,
  rules = [],
  title = 'Price history',
}: {
  lotId: string | undefined
  /** The rules to filter by; without them the filter is hidden. */
  rules?: { id: number; label: string }[]
  title?: string
}) {
  const [ruleId, setRuleId] = useState<number | null>(null)
  const [take, setTake] = useState(PAGE)
  const history = usePricingHistory(lotId, ruleId, take)
  const entries = history.data ?? []

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-slate-950">
          <History className="size-5 text-indigo-700" aria-hidden /> {title}
        </h2>
        {rules.length > 0 && (
          <NativeSelect
            aria-label="Filter the history by rule"
            className="w-auto"
            value={ruleId ?? ''}
            onChange={(e) => {
              setRuleId(e.target.value ? Number(e.target.value) : null)
              setTake(PAGE)
            }}
          >
            <option value="">All rules</option>
            {rules.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </NativeSelect>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-700">Every saved price, status change and draft is kept here; nothing is ever removed.</p>

      <div className="mt-4">
        {history.isPending && <Skeleton className="h-40 rounded-xl" />}
        {history.isError && <ErrorState message={getErrorMessage(history.error)} onRetry={() => history.refetch()} />}
        {history.isSuccess && entries.length === 0 && <EmptyState icon={History} title="No price changes yet" description="Changes appear here as soon as they are saved." />}
        {entries.length > 0 && (
          <ul className="ml-1">
            {entries.map((entry) => (
              <Entry key={entry.id} entry={entry} showRule={ruleId == null} />
            ))}
          </ul>
        )}
        {entries.length >= take && (
          <Button variant="outline" size="sm" className="mt-4" disabled={history.isFetching} onClick={() => setTake((t) => t + PAGE)}>
            {history.isFetching ? 'Loading…' : 'Show older changes'}
          </Button>
        )}
      </div>
    </Card>
  )
}
