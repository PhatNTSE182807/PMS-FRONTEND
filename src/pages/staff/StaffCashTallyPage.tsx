import { useState } from 'react'
import { Banknote, CalendarDays, CircleCheck, Lock, LockKeyhole, Minus, PiggyBank, Plus, RotateCcw, Store, TriangleAlert, UserCheck } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { Metric, Panel, SectionTitle, StatTile } from '@/components/features/staff/StaffBits'
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

/** One row per banknote with − / + and a typed count. */
function NoteSheet({ notes, onChange, disabled }: { notes: BanknoteCounts; onChange: (notes: BanknoteCounts) => void; disabled?: boolean }) {
  const set = (value: number, count: number) => onChange({ ...notes, [value]: Math.max(0, Math.min(99_999, count)) })
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs font-bold tracking-wider text-slate-700 uppercase">
            <th className="rounded-l-lg px-4 py-3">Banknote</th>
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
            <td className="px-4 pt-3 font-semibold text-slate-700" colSpan={2}>Total</td>
            <td className="px-4 pt-3 text-right font-mono text-lg font-bold text-amber-500">{vnd(notesTotal(notes))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/** No drawer yet today: count the float into it. */
function OpenDrawer({ lotId }: { lotId: string }) {
  const [float, setFloat] = useState<BanknoteCounts>({})
  const open = useOpenCashDrawer()
  return (
    <Panel>
      <SectionTitle icon={<PiggyBank />}>Open your cash drawer</SectionTitle>
      <p className="-mt-2 mb-4 text-sm text-slate-700">
        Count the float you start the day with. Every cash payment you take is then added to the drawer, and the change you give is taken out.
        If you take cash without opening the drawer, one opens on its own with no float.
      </p>
      <NoteSheet notes={float} onChange={setFloat} disabled={open.isPending} />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setFloat({})} disabled={open.isPending}>
          <RotateCcw /> Reset
        </Button>
        <Button onClick={() => open.mutate({ lotId, float: cleanNotes(float) })} disabled={open.isPending}>
          <Banknote /> {open.isPending ? 'Opening…' : `Open drawer with ${vnd(notesTotal(float))}`}
        </Button>
      </div>
    </Panel>
  )
}

/** The drawer is open: count it blind (the expected cash is shown only after the close). */
function CountDrawer({ lotId, drawer }: { lotId: string; drawer: CashDrawerDTO }) {
  const [counted, setCounted] = useState<BanknoteCounts>({})
  const [reason, setReason] = useState('')
  const [needsReason, setNeedsReason] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const close = useCloseCashDrawer()

  const submit = () =>
    close.mutate(
      { lotId, counted: cleanNotes(counted), reason: reason.trim() || undefined },
      {
        onSuccess: () => setConfirming(false),
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
    <Panel>
      <SectionTitle icon={<Banknote />} aside={<span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">Drawer {drawer.closeNo} open</span>}>
        Count your drawer
      </SectionTitle>
      <p className="-mt-2 mb-4 text-sm text-slate-700">
        Count every note in the drawer and enter it below. The expected cash is shown after you close, so count what is really there.
      </p>
      <NoteSheet notes={counted} onChange={setCounted} disabled={close.isPending} />
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
        description={`You counted ${vnd(notesTotal(counted))}. Once closed, the count cannot be changed; cash you take later goes into a new drawer of today.`}
      />
    </Panel>
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
      <p className="mt-4 text-sm text-slate-700">Cash you take after this close opens a new drawer of today on its own.</p>
    </Panel>
  )
}

/** End-of-day cash close of the signed-in Staff (BR-12): open with a float, count blind, close, Manager confirms. */
export default function StaffCashTallyPage() {
  const { user } = useAuth()
  const myLots = useMyStaffLots()
  const { lot } = useStaffLot()
  const lotKey = lot?.id ?? myLots.data?.[0]?.id
  const drawer = useCashDrawer(lotKey)
  const d = drawer.data

  return (
    <div className="space-y-6">
      <Panel>
        <h1 className="font-display text-3xl font-bold text-slate-950">End-of-Day Cash Tally</h1>
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

          {d.status === 'NotOpened' && lotKey && <OpenDrawer lotId={lotKey} />}
          {d.status === 'Open' && lotKey && <CountDrawer key={d.id ?? 0} lotId={lotKey} drawer={d} />}
          {(d.status === 'Closed' || d.status === 'HasDifference' || d.status === 'Confirmed') && <ClosedDrawer drawer={d} />}
        </>
      )}
    </div>
  )
}
