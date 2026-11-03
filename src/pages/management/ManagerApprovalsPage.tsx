import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Ban, Banknote, CircleCheck, ClipboardCheck, FileSearch, Info, ListChecks, Search, ShieldAlert, ShieldCheck } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { WithManagerLot } from '@/components/features/manager/ManagerBits'
import { formatClock, formatMinutes } from '@/components/features/manager/managerFormat'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FieldError, Input, Label, NativeSelect } from '@/components/ui/form-controls'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { useDecideLostTicket, usePendingLostTickets } from '@/hooks/useApprovals'
import { useAuth } from '@/hooks/useAuth'
import { useCashCloses, useConfirmCashClose } from '@/hooks/useCashDrawer'
import { formatNumber } from '@/lib/format'
import type { CashDrawerDTO } from '@/types/cashDrawer.dto'
import { useNow } from '@/hooks/useNow'
import { cn } from '@/lib/utils'
import type { ApprovalDecision, LostTicketApprovalDTO } from '@/types/approval.dto'
import type { ManagedLot } from '@/types/lot-management.dto'

const APPROVAL_TOAST = {
  approved: 'Request approved successfully.',
  rejected: 'Request rejected successfully.',
} as const

const REJECTION_REASONS = [
  'Identity documents do not match the vehicle',
  'Evidence is incomplete — ask staff to re-scan',
  'Duplicate request',
]

/** Maker-checker: a Manager never approves a request their own account raised. */
const isOwnRequest = (request: LostTicketApprovalDTO, userId: string | undefined) =>
  Boolean(userId && request.lostTicketReportedBy && request.lostTicketReportedBy === userId)

const accessLabel = (request: LostTicketApprovalDTO) =>
  request.sessionType === 'Reservation' ? `Reservation ${request.reservationCode ?? ''}`.trim() : request.sessionType === 'Whitelist' ? 'Whitelist (free)' : 'Walk-in'

function RequestCard({ request, selected, onSelect, now, own }: { request: LostTicketApprovalDTO; selected: boolean; onSelect: () => void; now: number; own: boolean }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn('w-full rounded-xl bg-white p-4 text-left ring-1 transition-colors', selected ? 'ring-indigo-300' : 'ring-slate-200 hover:bg-slate-50')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-2">
          <span className="rounded bg-amber-100 px-1.5 py-0.5 font-bold text-amber-700 uppercase">Awaiting sign-off</span>
          {own && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-700 uppercase">Your request</span>}
        </span>
        <span className="font-mono text-slate-600">{formatMinutes((now - Date.parse(request.entryTime)) / 60_000)} inside</span>
      </div>
      <p className="mt-2 font-display text-lg font-semibold text-slate-950">Lost ticket report</p>
      <p className="mt-1 flex items-center gap-2 text-sm text-slate-700">
        <span className="rounded bg-[#060f16] px-1.5 py-0.5 font-mono font-bold text-slate-950">{request.plateNumber || 'NO PLATE'}</span>
        {request.vehicleTypeName}
      </p>
      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
        {request.code} • {accessLabel(request)}
      </p>
    </button>
  )
}

