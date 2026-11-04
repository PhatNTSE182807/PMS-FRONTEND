import { useState } from 'react'
import { CircleCheck, CircleX, HandCoins, Hourglass, Minus, Plus, Undo2 } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/form-controls'
import { useCancelCashTopUp, useRequestCashTopUp } from '@/hooks/useCashDrawer'
import { BANKNOTES, cleanNotes, describeNotes, notesTotal } from '@/lib/cashNotes'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { BanknoteCounts, CashDrawerDTO, CashTopUpDTO } from '@/types/cashDrawer.dto'

const vnd = (amount: number) => `${formatNumber(amount)} VND`
const clock = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '')

/** The Staff lists the banknotes they need; the lot's Manager approves them into the drawer. */
export function CashTopUpDialog({
  lotId,
  open,
  onOpenChange,
  initialNotes,
  initialReason,
}: {
  lotId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  initialNotes?: BanknoteCounts
  initialReason?: string
}) {
  const request = useRequestCashTopUp()
  const [notes, setNotes] = useState<BanknoteCounts>(initialNotes ?? {})
  const [reason, setReason] = useState(initialReason ?? '')
  const [error, setError] = useState<string | null>(null)
  const total = notesTotal(notes)
  const set = (value: number, count: number) => setNotes((n) => ({ ...n, [value]: Math.max(0, Math.min(9_999, count)) }))

  const send = () => {
    setError(null)
    request.mutate(
      { lotId, notes: cleanNotes(notes), reason: reason.trim() || undefined },
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
          <DialogTitle>Ask your Manager for cash</DialogTitle>
          <DialogDescription>List the banknotes you need in your drawer. Once your Manager approves, they count as cash put into the drawer.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {BANKNOTES.map((value) => {
            const count = notes[value] ?? 0
            return (
              <div key={value} className={cn('rounded-lg p-2 ring-1', count > 0 ? 'bg-amber-50 ring-amber-200' : 'bg-slate-50 ring-slate-200')}>
                <p className="text-xs font-bold text-slate-700">{formatNumber(value)}</p>
                <div className="mt-1 flex items-center justify-between">
                  <button type="button" className="rounded p-1 text-slate-700 hover:text-slate-950 disabled:opacity-40" aria-label={`One less ${formatNumber(value)} note`} disabled={count === 0} onClick={() => set(value, count - 1)}>
                    <Minus className="size-3.5" />
                  </button>
                  <input
                    inputMode="numeric"
                    aria-label={`${formatNumber(value)} VND notes`}
                    className="w-12 bg-transparent text-center font-mono font-bold text-slate-950 focus-visible:outline-none"
                    value={count}
                    onChange={(e) => set(value, Number(e.target.value.replace(/\D/g, '')) || 0)}
                  />
                  <button type="button" className="rounded p-1 text-slate-700 hover:text-slate-950" aria-label={`One more ${formatNumber(value)} note`} onClick={() => set(value, count + 1)}>
                    <Plus className="size-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-700">Total</span>
          <span className="font-mono text-lg font-bold text-amber-500">{vnd(total)}</span>
        </div>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Reason (optional), e.g. Out of small notes for change" />
        {error && <p className="text-sm text-rose-700" role="alert">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={total === 0 || request.isPending} onClick={send}>
            <HandCoins /> Send to Manager
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
          Waiting for your Manager since {clock(request.createdAt)}: {describeNotes(request.notes)} ({vnd(request.total)})
        </span>
        <Button size="sm" variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate({ lotId, id: request.id })}>
          <Undo2 /> Cancel
        </Button>
      </div>
    )
  }
  if (request.status === 'Approved') {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {request.decidedByName ?? 'Your Manager'} approved {vnd(request.total)} at {clock(request.decidedAt)}: {describeNotes(request.notes)} added to your drawer.
        </span>
      </p>
    )
  }
  if (request.status === 'Rejected') {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">
        <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {request.decidedByName ?? 'Your Manager'} rejected your cash request{request.decisionNote ? `: ${request.decisionNote}` : '.'}
        </span>
      </p>
    )
  }
  return null
}

/** Cash tally panel: the drawer's cash requests and the button to ask for more banknotes. */
export function CashTopUpPanel({ lotId, drawer }: { lotId: string; drawer: CashDrawerDTO }) {
  const [asking, setAsking] = useState(false)
  const latest = drawer.topUps[0]
  const pending = latest?.status === 'Pending'

  return (
    <div className="space-y-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold tracking-wider text-slate-700 uppercase">Running out of notes?</p>
          <p className="text-sm text-slate-700">
            Ask your Manager for banknotes; approved notes are added to this drawer.
            {drawer.topUpTotal > 0 && ` ${vnd(drawer.topUpTotal)} added so far.`}
          </p>
        </div>
        <Button variant="secondary" disabled={pending} onClick={() => setAsking(true)}>
          <HandCoins /> Request cash
        </Button>
      </div>
      {latest && latest.status !== 'Cancelled' && <CashTopUpStatusLine lotId={lotId} request={latest} />}
      {asking && <CashTopUpDialog lotId={lotId} open={asking} onOpenChange={setAsking} />}
    </div>
  )
}
