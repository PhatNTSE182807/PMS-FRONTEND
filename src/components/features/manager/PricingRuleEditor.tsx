import { useState, type FormEvent, type ReactNode } from 'react'
import { CalendarDays, Clock, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox, FieldError, Input, Label } from '@/components/ui/form-controls'
import { cn } from '@/lib/utils'
import type { PricingChargeModel, PricingRuleDTO, PricingRuleInput } from '@/types/pricing.dto'

/** Form values as typed text, so empty fields can be told apart from zeros. */
interface Draft {
  bookedBayCompensation: string
  name: string
  chargeModel: PricingChargeModel
  hasFirstBlock: boolean
  firstBlockMinutes: string
  firstBlockPrice: string
  blockMinutes: string
  blockPrice: string
  dayStartTime: string
  nightStartTime: string
  dayPrice: string
  nightPrice: string
  maxDailyFee: string
  lostTicketFee: string
  /** The flat fee of a "PerEntry" rule. */
  entryFee: string
  /** The fee a block rule adds on top of its blocks: not edited here, so a save must not lose it. */
  blockRuleEntryFee: number
}

/** "07:00:00" -> "07:00" for <input type="time">. */
const hhmm = (value: string | null, fallback: string) => (value ? value.slice(0, 5) : fallback)

function toDraft(rule: PricingRuleDTO): Draft {
  const perEntry = rule.chargeModel === 'PerEntry'
  return {
    name: rule.name,
    // "Hourly" is the same as one-hour blocks
    chargeModel: rule.chargeModel === 'Hourly' ? 'Block' : rule.chargeModel,
    entryFee: perEntry ? String(rule.entryFee) : '',
    // A flat fee must not turn into a surcharge if the Manager moves this rule to block prices
    blockRuleEntryFee: perEntry ? 0 : rule.entryFee,
    hasFirstBlock: rule.firstBlockMinutes != null && rule.firstBlockPrice != null,
    firstBlockMinutes: String(rule.firstBlockMinutes ?? 120),
    firstBlockPrice: String(rule.firstBlockPrice ?? ''),
    blockMinutes: String(rule.blockMinutes ?? 60),
    blockPrice: String(rule.blockPrice ?? 0),
    dayStartTime: hhmm(rule.dayStartTime, '06:00'),
    nightStartTime: hhmm(rule.nightStartTime, '18:00'),
    dayPrice: String(rule.dayPrice ?? rule.blockPrice ?? ''),
    nightPrice: String(rule.nightPrice ?? rule.blockPrice ?? ''),
    maxDailyFee: rule.maxDailyFee == null ? '' : String(rule.maxDailyFee),
    lostTicketFee: String(rule.lostTicketFee),
    bookedBayCompensation: String(rule.bookedBayCompensation ?? 0),
  }
}

type Errors = Partial<Record<keyof Draft, string>>

