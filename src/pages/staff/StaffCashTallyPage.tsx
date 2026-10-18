import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  ChartColumn,
  CircleCheck,
  Fingerprint,
  IdCard,
  Info,
  Lock,
  LockKeyhole,
  Minus,
  PenLine,
  PiggyBank,
  Plus,
  Printer,
  QrCode,
  RotateCcw,
  ScanLine,
  Search,
  ShieldCheck,
  Store,
  TriangleAlert,
  UserCheck,
} from 'lucide-react'
import { Metric, Panel, Plate, StatTile } from '@/components/features/staff/StaffBits'
import { formatMinutes, vnd } from '@/components/features/manager/managerFormat'
import { DemoTag } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form-controls'
import { useAuth } from '@/hooks/useAuth'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { demoCashReceipts, demoDenominations, demoDrawer, demoStation } from '@/mocks/staffOps.mock'

const longDate = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const clockWithSeconds = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function TallyRing({ percent, variance }: { percent: number; variance: number }) {
  const r = 52
  const c = 2 * Math.PI * r
  const balanced = variance === 0
  return (
    <div className="relative mx-auto size-44">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-slate-200" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className={balanced ? 'stroke-indigo-400' : 'stroke-amber-500'}
          strokeDasharray={`${(c * Math.min(100, percent)) / 100} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <p className="text-xs font-bold tracking-wider text-slate-700 uppercase">Tally match</p>
        <p className="font-display text-4xl font-bold text-slate-950">{Math.round(percent)}%</p>
        <p className={cn('font-mono text-xs font-bold', balanced ? 'text-indigo-700' : 'text-amber-500')}>
          {variance > 0 ? '+' : ''}
          {formatNumber(variance)} VND var
        </p>
      </div>
    </div>
  )
}

export default function StaffCashTallyPage() {
  const { user } = useAuth()
  const d = demoDrawer
  const [counts, setCounts] = useState(() => demoDenominations.map((n) => n.count))
  const [notes, setNotes] = useState(
    `All ${d.cashTransactions} cash transactions audited against gate barrier optical passes. Retained ${vnd(d.float)} for the next operating float. Vault settlement drop envelope #${d.envelope} sealed and signed.`,
  )
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [locked, setLocked] = useState(false)

  const target = d.float + d.systemCash
  const counted = counts.reduce((s, n, i) => s + n * demoDenominations[i].value, 0)
  const notesCounted = counts.reduce((s, n) => s + n, 0)
  const variance = counted - target
  const match = target ? (Math.min(counted, target) / Math.max(counted, target)) * 100 : 100

  const setCount = (index: number, value: number) => setCounts((prev) => prev.map((n, i) => (i === index ? Math.max(0, Math.min(9999, value)) : n)))

  const receipts = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    const list = q ? demoCashReceipts.filter((r) => `${r.id}${r.plate}`.toLowerCase().replace(/[^a-z0-9]/g, '').includes(q)) : demoCashReceipts
    return showAll ? list : list.slice(0, 8)
  }, [query, showAll])

  const lock = () => {
    if (notes.trim().length < 20) {
      toast.error('Write the settlement notes first', { description: 'The Manager needs at least a short summary to accept the tally.' })
      return
    }
    setLocked(true)
    toast.success(`Drawer locked and submitted to ${demoStation.manager}`, {
      description: `Counted ${vnd(counted)} (variance ${vnd(variance)}). Demo only: nothing is sent until the cash API exists.`,
    })
  }

  return (
    <div className="space-y-6">
      <Panel className="flex flex-col gap-5 bg-linear-to-br from-[#182127] via-[#141d23] to-[#1a2a2f] lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-wider uppercase">
            <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-700">Terminal audit tally</span>
            <span className="rounded bg-indigo-100 px-2 py-0.5 text-indigo-700">Session ID: #{d.sessionId}</span>
            <span className="text-slate-700">Whole-day fiscal ledger</span>
            <DemoTag />
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">End-of-day cash reconciliation &amp; vault settlement</h1>
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-700">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden /> Today, {longDate.format(Date.now())}
            </span>
            <span className="flex items-center gap-1.5">
              <Store className="size-4" aria-hidden /> {demoStation.station} - {demoStation.lane}
            </span>
            <span className="flex items-center gap-1.5">
              <IdCard className="size-4" aria-hidden /> {user?.fullName} ({demoStation.employeeCode}) • {demoStation.title}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold tracking-wider text-slate-700 uppercase">Settlement status</p>
            <p className={cn('flex items-center gap-1.5 text-sm font-semibold', locked ? 'text-emerald-700' : 'text-amber-500')}>
              <span className="size-2 rounded-full bg-current" aria-hidden />
              {locked ? 'Locked • awaiting Manager sign-off' : 'Pending Manager verification'}
            </p>
          </div>
          <Button variant="secondary" className="h-auto py-3" onClick={() => window.print()}>
            <Printer /> Export tally log
          </Button>
        </div>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="System cash rev." icon={<Banknote />}>
          <Metric value={formatNumber(d.systemCash)} unit="VND" />
          <p className="mt-1 text-sm text-slate-700">{d.cashTransactions} transactions recorded</p>
        </StatTile>
        <StatTile label="Digital cleared" icon={<QrCode />}>
          <Metric value={formatNumber(d.digitalCleared)} unit="VND" />
          <p className="mt-1 text-sm text-slate-700">{d.digitalTransactions} transactions (VietQR/card)</p>
        </StatTile>
        <StatTile label="Total day revenue" icon={<ChartColumn />}>
          <Metric value={formatNumber(d.systemCash + d.digitalCleared)} unit="VND" />
          <p className="mt-1 text-sm text-slate-700">Gross station turnover</p>
        </StatTile>
        <StatTile label="Initial drawer float" icon={<PiggyBank />}>
          <Metric value={formatNumber(d.float)} unit="VND" />
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-700">
            <CircleCheck className="size-3.5" aria-hidden /> Pre-loaded petty cash, verified 00:00
          </p>
        </StatTile>
        <StatTile label="Target cash in drawer" icon={<LockKeyhole />} className="bg-[#124e66] ring-indigo-300">
          <Metric value={formatNumber(target)} unit="VND" className="text-indigo-800" />
          <p className="mt-1 text-sm text-indigo-700">
            Float ({formatNumber(d.float / 1e6)}M) + revenue ({formatNumber(d.systemCash / 1e6)}M)
          </p>
        </StatTile>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Panel>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-950">
                <ScanLine className="size-5 text-amber-500" aria-hidden /> Physical cash denomination breakdown
              </h2>
              <p className="mt-1 text-sm text-slate-700">Count the banknotes from the Station 01 lockbox. The balance is checked against the expected drawer target.</p>
            </div>
            <Button variant="secondary" size="sm" disabled={locked} onClick={() => setCounts(demoDenominations.map(() => 0))}>
              <RotateCcw /> Reset sheet
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-bold tracking-wider text-slate-700 uppercase">
                  <th className="rounded-l-lg px-4 py-3">Banknote</th>
                  <th className="px-4 py-3">Specimen check</th>
                  <th className="px-4 py-3 text-center">Physical count</th>
                  <th className="rounded-r-lg px-4 py-3 text-right">Total (VND)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {demoDenominations.map((n, i) => (
                  <tr key={n.value}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className={cn('rounded px-1.5 py-0.5 font-mono text-[11px] font-bold', i === 1 ? 'bg-amber-200 text-amber-800' : 'bg-indigo-100 text-indigo-700')}>{n.code}</span>
                        <div>
                          <p className="font-semibold text-slate-950">{vnd(n.value)}</p>
                          <p className="text-xs text-slate-700">{n.note}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                        <ShieldCheck className="size-3.5" aria-hidden /> UV scan clear
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="mx-auto flex w-fit items-center gap-1 rounded-lg bg-[#060f16] p-1 ring-1 ring-slate-200">
                        <Button variant="ghost" size="icon" className="size-7" aria-label={`One fewer ${n.code} note`} disabled={locked || counts[i] === 0} onClick={() => setCount(i, counts[i] - 1)}>
                          <Minus />
                        </Button>
                        <input
                          aria-label={`${n.code} note count`}
                          inputMode="numeric"
                          value={counts[i]}
                          disabled={locked}
                          onChange={(e) => setCount(i, Number(e.target.value.replace(/\D/g, '')) || 0)}
                          className="w-12 bg-transparent text-center font-mono font-bold text-slate-950 focus-visible:outline-none"
                        />
                        <Button variant="ghost" size="icon" className="size-7" aria-label={`One more ${n.code} note`} disabled={locked} onClick={() => setCount(i, counts[i] + 1)}>
                          <Plus />
                        </Button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-950">{vnd(counts[i] * n.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span className="flex items-center gap-1.5">
              <Info className="size-4 text-amber-500" aria-hidden /> Total banknotes counted: <strong className="text-slate-950">{notesCounted} notes</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-indigo-700" aria-hidden /> Counterfeit sensor check: <strong className="text-indigo-700">100% passed</strong>
            </span>
          </div>
        </Panel>

        <Panel className="flex flex-col">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-950">Drawer reconciliation</h2>
            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-800">CALC v2.4</span>
          </div>
          <TallyRing percent={match} variance={variance} />
          <dl className="mt-6 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-700">Physical counted total</dt>
              <dd className="font-mono font-bold text-slate-950">{vnd(counted)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-700">System expected total</dt>
              <dd className="font-mono font-bold text-slate-950">{vnd(target)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-700">Reconciliation discrepancy</dt>
              <dd className={cn('font-mono font-bold', variance === 0 ? 'text-indigo-700' : 'text-amber-500')}>{vnd(variance)}</dd>
            </div>
          </dl>
          {variance === 0 ? (
            <div className="mt-4 flex gap-3 rounded-xl bg-[#124e66] p-4">
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-indigo-800" aria-hidden />
              <div>
                <p className="font-bold tracking-wide text-indigo-800 uppercase">Perfect reconciliation - balanced</p>
                <p className="mt-1 text-sm text-indigo-700">Drawer cash balances with the system transaction audit ledger.</p>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex gap-3 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
              <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-500" aria-hidden />
              <div>
                <p className="font-bold tracking-wide text-amber-500 uppercase">{variance > 0 ? 'Drawer over' : 'Drawer short'} by {vnd(Math.abs(variance))}</p>
                <p className="mt-1 text-sm text-slate-700">Recount the notes, or explain the variance in the settlement notes before locking.</p>
              </div>
            </div>
          )}
          <dl className="mt-auto space-y-1.5 rounded-xl bg-[#060f16] p-4 pt-4 font-mono text-xs font-bold uppercase">
            <div className="flex justify-between">
              <dt className="text-slate-700">Deposit envelope #</dt>
              <dd className="text-amber-500">{d.envelope}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-700">Next float retained</dt>
              <dd className="text-slate-950">{vnd(d.float)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-700">Net safe drop total</dt>
              <dd className="text-indigo-700">{vnd(Math.max(0, counted - d.float))}</dd>
            </div>
          </dl>
        </Panel>
      </div>

      <Panel>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-950">
              Daily cash transaction audit manifest
              <span className="rounded bg-indigo-100 px-2 py-0.5 font-mono text-xs text-indigo-700">{d.cashTransactions} entries</span>
              <DemoTag />
            </h2>
            <p className="mt-1 text-sm text-slate-700">Sequential ledger of the cash collections validated at Station 01 today.</p>
          </div>
          <label className="relative">
            <span className="sr-only">Filter plate or receipt</span>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-500" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter plate or receipt…" className="w-60 pl-8" />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-bold tracking-wider text-slate-700 uppercase">
                <th className="rounded-l-lg px-4 py-3">Receipt #</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Vehicle plate</th>
                <th className="px-4 py-3">Dwell</th>
                <th className="px-4 py-3">Tariff class</th>
                <th className="px-4 py-3 text-right">Amount paid</th>
                <th className="rounded-r-lg px-4 py-3">Cashier audit note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {receipts.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono text-xs font-bold text-indigo-700">{r.id}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-900">{clockWithSeconds.format(r.at)}</td>
                  <td className="px-4 py-2.5"><Plate className="text-amber-500">{r.plate}</Plate></td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-900">{formatMinutes(r.dwellMinutes)}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-900">{r.tariffClass}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-slate-950">{vnd(r.amount)}</td>
                  <td className="px-4 py-2.5 text-slate-700">{r.note}</td>
                </tr>
              ))}
              {receipts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-700">
                    No cash receipt matches “{query}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs font-semibold text-slate-700">
          <span>{d.cashTransactions - demoCashReceipts.length} earlier daytime transactions archived in station memory</span>
          {!showAll && demoCashReceipts.length > 8 && (
            <button type="button" className="flex items-center gap-1 text-indigo-700 hover:underline" onClick={() => setShowAll(true)}>
              Show all <ArrowRight className="size-3.5" aria-hidden />
            </button>
          )}
        </div>
      </Panel>

      <Panel className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-950">
              <PenLine className="size-5 text-amber-500" aria-hidden /> Mandatory operator daily settlement notes
            </h2>
            <span className="text-xs font-bold tracking-wider text-slate-700 uppercase">Required for Manager acceptance</span>
          </div>
          <label htmlFor="settlement-notes" className="sr-only">
            Settlement notes
          </label>
          <textarea
            id="settlement-notes"
            rows={5}
            value={notes}
            disabled={locked}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-4 w-full resize-y rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-900 ring-1 ring-slate-200 focus-visible:ring-indigo-400 disabled:opacity-70"
          />
          <p className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-700">
            <span className="flex items-center gap-1.5">
              <Fingerprint className="size-4 text-indigo-700" aria-hidden /> Terminal auth: <strong className="text-slate-950">{user?.fullName} ({demoStation.employeeCode})</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <UserCheck className="size-4 text-amber-500" aria-hidden /> Assigned manager: <strong className="text-slate-950">{demoStation.manager} ({demoStation.managerCode})</strong>
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex gap-3 rounded-xl bg-rose-100 p-4 ring-1 ring-rose-200">
            <Lock className="mt-0.5 size-5 shrink-0 text-rose-700" aria-hidden />
            <div>
              <p className="text-sm font-bold tracking-wide text-rose-700 uppercase">Terminal lockdown enforcement</p>
              <p className="mt-1 text-sm text-rose-800">
                Once locked, this POS station stops cash collection until {demoStation.manager} counter-signs the drop envelope with the supervisor key.
              </p>
            </div>
          </div>
          <Button className="h-auto rounded-xl bg-indigo-400 py-4 font-display text-lg whitespace-normal text-[#003548] hover:bg-indigo-800" disabled={locked} onClick={lock}>
            <LockKeyhole className="size-5!" /> {locked ? 'Drawer locked & submitted' : `Lock drawer & submit to ${demoStation.manager}`}
          </Button>
          <p className="flex justify-between text-xs text-slate-600">
            <span>Action logged to audit cloud</span>
            <span className="font-mono uppercase">Encryption: AES-256 GCM</span>
          </p>
        </div>
      </Panel>
    </div>
  )
}
