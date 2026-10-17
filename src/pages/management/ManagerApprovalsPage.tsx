import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Ban,
  CircleCheck,
  ClipboardCheck,
  FileSearch,
  Info,
  ListChecks,
  ReceiptText,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
} from 'lucide-react'
import { WithManagerLot } from '@/components/features/manager/ManagerBits'
import { formatMinutes, vnd } from '@/components/features/manager/managerFormat'
import { DemoTag, PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label, NativeSelect } from '@/components/ui/form-controls'
import { useAuth } from '@/hooks/useAuth'
import { decideApproval, useDemoApprovals, type DecidedApproval } from '@/hooks/useDemoApprovals'
import { useNow } from '@/hooks/useNow'
import { cn } from '@/lib/utils'
import type { ApprovalKind, ApprovalPriority } from '@/mocks/managerOps.mock'
import type { ManagedLot } from '@/types/lot-management.dto'

type Tab = 'ALL' | ApprovalKind | 'CLOSED'

const TABS: { value: Tab; label: string; icon: typeof ReceiptText }[] = [
  { value: 'ALL', label: 'All approvals', icon: ClipboardCheck },
  { value: 'LOST_TICKET', label: 'Lost ticket waivers', icon: ReceiptText },
  { value: 'DEPOSIT_REFUND', label: 'Deposit refunds', icon: RotateCcw },
  { value: 'SESSION_CLOSURE', label: 'Abnormal session closure', icon: TriangleAlert },
  { value: 'COUNTER_ADJUSTMENT', label: 'Zone counter adjustments', icon: SlidersHorizontal },
  { value: 'CLOSED', label: 'Reviewed & closed', icon: CircleCheck },
]

const PRIORITY: Record<ApprovalPriority, { label: string; tone: string }> = {
  HIGH: { label: 'High priority', tone: 'bg-rose-100 text-rose-700' },
  NORMAL: { label: 'Normal priority', tone: 'bg-slate-100 text-slate-800' },
  INSPECTION: { label: 'Needs inspection', tone: 'bg-amber-100 text-amber-700' },
  SIGN_OFF: { label: 'Pending sign-off', tone: 'bg-indigo-100 text-indigo-700' },
}

const REJECTION_REASONS = [
  'Identity documents do not match the vehicle',
  'Evidence is incomplete — ask staff to re-scan',
  'Request does not meet the refund policy',
  'Duplicate request',
]

