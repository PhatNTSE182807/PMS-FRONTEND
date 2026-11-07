import { useState } from 'react'
import { Banknote, CalendarDays, CircleCheck, Lock, LockKeyhole, Minus, PiggyBank, Plus, RotateCcw, Store, TriangleAlert, UserCheck } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { Metric, Panel, SectionTitle, StatTile } from '@/components/features/staff/StaffBits'
import { CashTopUpPanel } from '@/components/features/staff/CashTopUp'
import { vnd } from '@/components/features/manager/managerFormat'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { useAuth } from '@/hooks/useAuth'
import { useCashDrawer, useCloseCashDrawer, useOpenCashDrawer } from '@/hooks/useCashDrawer'
import { useMyStaffLots } from '@/hooks/useParking'
import { useStaffLot } from '@/hooks/useStaffLot'
import { BANKNOTES, cleanNotes, notesTotal } from '@/lib/cashNotes'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { BanknoteCounts, CashDrawerDTO } from '@/types/cashDrawer.dto'

const longDate = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })

const STATUS: Record<CashDrawerDTO['status'], { label: string; tone: string }> = {
  NotOpened: { label: 'Not opened', tone: 'bg-slate-100 text-slate-800' },
  Open: { label: 'Open', tone: 'bg-emerald-100 text-emerald-700' },
  Closed: { label: 'Closed • waiting for the Manager', tone: 'bg-indigo-100 text-indigo-700' },
  HasDifference: { label: 'Difference • waiting for the Manager', tone: 'bg-amber-100 text-amber-700' },
  Confirmed: { label: 'Confirmed by the Manager', tone: 'bg-emerald-100 text-emerald-700' },
}

/** Counted vs expected cash, 0–100: 100 when they match, less the further the count is off. */
function matchPercent(counted: number, expected: number) {
  if (expected <= 0) return counted === 0 ? 100 : 0
  return Math.max(0, 100 - (Math.abs(counted - expected) / expected) * 100)
}

