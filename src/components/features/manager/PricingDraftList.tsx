import { useState } from 'react'
import { AlertTriangle, FileClock, Pencil, Rocket, Trash2 } from 'lucide-react'
import { formatMinutes, vnd } from '@/components/features/manager/managerFormat'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { formatDate, formatRelativeTime, formatTime } from '@/lib/format'
import type { PricingChargeModel, PricingRuleDraftDTO, PricingRuleDTO, PricingRuleInput } from '@/types/pricing.dto'

const MODEL_LABEL: Record<PricingChargeModel, string> = {
  Block: 'Same price all day',
  Hourly: 'Same price all day',
  DayNight: 'Day and night prices',
  PerEntry: 'One fee per day',
}

const money = (value: number | null | undefined) => (value == null ? 'No cap' : vnd(value))
const time = (value: string | null | undefined) => (value ? value.slice(0, 5) : '—')

/**
 * What a draft changes compared with the live rule, as "Label: old → new" lines. Only fields the pricing
 * page edits, and only those the draft's charge model uses.
 */
function draftChanges(rule: PricingRuleDTO, values: PricingRuleInput): string[] {
  const lines: string[] = []
  const diff = (label: string, before: string, after: string) => {
    if (before !== after) lines.push(`${label}: ${before} → ${after}`)
  }
  const model = values.chargeModel === 'Hourly' ? 'Block' : values.chargeModel
  const liveModel = rule.chargeModel === 'Hourly' ? 'Block' : rule.chargeModel

  diff('Rule name', rule.name, values.name)
  diff('Pricing model', MODEL_LABEL[liveModel], MODEL_LABEL[model])
  if (model === 'PerEntry') {
    diff('Fee per day', vnd(rule.entryFee), vnd(values.entryFee))
  } else {
    diff('Block length', formatMinutes(rule.blockMinutes ?? 60), formatMinutes(values.blockMinutes))
    const firstBlock = (minutes: number | null, price: number | null) =>
      minutes == null || price == null ? 'None' : `${formatMinutes(minutes)} for ${vnd(price)}`
    diff('First block', firstBlock(rule.firstBlockMinutes, rule.firstBlockPrice), firstBlock(values.firstBlockMinutes, values.firstBlockPrice))
    if (model === 'Block') diff('Price per block', money(rule.blockPrice), money(values.blockPrice))
    if (model === 'DayNight') {
      diff('Day price', money(rule.dayPrice), money(values.dayPrice))
      diff('Night price', money(rule.nightPrice), money(values.nightPrice))
      diff('Day starts', time(rule.dayStartTime), time(values.dayStartTime))
      diff('Night starts', time(rule.nightStartTime), time(values.nightStartTime))
    }
    diff('Daily cap', money(rule.maxDailyFee), money(values.maxDailyFee))
  }
  diff('Lost ticket fee', vnd(rule.lostTicketFee), vnd(values.lostTicketFee))
  diff('Booked bay compensation', vnd(rule.bookedBayCompensation ?? 0), vnd(values.bookedBayCompensation))
  diff('Towing penalty', vnd(rule.penaltyFee ?? 0), vnd(values.penaltyFee ?? rule.penaltyFee ?? 0))
  return lines
}

function savedText(draft: PricingRuleDraftDTO) {
  const at = draft.updatedAt ?? draft.createdAt
  const when = Date.now() - new Date(at).getTime() < 86_400_000 ? formatRelativeTime(new Date(at).getTime()) : `${formatDate(at)} ${formatTime(at)}`
  return `${draft.updatedAt ? 'Updated' : 'Saved'} ${when}${draft.createdByName ? ` by ${draft.createdByName}` : ''}`
}

/** The open drafts of one rule, each with what it changes and its edit / apply / discard actions. */
export function PricingDraftList({
  rule,
  drafts,
  applying,
  discarding,
  onEdit,
  onApply,
  onDiscard,
}: {
  rule: PricingRuleDTO
  drafts: PricingRuleDraftDTO[]
  applying: boolean
  discarding: boolean
  onEdit: (draft: PricingRuleDraftDTO) => void
  onApply: (draft: PricingRuleDraftDTO, done: () => void) => void
  onDiscard: (draft: PricingRuleDraftDTO, done: () => void) => void
}) {
  const [confirm, setConfirm] = useState<{ kind: 'apply' | 'discard'; draft: PricingRuleDraftDTO } | null>(null)
  if (drafts.length === 0) return null

  const close = () => setConfirm(null)
  const confirmChanges = confirm ? draftChanges(rule, confirm.draft.values) : []

  return (
    <div className="mt-4 space-y-2 rounded-xl bg-amber-50/60 p-4 ring-1 ring-amber-200">
      <p className="flex items-center gap-2 text-xs font-bold tracking-wider text-amber-800 uppercase">
        <FileClock className="size-4" aria-hidden /> Saved drafts ({drafts.length}) • not applied
      </p>
      <ul className="space-y-2">
        {drafts.map((draft) => {
          const changes = draftChanges(rule, draft.values)
          const outdated = draft.currentVersionNo > draft.baseVersionNo
          return (
            <li key={draft.id} className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold break-words text-slate-950">{draft.note || 'Price draft'}</p>
                  <p className="text-xs text-slate-600">{savedText(draft)}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => onEdit(draft)}>
                    <Pencil /> Edit
                  </Button>
                  <Button variant="gold" size="sm" disabled={applying} onClick={() => setConfirm({ kind: 'apply', draft })}>
                    <Rocket /> Apply
                  </Button>
                  <Button variant="outline" size="sm" disabled={discarding} aria-label="Discard draft" onClick={() => setConfirm({ kind: 'discard', draft })}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
              {outdated && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  The live prices changed after this draft was saved. Check the changes below before applying it.
                </p>
              )}
              {changes.length ? (
                <ul className="mt-2 space-y-0.5 text-sm text-slate-700">
                  {changes.map((line) => (
                    <li key={line} className="font-mono text-xs">
                      {line}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-slate-600">Same as the live prices.</p>
              )}
            </li>
          )
        })}
      </ul>

      <ConfirmDialog
        open={confirm?.kind === 'apply'}
        onOpenChange={(open) => !open && close()}
        title="Apply this draft now?"
        description={
          <div className="space-y-2">
            <p>
              The new prices go live at once for every vehicle entering from now on, and customers are told. Vehicles already inside keep their
              price.
            </p>
            {confirmChanges.length > 0 && (
              <ul className="space-y-0.5 font-mono text-xs">
                {confirmChanges.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        }
        confirmLabel="Apply prices"
        pending={applying}
        onConfirm={() => confirm && onApply(confirm.draft, close)}
      />
      <ConfirmDialog
        open={confirm?.kind === 'discard'}
        onOpenChange={(open) => !open && close()}
        title="Discard this draft?"
        description="The draft disappears from this page. The live prices do not change."
        confirmLabel="Discard"
        tone="destructive"
        pending={discarding}
        onConfirm={() => confirm && onDiscard(confirm.draft, close)}
      />
    </div>
  )
}