/** The same checks the API validators run, answered before saving. */
function validate(d: Draft): { errors: Errors; input?: Omit<PricingRuleInput, 'vehicleTypeId'> } {
  const errors: Errors = {}
  const whole = (key: keyof Draft, min: number, label: string) => {
    const raw = String(d[key]).trim()
    const n = Number(raw)
    if (raw === '' || !Number.isInteger(n) || n < min) errors[key] = `${label} must be a whole number of at least ${min}.`
    return n
  }
  if (!d.name.trim()) errors.name = 'Rule name is required.'
  const perEntry = d.chargeModel === 'PerEntry'
  const entryFee = perEntry ? whole('entryFee', 0, 'Fee per day') : d.blockRuleEntryFee
  // A per-day rule hides the block fields and the gate ignores them: they are kept as they were, unchecked
  const blockMinutes = perEntry ? Number(d.blockMinutes) || 60 : whole('blockMinutes', 1, 'Block length')
  const blockPrice = perEntry ? Number(d.blockPrice) || 0 : d.chargeModel === 'Block' ? whole('blockPrice', 0, 'Block price') : 0
  const firstBlockMinutes = d.hasFirstBlock && !perEntry ? whole('firstBlockMinutes', 1, 'First block length') : null
  const firstBlockPrice = d.hasFirstBlock && !perEntry ? whole('firstBlockPrice', 0, 'First block price') : null
  const dayPrice = d.chargeModel === 'DayNight' ? whole('dayPrice', 0, 'Day price') : null
  const nightPrice = d.chargeModel === 'DayNight' ? whole('nightPrice', 0, 'Night price') : null
  if (d.chargeModel === 'DayNight' && d.dayStartTime === d.nightStartTime)
    errors.nightStartTime = 'Night must start at a different time than the day.'
  const maxDailyFee = perEntry || d.maxDailyFee.trim() === '' ? null : whole('maxDailyFee', 0, 'Daily cap')
  const lostTicketFee = whole('lostTicketFee', 0, 'Lost ticket fee')
  const bookedBayCompensation = whole('bookedBayCompensation', 0, 'Booked bay compensation')
  if (!errors.bookedBayCompensation && bookedBayCompensation > 10_000_000)
    errors.bookedBayCompensation = 'Booked bay compensation can be at most 10,000,000 VND.'
  if (Object.keys(errors).length) return { errors }

  return {
    errors,
    input: {
      name: d.name.trim(),
      chargeModel: d.chargeModel,
      entryFee,
      // No free period: the first block is owed from entry
      graceMinutes: 0,
      firstBlockMinutes,
      firstBlockPrice,
      blockMinutes,
      // Day/night rules still send a block price: the API falls back to it when a time is missing
      blockPrice: d.chargeModel === 'DayNight' ? (dayPrice ?? 0) : blockPrice,
      dayStartTime: d.chargeModel === 'DayNight' ? `${d.dayStartTime}:00` : null,
      nightStartTime: d.chargeModel === 'DayNight' ? `${d.nightStartTime}:00` : null,
      dayPrice,
      nightPrice,
      maxDailyFee,
      lostTicketFee,
      bookedBayCompensation,
    },
  }
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-slate-600">{hint}</p>}
      <FieldError message={error} />
    </div>
  )
}

/**
 * Edits the prices of one rule: an optional first block, then either one price per block all day or
 * different block prices by the hour (day / night); or one flat fee per calendar day. Only fields the
 * gate's fee calculator uses.
 */
