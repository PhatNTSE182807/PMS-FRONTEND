import { useState } from 'react'
import { CircleCheck, CircleX, HandCoins, Hourglass, Undo2 } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/form-controls'
import { useCancelCashTopUp, useRequestCashTopUp } from '@/hooks/useCashDrawer'
import { formatNumber } from '@/lib/format'
import type { CashDrawerDTO, CashTopUpDTO } from '@/types/cashDrawer.dto'
import { t, currentLocale, tMaybe } from '@/i18n'

const vnd = (amount: number) => `${formatNumber(amount)} VND`
const clock = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString(currentLocale(), { hour: '2-digit', minute: '2-digit' }) : '')

/** Quick amounts for a cash request (VND). */
const QUICK_AMOUNTS = [200_000, 500_000, 1_000_000, 2_000_000] as const

/** The Staff asks for an amount of cash; the lot's Manager approves it into the drawer. */
export function CashTopUpDialog({
  lotId,
  open,
  onOpenChange,
  initialAmount,
  initialReason,
}: {
  lotId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  initialAmount?: number
  initialReason?: string
}) {
  const request = useRequestCashTopUp()
  const [amount, setAmount] = useState(initialAmount ?? 0)
  const [reason, setReason] = useState(initialReason ?? '')
  const [error, setError] = useState<string | null>(null)

  const send = () => {
    setError(null)
    request.mutate(
      { lotId, amount, reason: reason.trim() || undefined },
      {
        onSuccess: () => onOpenChange(false),
        onError: (e) => setError(getErrorMessage(e, 'Could not send the cash request.')),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('Ask your Manager for cash')}</DialogTitle>
          <DialogDescription>{t('Enter how much cash you need. Once your Manager approves, it is added to your drawer total.')}</DialogDescription>
        </DialogHeader>

        <label htmlFor="top-up-amount" className="text-xs font-bold tracking-wider text-slate-700 uppercase">{t('Amount (VND)')}</label>
        <input
          id="top-up-amount"
          inputMode="numeric"
          value={amount ? formatNumber(amount) : ''}
          placeholder="0"
          onChange={(e) => setAmount(Math.min(100_000_000, Number(e.target.value.replace(/\D/g, '')) || 0))}
          className="w-full rounded-lg bg-well px-3 py-2 font-mono text-xl font-bold text-slate-950 ring-1 ring-slate-200 focus-visible:outline-none"
        />
        <div className="flex flex-wrap gap-2">
          {QUICK_AMOUNTS.map((value) => (
            <Button key={value} size="sm" variant="secondary" onClick={() => setAmount(value)}>
              {vnd(value)}
            </Button>
          ))}
        </div>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder={t('What you need (optional), e.g. small notes for change')} />
        {error && <p className="text-sm text-rose-700" role="alert">{tMaybe(error)}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('Cancel')}</Button>
          <Button disabled={amount === 0 || request.isPending} onClick={send}>
            <HandCoins />{' '}{t('Send to Manager')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Where the drawer's latest cash request stands: waiting (with Cancel), approved or rejected. */
export function CashTopUpStatusLine({ lotId, request }: { lotId: string; request: CashTopUpDTO }) {
  const cancel = useCancelCashTopUp()
  if (request.status === 'Pending') {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200" role="status">
        <Hourglass className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          {t('Waiting for your Manager since')}{' '}{clock(request.createdAt)}: {vnd(request.total)}
        </span>
        <Button size="sm" variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate({ lotId, id: request.id })}>
          <Undo2 />{' '}{t('Cancel')}
        </Button>
      </div>
    )
  }
  if (request.status === 'Approved') {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {t('{v} approved', { v: request.decidedByName ?? 'Your Manager' })}{' '}{vnd(request.total)}{' '}{t('at')}{' '}{clock(request.decidedAt)}{t(': it is added to your drawer.')}
        </span>
      </p>
    )
  }
  if (request.status === 'Rejected') {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">
        <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {t('{v} rejected your cash request', { v: request.decidedByName ?? 'Your Manager' })}{request.decisionNote ? `: ${request.decisionNote}` : '.'}
        </span>
      </p>
    )
  }
  return null
}

/** Cash tally panel: the drawer's cash requests and the button to ask for more cash. */
export function CashTopUpPanel({ lotId, drawer }: { lotId: string; drawer: CashDrawerDTO }) {
  const [asking, setAsking] = useState(false)
  const latest = drawer.topUps[0]
  const pending = latest?.status === 'Pending'

  return (
    <div className="space-y-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold tracking-wider text-slate-700 uppercase">{t('Running out of cash?')}</p>
          <p className="text-sm text-slate-700">
            {t('Ask your Manager for cash; an approved amount is added to this drawer.')}
            {drawer.topUpTotal > 0 && t(' {v} added so far.', { v: vnd(drawer.topUpTotal) })}
          </p>
        </div>
        <Button variant="secondary" disabled={pending} onClick={() => setAsking(true)}>
          <HandCoins />{' '}{t('Request cash')}
        </Button>
      </div>
      {latest && latest.status !== 'Cancelled' && <CashTopUpStatusLine lotId={lotId} request={latest} />}
      {asking && <CashTopUpDialog lotId={lotId} open={asking} onOpenChange={setAsking} />}
    </div>
  )
}