function RequestCard({ request, selected, onSelect, now }: { request: DecidedApproval; selected: boolean; onSelect: () => void; now: number }) {
  const p = PRIORITY[request.priority]
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'w-full rounded-xl bg-white p-4 text-left ring-1 transition-colors',
        selected ? 'ring-indigo-300' : 'ring-slate-200 hover:bg-slate-50',
        request.priority === 'HIGH' && !request.decision && 'border-l-4 border-amber-500',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-2">
          <span className={cn('rounded px-1.5 py-0.5 font-bold uppercase', request.decision ? 'bg-slate-100 text-slate-700' : p.tone)}>
            {request.decision ? request.decision.toLowerCase() : p.label}
          </span>
          <span className="font-mono font-bold text-amber-500">#{request.id}</span>
        </span>
        <span className="font-mono text-slate-600">{formatMinutes((now - request.receivedAt) / 60_000)} ago</span>
      </div>
      <p className="mt-2 font-display text-lg font-semibold text-slate-950">{request.title}</p>
      {request.plate && (
        <p className="mt-1 flex items-center gap-2 text-sm text-slate-700">
          <span className="rounded bg-[#060f16] px-1.5 py-0.5 font-mono font-bold text-slate-950">{request.plate}</span>
          {request.vehicle}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
        <span className="text-slate-700">{request.requestedBy}</span>
        {request.amount !== 0 && (
          <span className={cn('font-mono font-bold', request.amount > 0 ? 'text-amber-500' : 'text-indigo-700')}>
            {request.amount > 0 ? '' : '−'}
            {vnd(Math.abs(request.amount))}
          </span>
        )}
      </div>
    </button>
  )
}

function Detail({ request }: { request: DecidedApproval }) {
  const { user } = useAuth()
  const [remarks, setRemarks] = useState('')
  const [reason, setReason] = useState('')
  const total = request.fees.reduce((s, f) => s + f.amount, 0)

  const decide = (decision: 'APPROVED' | 'REJECTED') => {
    if (decision === 'REJECTED' && !reason) {
      toast.error('Choose a rejection reason first.')
      return
    }
    decideApproval(request.id, decision, decision === 'REJECTED' ? reason : remarks)
    toast.success(`#${request.id} ${decision === 'APPROVED' ? 'approved' : 'rejected'}`, {
      description: 'Demo only: the decision is not sent to the gates until the approval API exists.',
    })
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-11 place-items-center rounded-lg bg-[#124e66] text-indigo-800">
              <ClipboardCheck className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-2xl font-semibold text-slate-950">Request #{request.id}</h2>
              <p className="text-sm text-slate-700">{request.title}</p>
            </div>
          </div>
          <span className={cn('rounded px-2 py-1 text-xs font-bold uppercase', PRIORITY[request.priority].tone)}>{PRIORITY[request.priority].label}</span>
        </div>
        <div className="mt-5 flex gap-3 rounded-xl bg-slate-50 p-4">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
          <div>
            <p className="font-semibold text-slate-950">Incident summary &amp; attendant declaration</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">{request.summary}</p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold tracking-wider text-amber-500 uppercase">
          <FileSearch className="size-4" aria-hidden /> Verification evidence
        </h3>
        <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {request.evidence.map((e) => (
            <div key={e.label} className="rounded-lg bg-slate-50 p-3">
              <dt className="text-xs font-bold tracking-wider text-slate-700 uppercase">{e.label}</dt>
              <dd className="mt-1 font-mono text-sm font-bold text-slate-950">{e.value}</dd>
            </div>
          ))}
        </dl>

        {request.fees.length > 0 && (
          <div className="mt-5 rounded-xl bg-[#0b141b] p-4 ring-1 ring-slate-200">
            <p className="font-semibold text-slate-950">Fee ledger &amp; settlement</p>
            <ul className="mt-3 space-y-2 text-sm">
              {request.fees.map((f) => (
                <li key={f.label} className="flex justify-between gap-4 text-slate-700">
                  {f.label}
                  <span className="font-mono font-bold text-slate-950">{vnd(f.amount)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
              <span className="font-semibold text-slate-950">{total >= 0 ? 'Total payable' : 'Total refund / waiver'}</span>
              <span className="font-mono text-2xl font-bold text-amber-500">{vnd(Math.abs(total))}</span>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="font-display text-xl font-semibold text-slate-950">Managerial authorisation</h3>
        {request.decision ? (
          <p className={cn('mt-4 flex items-start gap-2 rounded-xl p-4 text-sm', request.decision === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
            {request.decision === 'APPROVED' ? <CircleCheck className="size-4 shrink-0" aria-hidden /> : <Ban className="size-4 shrink-0" aria-hidden />}
            {request.decision === 'APPROVED' ? 'Approved' : 'Rejected'} by {user?.fullName}
            {request.remarks ? ` — ${request.remarks}` : ''}
          </p>
        ) : (
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
              <NativeSelect id="approval-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">Select a reason if denying…</option>
                {REJECTION_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="outline" size="lg" className="text-rose-700" onClick={() => decide('REJECTED')}>
                <Ban /> Reject request
              </Button>
              <Button size="lg" onClick={() => decide('APPROVED')}>
                <CircleCheck /> Approve &amp; release
              </Button>
            </div>
            <p className="flex items-start gap-2 text-xs text-slate-600">
              <ShieldCheck className="size-4 shrink-0" aria-hidden />
              Every decision is recorded in the audit trail with your manager account ({user?.username}).
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}

function Approvals({ lot }: { lot: ManagedLot }) {
  const now = useNow(30_000)
  const { all, pending } = useDemoApprovals()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>('ALL')
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const visible = all.filter((a) => {
    const inTab = tab === 'ALL' ? !a.decision : tab === 'CLOSED' ? Boolean(a.decision) : a.kind === tab && !a.decision
    return inTab && (!q || [a.id, a.plate ?? '', a.requestedBy, a.title].some((v) => v.toLowerCase().includes(q)))
  })
  const count = (t: Tab) => (t === 'ALL' ? pending.length : t === 'CLOSED' ? all.length - pending.length : pending.filter((a) => a.kind === t).length)
  const selectedId = params.get('id') ?? visible[0]?.id
  const selected = all.find((a) => a.id === selectedId)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <span className="text-amber-500">{lot.name}</span>
            <span aria-hidden>•</span>
            <span>Pending manager sign-offs</span>
            <DemoTag />
          </>
        }
        title="Operational Exceptions & Approval Queue"
        actions={
          <span className="rounded-xl bg-slate-50 px-4 py-3 text-right ring-1 ring-slate-200">
            <span className="block text-xs font-bold tracking-wider text-slate-700 uppercase">Waiting</span>
            <span className="font-display text-2xl font-bold text-amber-500">{pending.length} requests</span>
          </span>
        }
      />

      <div role="tablist" aria-label="Request type" className="flex flex-wrap gap-2">
        {TABS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ring-1 transition-colors',
              tab === value ? 'bg-[#124e66] text-indigo-800 ring-indigo-300' : 'bg-white text-slate-800 ring-slate-200 hover:bg-slate-50',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
            <span className="rounded-md bg-slate-100 px-1.5 font-mono text-xs text-slate-900">{count(value)}</span>
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search plate, request ID, staff…" className="h-10 pl-9" aria-label="Search requests" />
          </div>
          {visible.map((a) => (
            <RequestCard key={a.id} request={a} now={now} selected={a.id === selected?.id} onSelect={() => setParams({ id: a.id }, { replace: true })} />
          ))}
          {visible.length === 0 && (
            <Card className="flex flex-col items-center gap-2 p-8 text-center text-sm text-slate-600">
              <ListChecks className="size-6 text-emerald-700" aria-hidden />
              Nothing here — every request in this group has been handled.
            </Card>
          )}
        </div>
        {selected ? <Detail key={selected.id} request={selected} /> : <Card className="p-8 text-sm text-slate-600">Select a request to review it.</Card>}
      </div>
    </div>
  )
}

/** /management/approvals. Requests are demo data until the approval API exists. */
export default function ManagerApprovalsPage() {
  return <WithManagerLot>{(lot) => <Approvals lot={lot} />}</WithManagerLot>
}