function Detail({ request, own }: { request: LostTicketApprovalDTO; own: boolean }) {
  const { user } = useAuth()
  const now = useNow(30_000)
  const decideRequest = useDecideLostTicket()
  const [remarks, setRemarks] = useState('')
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string>()

  const decide = async (decision: ApprovalDecision) => {
    // A missing rejection reason is a form mistake: shown under the field, not as a popup
    if (decision === 'REJECTED' && !reason) {
      setReasonError('Choose a rejection reason.')
      return
    }
    setReasonError(undefined)
    try {
      await decideRequest.mutateAsync({ sessionId: request.id, decision, reason: decision === 'REJECTED' ? reason : remarks.trim() })
      toast.success(decision === 'APPROVED' ? APPROVAL_TOAST.approved : APPROVAL_TOAST.rejected)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const evidence = [
    { label: 'Vehicle type', value: request.vehicleTypeName ?? '—' },
    { label: 'Entered', value: formatClock(Date.parse(request.entryTime)) },
    { label: 'Time inside', value: formatMinutes((now - Date.parse(request.entryTime)) / 60_000) },
    { label: 'Access', value: accessLabel(request) },
    { label: 'Bay / zone', value: request.slotCode ?? request.zoneName ?? '—' },
    { label: 'Session', value: request.code },
  ]

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-11 place-items-center rounded-lg bg-[#124e66] text-indigo-800">
              <ClipboardCheck className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-2xl font-semibold text-slate-950">Request #{request.code}</h2>
              <p className="text-sm text-slate-700">Lost ticket report</p>
            </div>
          </div>
          <span className="rounded bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700 uppercase">Awaiting sign-off</span>
        </div>
        <div className="mt-5 flex gap-3 rounded-xl bg-slate-50 p-4">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
          <div>
            <p className="font-semibold text-slate-950">What your decision does</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">
              A Staff member reported the ticket of {request.plateNumber || 'this vehicle'} as lost. Approving sends the session to payment with the lost ticket fine. Rejecting keeps the
              vehicle parked until the driver comes back with full papers.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold tracking-wider text-amber-500 uppercase">
          <FileSearch className="size-4" aria-hidden /> Session details
        </h3>
        <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {evidence.map((e) => (
            <div key={e.label} className="rounded-lg bg-slate-50 p-3">
              <dt className="text-xs font-bold tracking-wider text-slate-700 uppercase">{e.label}</dt>
              <dd className="mt-1 font-mono text-sm font-bold text-slate-950">{e.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="p-5">
        <h3 className="font-display text-xl font-semibold text-slate-950">Managerial authorisation</h3>
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="approval-remarks">Approval remarks</Label>
            <textarea
              id="approval-remarks"
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Registration certificate checked against the citizen ID."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-indigo-500 focus-visible:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="approval-reason">Rejection reason</Label>
            <NativeSelect
              id="approval-reason"
              value={reason}
              aria-invalid={Boolean(reasonError)}
              onChange={(e) => {
                setReason(e.target.value)
                setReasonError(undefined)
              }}
            >
              <option value="">Select a reason if denying…</option>
              {REJECTION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </NativeSelect>
            <FieldError message={reasonError} />
          </div>
          {own && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              You raised this request yourself, so another manager has to approve it.
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" size="lg" className="text-rose-700" disabled={decideRequest.isPending} onClick={() => void decide('REJECTED')}>
              <Ban /> Reject request
            </Button>
            <Button size="lg" disabled={decideRequest.isPending || own} title={own ? 'You cannot approve a request you raised' : undefined} onClick={() => void decide('APPROVED')}>
              <CircleCheck /> Approve &amp; release
            </Button>
          </div>
          <p className="flex items-start gap-2 text-xs text-slate-600">
            <ShieldCheck className="size-4 shrink-0" aria-hidden />
            Every decision is recorded in the audit trail with your manager account ({user?.username}).
          </p>
        </div>
      </Card>
    </div>
  )
}

const dayClock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })

/** One Staff cash close waiting for the Manager: counted vs expected, and the confirmation (a note when off). */
function CashCloseCard({ close }: { close: CashDrawerDTO }) {
  const { user } = useAuth()
  const confirm = useConfirmCashClose()
  const [note, setNote] = useState('')
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
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', off ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700')}>
          {off ? 'Difference over the limit' : 'Within the limit'}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div><dt className="text-xs text-slate-600">Counted</dt><dd className="font-mono font-bold text-slate-950">{formatNumber(close.countedTotal ?? 0)}</dd></div>
        <div><dt className="text-xs text-slate-600">Expected</dt><dd className="font-mono font-bold text-slate-950">{formatNumber(close.expectedTotal)}</dd></div>
        <div>
          <dt className="text-xs text-slate-600">Difference</dt>
          <dd className={cn('font-mono font-bold', difference === 0 ? 'text-emerald-700' : off ? 'text-rose-700' : 'text-amber-500')}>
            {difference > 0 ? '+' : ''}
            {formatNumber(difference)}
          </dd>
        </div>
      </dl>
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
          <CircleCheck /> Confirm cash close
        </Button>
      </div>
    </Card>
  )
}

/** Staff cash closes of the lot waiting for the Manager (BR-12). */
function CashCloses({ lot }: { lot: ManagedLot }) {
  const closes = useCashCloses(lot.id)
  return (
    <section className="space-y-3" aria-labelledby="cash-closes-title">
      <h2 id="cash-closes-title" className="flex items-center gap-2 font-display text-xl font-semibold text-slate-950">
        <Banknote className="size-5 text-amber-500" aria-hidden /> Cash closes to confirm
      </h2>
      {closes.isPending && <Skeleton className="h-28 rounded-xl" />}
      {closes.isError && (
        <Card>
          <ErrorState message={getErrorMessage(closes.error)} onRetry={() => closes.refetch()} />
        </Card>
      )}
      {closes.isSuccess && closes.data.length === 0 && (
        <Card className="p-6 text-center text-sm text-slate-600">No Staff cash close is waiting for you.</Card>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {(closes.data ?? []).map((close) => (
          <CashCloseCard key={close.id} close={close} />
        ))}
      </div>
    </section>
  )
}

function Approvals({ lot }: { lot: ManagedLot }) {
  const now = useNow(30_000)
  const { user } = useAuth()
  const pending = usePendingLostTickets(lot.id)
  const cashCloses = useCashCloses(lot.id)
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')

  const requests = pending.data ?? []
  const q = query.trim().toLowerCase()
  const visible = requests.filter((r) => !q || [r.code, r.plateNumber, r.vehicleTypeName ?? ''].some((v) => v.toLowerCase().includes(q)))
  // A stale ?id= (already decided) falls back to the first request
  const selected = requests.find((r) => String(r.id) === params.get('id')) ?? visible[0]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <span className="text-amber-500">{lot.name}</span>
            <span aria-hidden>•</span>
            <span>Pending manager sign-offs</span>
          </>
        }
        title="Operational Exceptions & Approval Queue"
        actions={
          <span className="rounded-xl bg-slate-50 px-4 py-3 text-right ring-1 ring-slate-200">
            <span className="block text-xs font-bold tracking-wider text-slate-700 uppercase">Waiting</span>
            <span className="font-display text-2xl font-bold text-amber-500">{requests.length + (cashCloses.data?.length ?? 0)} requests</span>
          </span>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search plate or session code…" className="h-10 pl-9" aria-label="Search requests" />
          </div>
          {pending.isPending && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          {pending.isError && (
            <Card>
              <ErrorState message={getErrorMessage(pending.error)} onRetry={() => pending.refetch()} />
            </Card>
          )}
          {visible.map((r) => (
            <RequestCard key={r.id} request={r} now={now} own={isOwnRequest(r, user?.userId)} selected={r.id === selected?.id} onSelect={() => setParams({ id: String(r.id) }, { replace: true })} />
          ))}
          {pending.isSuccess && visible.length === 0 && (
            <Card className="flex flex-col items-center gap-2 p-8 text-center text-sm text-slate-600">
              <ListChecks className="size-6 text-emerald-700" aria-hidden />
              {requests.length ? 'No request matches your search.' : 'Nothing here — every request has been handled.'}
            </Card>
          )}
        </div>
        {selected ? (
          <Detail key={selected.id} request={selected} own={isOwnRequest(selected, user?.userId)} />
        ) : (
          <Card className="p-8 text-sm text-slate-600">Select a request to review it.</Card>
        )}
      </div>

      <CashCloses lot={lot} />
    </div>
  )
}

/** /management/approvals. Lost-ticket reports and Staff cash closes wait here for the lot's Manager. */
export default function ManagerApprovalsPage() {
  return <WithManagerLot>{(lot) => <Approvals lot={lot} />}</WithManagerLot>
}
