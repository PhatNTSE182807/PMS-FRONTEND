import { useState } from 'react'
import { Ban, Banknote, CircleCheck, HandCoins } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { WithManagerLot } from '@/components/features/manager/ManagerBits'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/form-controls'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { useAuth } from '@/hooks/useAuth'
import { useCashCloses, useCashTopUps, useConfirmCashClose, useDecideCashTopUp } from '@/hooks/useCashDrawer'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CashDrawerDTO, CashTopUpDTO } from '@/types/cashDrawer.dto'
import type { ManagedLot } from '@/types/lot-management.dto'

const dayClock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })

/** One Staff drawer handed in, waiting for the Manager: the cash total and the confirmation. */
function CashCloseCard({ close }: { close: CashDrawerDTO }) {
  const { user } = useAuth()
  const confirm = useConfirmCashClose()
  const [note, setNote] = useState('')
  // Drawers handed in before counting was dropped still carry their count and difference
  const counted = close.countedTotal != null
  const difference = close.difference ?? 0
  const off = close.status === 'HasDifference'
  const own = close.staffUserId === user?.userId
  return (
    <Card className={cn('p-4', off && 'ring-amber-300')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-950">{close.staffName ?? 'Staff'} • drawer {close.closeNo}</p>
          <p className="text-xs text-slate-600">
            {close.businessDate}
            {close.closedAt ? ` • closed at ${dayClock.format(Date.parse(close.closedAt))}` : ''}
          </p>
        </div>
        <span className="font-mono text-lg font-bold text-amber-500">{formatNumber(close.cashTotal)} VND</span>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div><dt className="text-xs text-slate-600">Float</dt><dd className="font-mono font-bold text-slate-950">{formatNumber(close.floatTotal)}</dd></div>
        <div><dt className="text-xs text-slate-600">Cash taken ({close.cashPayments})</dt><dd className="font-mono font-bold text-slate-950">{formatNumber(close.cashCollected)}</dd></div>
        <div><dt className="text-xs text-slate-600">Added by you</dt><dd className="font-mono font-bold text-slate-950">{formatNumber(close.topUpTotal)}</dd></div>
      </dl>
      {counted && (
        <p className={cn('mt-2 text-sm', off ? 'text-rose-700' : 'text-slate-700')}>
          Counted {formatNumber(close.countedTotal ?? 0)} VND: {difference > 0 ? '+' : ''}
          {formatNumber(difference)} VND off.
        </p>
      )}
      {close.differenceReason && <p className="mt-2 text-sm text-slate-700"><strong className="text-slate-950">Staff reason:</strong> {close.differenceReason}</p>}
      {off && (
        <Input className="mt-3" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="What you checked (required for a difference)" aria-label="Confirmation note" />
      )}
      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          disabled={own || confirm.isPending || (off && !note.trim())}
          title={own ? 'You closed this drawer: another Manager confirms it' : undefined}
          onClick={() => confirm.mutate({ id: close.id!, note: note.trim() || undefined })}
        >
          <CircleCheck /> Confirm handover
        </Button>
      </div>
    </Card>
  )
}

/** Staff drawers of the lot handed in and waiting for the Manager. */
function CashCloses({ lot }: { lot: ManagedLot }) {
  const closes = useCashCloses(lot.id)
  return (
    <section className="space-y-3" aria-labelledby="cash-closes-title">
      <h2 id="cash-closes-title" className="flex items-center gap-2 font-display text-xl font-semibold text-slate-950">
        <Banknote className="size-5 text-amber-500" aria-hidden /> Cash drawers to confirm
      </h2>
      {closes.isPending && <Skeleton className="h-28 rounded-xl" />}
      {closes.isError && (
        <Card>
          <ErrorState message={getErrorMessage(closes.error)} onRetry={() => closes.refetch()} />
        </Card>
      )}
      {closes.isSuccess && closes.data.length === 0 && (
        <Card className="p-6 text-center text-sm text-slate-600">No Staff cash drawer is waiting for you.</Card>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {(closes.data ?? []).map((close) => (
          <CashCloseCard key={close.id} close={close} />
        ))}
      </div>
    </section>
  )
}

/** One Staff request for more cash: the amount, then Approve (it joins the drawer) or Reject with a reason. */
function CashTopUpCard({ request }: { request: CashTopUpDTO }) {
  const { user } = useAuth()
  const decide = useDecideCashTopUp()
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const own = request.staffUserId === user?.userId
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-950">{request.staffName ?? 'Staff'} • drawer {request.closeNo}</p>
          <p className="text-xs text-slate-600">Asked at {dayClock.format(Date.parse(request.createdAt))}</p>
        </div>
        <span className="font-mono text-lg font-bold text-amber-500">{formatNumber(request.total)} VND</span>
      </div>
      {request.reason && <p className="mt-2 text-sm text-slate-700"><strong className="text-slate-950">Staff reason:</strong> {request.reason}</p>}
      {!request.drawerOpen && <p className="mt-2 text-sm text-rose-700">The Staff already closed this drawer: reject it and let them ask again.</p>}
      {rejecting ? (
        <div className="mt-3 space-y-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Reason for the Staff (required)" aria-label="Rejection reason" />
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setRejecting(false)}>Back</Button>
            <Button size="sm" variant="destructive" disabled={!note.trim() || decide.isPending} onClick={() => decide.mutate({ id: request.id, approve: false, note: note.trim() })}>
              <Ban /> Reject request
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="outline" disabled={own || decide.isPending} onClick={() => setRejecting(true)}>
            <Ban /> Reject
          </Button>
          <Button
            size="sm"
            disabled={own || !request.drawerOpen || decide.isPending}
            title={own ? 'You made this request: another Manager decides on it' : undefined}
            onClick={() => decide.mutate({ id: request.id, approve: true })}
          >
            <CircleCheck /> Approve & hand over
          </Button>
        </div>
      )}
    </Card>
  )
}

/** Staff asking for more cash in their drawer (an approved amount counts as cash put into it). */
function CashTopUps({ lot }: { lot: ManagedLot }) {
  const requests = useCashTopUps(lot.id)
  if (requests.isSuccess && requests.data.length === 0) return null
  return (
    <section className="space-y-3" aria-labelledby="cash-top-ups-title">
      <h2 id="cash-top-ups-title" className="flex items-center gap-2 font-display text-xl font-semibold text-slate-950">
        <HandCoins className="size-5 text-amber-500" aria-hidden /> Cash requests from Staff
      </h2>
      {requests.isPending && <Skeleton className="h-28 rounded-xl" />}
      {requests.isError && (
        <Card>
          <ErrorState message={getErrorMessage(requests.error)} onRetry={() => requests.refetch()} />
        </Card>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {(requests.data ?? []).map((request) => (
          <CashTopUpCard key={request.id} request={request} />
        ))}
      </div>
    </section>
  )
}

function Approvals({ lot }: { lot: ManagedLot }) {
  const cashCloses = useCashCloses(lot.id)
  const cashTopUps = useCashTopUps(lot.id)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval Queue"
       
        actions={
          <span className="rounded-xl bg-slate-50 px-4 py-3 text-right ring-1 ring-slate-200">
            <span className="block text-xs font-bold tracking-wider text-slate-700 uppercase">Waiting</span>
            <span className="font-display text-2xl font-bold text-amber-500">{(cashCloses.data?.length ?? 0) + (cashTopUps.data?.length ?? 0)} requests</span>
          </span>
        }
      />

      <CashTopUps lot={lot} />

      <CashCloses lot={lot} />
    </div>
  )
}

/** /management/approvals. Staff cash requests and cash closes wait here for the lot's Manager. */
export default function ManagerApprovalsPage() {
  return <WithManagerLot>{(lot) => <Approvals lot={lot} />}</WithManagerLot>
}