export function PricingRuleEditor({
  rule,
  open,
  saving,
  onOpenChange,
  onSave,
}: {
  rule: PricingRuleDTO
  open: boolean
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSave: (input: Omit<PricingRuleInput, 'vehicleTypeId'>) => void
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(rule))
  const [errors, setErrors] = useState<Errors>({})
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const result = validate(draft)
    setErrors(result.errors)
    if (result.input) onSave(result.input)
  }

  const modelButton = (value: PricingChargeModel, icon: typeof Clock, title: string, text: string) => {
    const Icon = icon
    const active = draft.chargeModel === value
    return (
      <button
        type="button"
        role="radio"
        aria-checked={active}
        onClick={() => set('chargeModel', value)}
        className={cn(
          'flex flex-1 items-start gap-2 rounded-xl p-3 text-left ring-1 transition-colors',
          active ? 'bg-amber-50 ring-amber-400' : 'ring-slate-200 hover:bg-slate-50',
        )}
      >
        <Icon className={cn('mt-0.5 size-4 shrink-0', active ? 'text-amber-500' : 'text-slate-600')} aria-hidden />
        <span>
          <strong className="block text-sm text-slate-950">{title}</strong>
          <span className="text-xs text-slate-700">{text}</span>
        </span>
      </button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit prices • {rule.vehicleTypeName}</DialogTitle>
          <DialogDescription>
            A new price applies at once to every vehicle entering from now on, booked or not, and customers are told. Vehicles already inside keep
            the price they entered with. Each save keeps the previous version in the pricing history.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5" noValidate>
          <Field id="rule-name" label="Rule name" error={errors.name}>
            <Input id="rule-name" value={draft.name} onChange={(e) => set('name', e.target.value)} />
          </Field>

          <div role="radiogroup" aria-label="Pricing model" className="flex flex-col gap-2 sm:flex-row">
            {modelButton('Block', Clock, 'Same price all day', 'Every block costs the same, whatever the hour.')}
            {modelButton('DayNight', Sun, 'Day and night prices', 'Blocks starting in the day and at night cost differently.')}
            {modelButton('PerEntry', CalendarDays, 'One fee per day', 'A flat fee for each calendar day, however long the stay.')}
          </div>

          {draft.chargeModel !== 'PerEntry' && (
            <>
              <Field
                id="rule-block-min"
                label="Block length (min)"
                hint="Each started block is charged in full. The first block is charged as soon as the vehicle enters: a stay is never free."
                error={errors.blockMinutes}
              >
                <Input id="rule-block-min" inputMode="numeric" value={draft.blockMinutes} onChange={(e) => set('blockMinutes', e.target.value)} />
              </Field>

              <div className="space-y-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <Checkbox checked={draft.hasFirstBlock} onChange={(e) => set('hasFirstBlock', e.target.checked)} />
                  Different price for the first block
                </label>
                {draft.hasFirstBlock && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="rule-first-min" label="First block length (min)" error={errors.firstBlockMinutes}>
                      <Input id="rule-first-min" inputMode="numeric" value={draft.firstBlockMinutes} onChange={(e) => set('firstBlockMinutes', e.target.value)} />
                    </Field>
                    <Field id="rule-first-price" label="First block price (VND)" hint="Charged as soon as the vehicle enters." error={errors.firstBlockPrice}>
                      <Input id="rule-first-price" inputMode="numeric" value={draft.firstBlockPrice} onChange={(e) => set('firstBlockPrice', e.target.value)} />
                    </Field>
                  </div>
                )}
              </div>
            </>
          )}

          {draft.chargeModel === 'PerEntry' ? (
            <Field id="rule-entry-fee" label="Fee per day (VND)" hint="Charged once for each calendar day of the stay, from entry." error={errors.entryFee}>
              <Input id="rule-entry-fee" inputMode="numeric" value={draft.entryFee} onChange={(e) => set('entryFee', e.target.value)} />
            </Field>
          ) : draft.chargeModel === 'Block' ? (
            <Field id="rule-block-price" label="Price per block (VND)" error={errors.blockPrice}>
              <Input id="rule-block-price" inputMode="numeric" value={draft.blockPrice} onChange={(e) => set('blockPrice', e.target.value)} />
            </Field>
          ) : (
            <div className="grid gap-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200 sm:grid-cols-2">
              <Field id="rule-day-start" label="Day starts at" error={errors.dayStartTime}>
                <Input id="rule-day-start" type="time" value={draft.dayStartTime} onChange={(e) => set('dayStartTime', e.target.value)} />
              </Field>
              <Field id="rule-night-start" label="Night starts at" error={errors.nightStartTime}>
                <Input id="rule-night-start" type="time" value={draft.nightStartTime} onChange={(e) => set('nightStartTime', e.target.value)} />
              </Field>
              <Field id="rule-day-price" label="Day price per block (VND)" error={errors.dayPrice}>
                <div className="relative">
                  <Sun className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-amber-500" aria-hidden />
                  <Input id="rule-day-price" className="pl-9" inputMode="numeric" value={draft.dayPrice} onChange={(e) => set('dayPrice', e.target.value)} />
                </div>
              </Field>
              <Field id="rule-night-price" label="Night price per block (VND)" error={errors.nightPrice}>
                <div className="relative">
                  <Moon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-indigo-700" aria-hidden />
                  <Input id="rule-night-price" className="pl-9" inputMode="numeric" value={draft.nightPrice} onChange={(e) => set('nightPrice', e.target.value)} />
                </div>
              </Field>
              <p className="text-xs text-slate-600 sm:col-span-2">A block is priced by the hour it starts: from {draft.dayStartTime} it is a day block, from {draft.nightStartTime} a night block.</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {draft.chargeModel !== 'PerEntry' && (
              <Field id="rule-cap" label="Daily cap (VND)" hint="Most charged per calendar day. Leave empty for no cap." error={errors.maxDailyFee}>
                <Input id="rule-cap" inputMode="numeric" value={draft.maxDailyFee} onChange={(e) => set('maxDailyFee', e.target.value)} />
              </Field>
            )}
            <Field id="rule-lost" label="Lost ticket fee (VND)" hint="Added to the parking fee." error={errors.lostTicketFee}>
              <Input id="rule-lost" inputMode="numeric" value={draft.lostTicketFee} onChange={(e) => set('lostTicketFee', e.target.value)} />
            </Field>
            <Field
              id="rule-compensation"
              label="Booked bay compensation (VND)"
              hint="Paid into the customer's XXIV wallet, and taken off this lot's revenue, when a walk-in took their booked bay and no other bay was free. Customers are not told when it changes."
              error={errors.bookedBayCompensation}
            >
              <Input
                id="rule-compensation"
                inputMode="numeric"
                value={draft.bookedBayCompensation}
                onChange={(e) => set('bookedBayCompensation', e.target.value)}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gold" disabled={saving}>
              {saving ? 'Saving…' : 'Save prices'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
