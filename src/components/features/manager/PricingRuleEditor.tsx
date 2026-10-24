import { useState, type FormEvent, type ReactNode } from 'react'
import { Clock, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox, FieldError, Input, Label } from '@/components/ui/form-controls'
import { cn } from '@/lib/utils'
import type { PricingChargeModel, PricingRuleDTO, PricingRuleInput } from '@/types/pricing.dto'

/** Form values as typed text, so empty fields can be told apart from zeros. */
interface Draft {
  name: string
  chargeModel: PricingChargeModel
  graceMinutes: string
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
}

/** "07:00:00" -> "07:00" for <input type="time">. */
const hhmm = (value: string | null, fallback: string) => (value ? value.slice(0, 5) : fallback)

function toDraft(rule: PricingRuleDTO): Draft {
  return {
    name: rule.name,
    // "Hourly" is the same as one-hour blocks; "PerEntry" is not offered by this form
    chargeModel: rule.chargeModel === 'DayNight' ? 'DayNight' : 'Block',
    graceMinutes: String(rule.graceMinutes),
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
  const graceMinutes = whole('graceMinutes', 0, 'Grace period')
  const blockMinutes = whole('blockMinutes', 1, 'Block length')
  const blockPrice = d.chargeModel === 'Block' ? whole('blockPrice', 0, 'Block price') : 0
  const firstBlockMinutes = d.hasFirstBlock ? whole('firstBlockMinutes', 1, 'First block length') : null
  const firstBlockPrice = d.hasFirstBlock ? whole('firstBlockPrice', 0, 'First block price') : null
  const dayPrice = d.chargeModel === 'DayNight' ? whole('dayPrice', 0, 'Day price') : null
  const nightPrice = d.chargeModel === 'DayNight' ? whole('nightPrice', 0, 'Night price') : null
  if (d.chargeModel === 'DayNight' && d.dayStartTime === d.nightStartTime)
    errors.nightStartTime = 'Night must start at a different time than the day.'
  const maxDailyFee = d.maxDailyFee.trim() === '' ? null : whole('maxDailyFee', 0, 'Daily cap')
  const lostTicketFee = whole('lostTicketFee', 0, 'Lost ticket fee')
  if (Object.keys(errors).length) return { errors }

  return {
    errors,
    input: {
      name: d.name.trim(),
      chargeModel: d.chargeModel,
      graceMinutes,
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
 * Edits the prices of one rule: grace period, optional first block, then either one price per block all
 * day or different block prices by the hour (day / night). Only fields the gate's fee calculator uses.
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
            Saved prices apply from the next checkout at every gate of this lot. Each save keeps the previous version in the pricing history.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5" noValidate>
          <Field id="rule-name" label="Rule name" error={errors.name}>
            <Input id="rule-name" value={draft.name} onChange={(e) => set('name', e.target.value)} />
          </Field>

          <div role="radiogroup" aria-label="Pricing by time" className="flex flex-col gap-2 sm:flex-row">
            {modelButton('Block', Clock, 'Same price all day', 'Every block costs the same, whatever the hour.')}
            {modelButton('DayNight', Sun, 'Day and night prices', 'Blocks starting in the day and at night cost differently.')}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="rule-grace" label="Grace period (min)" hint="Free if the vehicle leaves within this time." error={errors.graceMinutes}>
              <Input id="rule-grace" inputMode="numeric" value={draft.graceMinutes} onChange={(e) => set('graceMinutes', e.target.value)} />
            </Field>
            <Field id="rule-block-min" label="Block length (min)" hint="Each started block is charged in full." error={errors.blockMinutes}>
              <Input id="rule-block-min" inputMode="numeric" value={draft.blockMinutes} onChange={(e) => set('blockMinutes', e.target.value)} />
            </Field>
          </div>

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
                <Field id="rule-first-price" label="First block price (VND)" hint="Charged once, on the first day." error={errors.firstBlockPrice}>
                  <Input id="rule-first-price" inputMode="numeric" value={draft.firstBlockPrice} onChange={(e) => set('firstBlockPrice', e.target.value)} />
                </Field>
              </div>
            )}
          </div>

          {draft.chargeModel === 'Block' ? (
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
            <Field id="rule-cap" label="Daily cap (VND)" hint="Most charged per calendar day. Leave empty for no cap." error={errors.maxDailyFee}>
              <Input id="rule-cap" inputMode="numeric" value={draft.maxDailyFee} onChange={(e) => set('maxDailyFee', e.target.value)} />
            </Field>
            <Field id="rule-lost" label="Lost ticket fee (VND)" hint="Added to the parking fee." error={errors.lostTicketFee}>
              <Input id="rule-lost" inputMode="numeric" value={draft.lostTicketFee} onChange={(e) => set('lostTicketFee', e.target.value)} />
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