/** The donut with the match in the middle (blue when it balances, amber when it is off). */
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
          className={cn('transition-[stroke-dasharray] duration-500', balanced ? 'stroke-indigo-400' : 'stroke-amber-500')}
          strokeDasharray={`${(c * Math.min(100, percent)) / 100} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center" role="img" aria-label={`Tally match ${Math.round(percent)} percent`}>
        <p className="text-xs font-bold tracking-wider text-slate-700 uppercase">Tally match</p>
        <p className="font-display text-4xl font-bold text-slate-950">{Math.floor(percent * 10) / 10}%</p>
        <p className={cn('font-mono text-xs font-bold', balanced ? 'text-indigo-700' : 'text-amber-500')}>
          {variance > 0 ? '+' : ''}
          {formatNumber(variance)} VND var
        </p>
      </div>
    </div>
  )
}

/** Live reconciliation of the drawer: ring, counted vs expected, notes in the drawer and what to do next. */
function Reconciliation({ drawer, counted }: { drawer: CashDrawerDTO; counted: BanknoteCounts }) {
  const countedTotal = notesTotal(counted)
  const expected = drawer.expectedTotal
  const variance = countedTotal - expected
  const overLimit = Math.abs(variance) > drawer.differenceThreshold
  const notesCounted = Object.values(counted).reduce((sum, n) => sum + n, 0)
  const notesExpected = Object.values(drawer.expectedNotes).reduce((sum, n) => sum + Math.max(0, n), 0)
  return (
    <Panel className="flex flex-col">
      <h2 className="font-display text-lg font-bold text-slate-950">Drawer reconciliation</h2>
      <div className="mt-4">
        <TallyRing percent={matchPercent(countedTotal, expected)} variance={variance} />
      </div>
      <dl className="mt-6 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-700">Counted total</dt>
          <dd className="font-mono font-bold text-slate-950">{vnd(countedTotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-700">Expected total</dt>
          <dd className="font-mono font-bold text-slate-950">{vnd(expected)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-700">Difference</dt>
          <dd className={cn('font-mono font-bold', variance === 0 ? 'text-indigo-700' : overLimit ? 'text-rose-700' : 'text-amber-500')}>
            {variance > 0 ? '+' : ''}
            {vnd(variance)}
          </dd>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-2">
          <dt className="text-slate-700">Notes counted / in the drawer</dt>
          <dd className="font-mono font-bold text-slate-950">
            {formatNumber(notesCounted)} / {formatNumber(notesExpected)}
          </dd>
        </div>
      </dl>
      {variance === 0 ? (
        <div className="mt-4 flex gap-3 rounded-xl bg-[#124e66] p-4">
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-indigo-800" aria-hidden />
          <div>
            <p className="font-bold tracking-wide text-indigo-800 uppercase">Balanced</p>
            <p className="mt-1 text-sm text-indigo-700">The count matches the cash you took plus the float.</p>
          </div>
        </div>
      ) : (
        <div className={cn('mt-4 flex gap-3 rounded-xl p-4 ring-1', overLimit ? 'bg-rose-50 ring-rose-200' : 'bg-amber-50 ring-amber-200')}>
          <TriangleAlert className={cn('mt-0.5 size-5 shrink-0', overLimit ? 'text-rose-700' : 'text-amber-500')} aria-hidden />
          <div>
            <p className={cn('font-bold tracking-wide uppercase', overLimit ? 'text-rose-700' : 'text-amber-500')}>
              Drawer {variance > 0 ? 'over' : 'short'} by {vnd(Math.abs(variance))}
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {overLimit
                ? `More than ${vnd(drawer.differenceThreshold)} off: recount, or give the reason when you close.`
                : 'Within the allowed difference: recount if you can, then close.'}
            </p>
          </div>
        </div>
      )}
      {drawer.untrackedCash > 0 && (
        <p className="mt-3 text-xs text-slate-600">
          {vnd(drawer.untrackedCash)} was taken as an amount, not note by note: it is in the expected total but not in the notes per value.
        </p>
      )}
    </Panel>
  )
}

/** One row per banknote with − / + and a typed count. */
function NoteSheet({ notes, onChange, disabled, expected }: { notes: BanknoteCounts; onChange: (notes: BanknoteCounts) => void; disabled?: boolean; expected?: BanknoteCounts }) {
  const set = (value: number, count: number) => onChange({ ...notes, [value]: Math.max(0, Math.min(99_999, count)) })
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs font-bold tracking-wider text-slate-700 uppercase">
            <th className="rounded-l-lg px-4 py-3">Banknote</th>
            {expected && <th className="px-4 py-3 text-center">In drawer</th>}
            <th className="px-4 py-3 text-center">Count</th>
            <th className="rounded-r-lg px-4 py-3 text-right">Total (VND)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {BANKNOTES.map((value) => {
            const count = notes[value] ?? 0
            return (
              <tr key={value}>
                <td className="px-4 py-2.5 font-display font-semibold text-slate-950">{formatNumber(value)} VND</td>
                {expected && (
                  <td className={cn('px-4 py-2.5 text-center font-mono font-bold', (expected[value] ?? 0) === count ? 'text-indigo-700' : 'text-amber-500')}>
                    {expected[value] ?? 0}
                  </td>
                )}
                <td className="px-4 py-2.5">
                  <div className="mx-auto flex w-36 items-center justify-between rounded-lg bg-[#060f16] ring-1 ring-slate-200">
                    <button type="button" className="px-3 py-1.5 text-slate-700 hover:text-slate-950 disabled:opacity-40" aria-label={`One less ${formatNumber(value)} note`} disabled={disabled || count === 0} onClick={() => set(value, count - 1)}>
                      <Minus className="size-4" />
                    </button>
                    <input
                      inputMode="numeric"
                      aria-label={`${formatNumber(value)} VND notes`}
                      className="w-14 bg-transparent text-center font-mono font-bold text-slate-950 focus-visible:outline-none"
                      value={count}
                      disabled={disabled}
                      onChange={(e) => set(value, Number(e.target.value.replace(/\D/g, '')) || 0)}
                    />
                    <button type="button" className="px-3 py-1.5 text-slate-700 hover:text-slate-950 disabled:opacity-40" aria-label={`One more ${formatNumber(value)} note`} disabled={disabled} onClick={() => set(value, count + 1)}>
                      <Plus className="size-4" />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-950">{formatNumber(value * count)}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td className="px-4 pt-3 font-semibold text-slate-700" colSpan={expected ? 3 : 2}>Total</td>
            <td className="px-4 pt-3 text-right font-mono text-lg font-bold text-amber-500">{vnd(notesTotal(notes))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/** No drawer yet today: count the float into it. */
function OpenDrawer({ lotId, defaultFloat }: { lotId: string; defaultFloat: BanknoteCounts }) {
  // Starts as the standard float: the Staff only fixes the notes they actually have
  const [float, setFloat] = useState<BanknoteCounts>(() => cleanNotes(defaultFloat))
  const open = useOpenCashDrawer()
  return (
    <Panel>
      <SectionTitle icon={<PiggyBank />}>Open your cash drawer</SectionTitle>
      <p className="-mt-2 mb-4 text-sm text-slate-700">
        Count the float you start with ({vnd(notesTotal(defaultFloat))} as standard). Every cash payment you take is then added to the drawer, and the
        change you give is taken out. If you take cash without opening the drawer, one opens on its own with the standard float.
      </p>
      <NoteSheet notes={float} onChange={setFloat} disabled={open.isPending} />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setFloat(cleanNotes(defaultFloat))} disabled={open.isPending}>
          <RotateCcw /> Reset
        </Button>
        <Button onClick={() => open.mutate({ lotId, float: cleanNotes(float) })} disabled={open.isPending}>
          <Banknote /> {open.isPending ? 'Opening…' : `Open drawer with ${vnd(notesTotal(float))}`}
        </Button>
      </div>
    </Panel>
  )
}

/** The drawer is open: count it against the notes the system expects, with the live match beside it. */
function CountDrawer({ lotId, drawer, onClosed }: { lotId: string; drawer: CashDrawerDTO; onClosed: (closed: CashDrawerDTO) => void }) {
  // Starts as what the system expects in the drawer: the Staff only fixes the notes that differ
  const fromDrawer = () => cleanNotes(drawer.expectedNotes)
  const [counted, setCounted] = useState<BanknoteCounts>(fromDrawer)
  const [reason, setReason] = useState('')
  const [needsReason, setNeedsReason] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const close = useCloseCashDrawer()

  const submit = () =>
    close.mutate(
      { lotId, counted: cleanNotes(counted), reason: reason.trim() || undefined },
      {
        onSuccess: (closed) => {
          setConfirming(false)
          onClosed(closed)
        },
        onError: (error) => {
          setConfirming(false)
          const message = getErrorMessage(error)
          // The API asks for a reason when the count is too far off: show it next to the reason box
          if (/reason/i.test(message)) setNeedsReason(message)
          else setNeedsReason(null)
        },
      },
    )

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
    <Panel>
      <SectionTitle icon={<Banknote />} aside={<span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">Drawer {drawer.closeNo} open</span>}>
        Count your drawer
      </SectionTitle>
      <p className="-mt-2 mb-4 text-sm text-slate-700">
        Count every note in the drawer. The In drawer column is what the system expects from your float, the notes taken and the change given; the count starts from it.
      </p>
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-xs text-slate-600">The count starts from the In drawer column: change only the notes that differ.</span>
        <Button size="sm" variant="secondary" disabled={close.isPending} onClick={() => setCounted(fromDrawer())}>
          <Banknote /> Fill from drawer
        </Button>
        <Button size="sm" variant="ghost" disabled={close.isPending} onClick={() => setCounted({})}>
          <RotateCcw /> Clear all
        </Button>
      </div>
      <NoteSheet notes={counted} onChange={setCounted} disabled={close.isPending} expected={drawer.expectedNotes} />
      {needsReason && (
        <div className="mt-4 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <p className="flex items-start gap-2 text-sm font-semibold text-amber-700">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {needsReason}
          </p>
          <label className="mt-3 block text-xs font-bold tracking-wider text-slate-700 uppercase" htmlFor="cash-reason">Reason</label>
          <textarea
            id="cash-reason"
            className="mt-1 w-full rounded-lg bg-[#060f16] p-3 text-sm text-slate-950 ring-1 ring-slate-200 focus-visible:outline-none"
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What happened? e.g. wrong change given to a customer at 14:20"
          />
        </div>
      )}
      {close.isError && !needsReason && <p className="mt-3 text-sm text-rose-700">{getErrorMessage(close.error)}</p>}
      <div className="mt-4 flex justify-end">
        <Button onClick={() => setConfirming(true)} disabled={close.isPending || (needsReason !== null && !reason.trim())}>
          <LockKeyhole /> {close.isPending ? 'Closing…' : 'Close drawer and send to the Manager'}
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Close the cash drawer?"
        confirmLabel="Close drawer"
        pending={close.isPending}
        onConfirm={submit}
        description={`You counted ${vnd(notesTotal(counted))}. Once closed, the count cannot be changed, and drawer ${drawer.closeNo + 1} opens at once with the standard float.`}
      />
    </Panel>
    <Reconciliation drawer={drawer} counted={counted} />
    </div>
  )
}

/** The drawer is closed: what was counted against what was expected, and the Manager's confirmation. */
function ClosedDrawer({ drawer }: { drawer: CashDrawerDTO }) {
  const difference = drawer.difference ?? 0
  const counted = drawer.counted ?? {}
  return (
    <Panel>
      <SectionTitle icon={<Lock />} aside={<span className={cn('rounded px-2 py-0.5 text-xs font-bold', STATUS[drawer.status].tone)}>{STATUS[drawer.status].label}</span>}>
        Drawer {drawer.closeNo} closed {drawer.closedAt ? `at ${clock.format(Date.parse(drawer.closedAt))}` : ''}
      </SectionTitle>
      <div className="mb-4">
        <TallyRing percent={matchPercent(drawer.countedTotal ?? 0, drawer.expectedTotal)} variance={difference} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Counted"><Metric value={formatNumber(drawer.countedTotal ?? 0)} unit="VND" /></StatTile>
        <StatTile label="Expected"><Metric value={formatNumber(drawer.expectedTotal)} unit="VND" /></StatTile>
        <StatTile label="Difference">
          <Metric value={`${difference > 0 ? '+' : ''}${formatNumber(difference)}`} unit="VND" className={difference === 0 ? 'text-emerald-700' : Math.abs(difference) > drawer.differenceThreshold ? 'text-rose-700' : 'text-amber-500'} />
        </StatTile>
      </div>
      {drawer.differenceReason && <p className="mt-4 text-sm text-slate-700"><strong className="text-slate-950">Your reason:</strong> {drawer.differenceReason}</p>}
      {drawer.status === 'Confirmed' && (
        <p className="mt-2 flex items-center gap-2 text-sm text-emerald-700">
          <UserCheck className="size-4" aria-hidden /> Confirmed by {drawer.confirmedByName ?? 'the Manager'}
          {drawer.confirmedAt ? ` at ${clock.format(Date.parse(drawer.confirmedAt))}` : ''}
          {drawer.confirmNote ? ` — ${drawer.confirmNote}` : ''}
        </p>
      )}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-bold tracking-wider text-slate-700 uppercase">
              <th className="rounded-l-lg px-4 py-3">Banknote</th>
              <th className="px-4 py-3 text-right">Counted</th>
              <th className="rounded-r-lg px-4 py-3 text-right">Expected (notes taken note by note)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {BANKNOTES.filter((v) => (counted[v] ?? 0) !== 0 || (drawer.expectedNotes[v] ?? 0) !== 0).map((value) => (
              <tr key={value}>
                <td className="px-4 py-2 font-semibold text-slate-950">{formatNumber(value)} VND</td>
                <td className="px-4 py-2 text-right font-mono">{counted[value] ?? 0}</td>
                <td className={cn('px-4 py-2 text-right font-mono', (counted[value] ?? 0) !== (drawer.expectedNotes[value] ?? 0) && 'text-amber-500')}>{drawer.expectedNotes[value] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {drawer.untrackedCash > 0 && (
        <p className="mt-2 text-xs text-slate-600">{vnd(drawer.untrackedCash)} was entered as an amount, not note by note, so it is in the totals but not in the notes.</p>
      )}
      <p className="mt-4 text-sm text-slate-700">Drawer {drawer.closeNo + 1} opened right after this one, with the standard float.</p>
    </Panel>
  )
}

/** Cash close of the signed-in Staff (BR-12): count blind and hand the drawer in whenever they want; the next one opens with the standard float. */
export default function StaffCashTallyPage() {
  const { user } = useAuth()
  const myLots = useMyStaffLots()
  const { lot } = useStaffLot()
  const lotKey = lot?.id ?? myLots.data?.[0]?.id
  const drawer = useCashDrawer(lotKey)
  const d = drawer.data
  // The drawer just handed in: the page moves on to the next drawer, so its result is kept on screen here
  const [handedIn, setHandedIn] = useState<CashDrawerDTO | null>(null)

  return (
    <div className="space-y-6">
      <Panel>
        <h1 className="font-display text-3xl font-bold text-slate-950">Cash Tally</h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-700">
          <span className="flex items-center gap-1.5"><CalendarDays className="size-4" aria-hidden /> Today, {longDate.format(new Date())}</span>
          <span className="flex items-center gap-1.5"><Store className="size-4" aria-hidden /> {lot?.name ?? myLots.data?.[0]?.name ?? 'No lot assigned'}</span>
          <span className="flex items-center gap-1.5"><UserCheck className="size-4" aria-hidden /> {user?.fullName ?? user?.username}</span>
        </p>
      </Panel>

      {!lotKey && <Panel><p className="text-sm text-slate-700">No assigned parking lot is available.</p></Panel>}
      {lotKey && drawer.isPending && <Skeleton className="h-64 rounded-2xl" />}
      {drawer.isError && <ErrorState message={getErrorMessage(drawer.error, 'Could not load your cash drawer.')} onRetry={() => void drawer.refetch()} />}

      {d && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Drawer status" icon={<CircleCheck />}>
              <p className={cn('mt-3 inline-block rounded px-2 py-1 text-sm font-bold', STATUS[d.status].tone)}>{STATUS[d.status].label}</p>
              {d.openedAt && <p className="mt-2 text-xs text-slate-700">Drawer {d.closeNo} opened at {clock.format(Date.parse(d.openedAt))}</p>}
            </StatTile>
            <StatTile label="Opening float" icon={<PiggyBank />}>
              <Metric value={formatNumber(d.floatTotal)} unit="VND" />
            </StatTile>
            <StatTile label="Cash you took" icon={<Banknote />}>
              <Metric value={formatNumber(d.cashCollected)} unit="VND" />
              <p className="mt-1 text-xs text-slate-700">{formatNumber(d.cashPayments)} cash payments in this drawer</p>
            </StatTile>
            <StatTile label="Allowed difference" icon={<TriangleAlert />}>
              <Metric value={formatNumber(d.differenceThreshold)} unit="VND" />
              <p className="mt-1 text-xs text-slate-700">More needs a reason and the Manager's check</p>
            </StatTile>
          </div>

          {d.status === 'NotOpened' && lotKey && <OpenDrawer lotId={lotKey} defaultFloat={d.defaultFloat} />}
          {d.status === 'Open' && handedIn && handedIn.id !== d.id && <ClosedDrawer drawer={handedIn} />}
          {d.status === 'Open' && lotKey && <CashTopUpPanel lotId={lotKey} drawer={d} />}
          {d.status === 'Open' && lotKey && <CountDrawer key={d.id ?? 0} lotId={lotKey} drawer={d} onClosed={setHandedIn} />}
          {(d.status === 'Closed' || d.status === 'HasDifference' || d.status === 'Confirmed') && <ClosedDrawer drawer={d} />}
        </>
      )}
    </div>
  )
}
