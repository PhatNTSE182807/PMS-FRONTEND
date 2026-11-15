import { useState } from 'react'
import { Banknote, CalendarDays, CircleCheck, HandCoins, Lock, LockKeyhole, PiggyBank, RotateCcw, Store, UserCheck, Wallet } from 'lucide-react'
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
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CashDrawerDTO } from '@/types/cashDrawer.dto'

const longDate = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })

const STATUS: Record<CashDrawerDTO['status'], { label: string; tone: string }> = {
  NotOpened: { label: 'Not opened', tone: 'bg-slate-100 text-slate-800' },
  Open: { label: 'Open', tone: 'bg-emerald-100 text-emerald-700' },
  Closed: { label: 'Handed in • waiting for the Manager', tone: 'bg-indigo-100 text-indigo-700' },
  HasDifference: { label: 'Difference • waiting for the Manager', tone: 'bg-amber-100 text-amber-700' },
  Confirmed: { label: 'Confirmed by the Manager', tone: 'bg-emerald-100 text-emerald-700' },
}

/** Float + cash taken + cash added = cash in the drawer, one line each. */
function TotalBreakdown({ drawer }: { drawer: CashDrawerDTO }) {
  return (
    <dl className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
      <div className="flex justify-between">
        <dt className="text-slate-700">Opening float</dt>
        <dd className="font-mono font-bold text-slate-950">{vnd(drawer.floatTotal)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-slate-700">Cash you took ({formatNumber(drawer.cashPayments)} payments)</dt>
        <dd className="font-mono font-bold text-slate-950">+ {vnd(drawer.cashCollected)}</dd>
      </div>
      {drawer.topUpTotal > 0 && (
        <div className="flex justify-between">
          <dt className="text-slate-700">Cash added by your Manager</dt>
          <dd className="font-mono font-bold text-slate-950">+ {vnd(drawer.topUpTotal)}</dd>
        </div>
      )}
      <div className="flex justify-between border-t border-slate-200 pt-2">
        <dt className="font-semibold text-slate-950">Cash in the drawer</dt>
        <dd className="font-mono text-lg font-bold text-amber-500">{vnd(drawer.cashTotal)}</dd>
      </div>
    </dl>
  )
}

/** No drawer yet: enter the float the Staff starts with (the standard float by default). */
function OpenDrawer({ lotId, defaultFloat }: { lotId: string; defaultFloat: number }) {
  const [float, setFloat] = useState(defaultFloat)
  const open = useOpenCashDrawer()
  return (
    <Panel>
      <SectionTitle icon={<PiggyBank />}>Open your cash drawer</SectionTitle>
      <p className="-mt-2 mb-4 text-sm text-slate-700">
        Enter the cash you start with ({vnd(defaultFloat)} as standard). Every cash payment you take then adds its fee to the drawer total.
        If you take cash without opening the drawer, one opens on its own with the standard float.
      </p>
      <label htmlFor="drawer-float" className="block text-xs font-bold tracking-wider text-slate-700 uppercase">Opening float (VND)</label>
      <input
        id="drawer-float"
        inputMode="numeric"
        value={float ? formatNumber(float) : ''}
        placeholder="0"
        disabled={open.isPending}
        onChange={(e) => setFloat(Math.min(100_000_000, Number(e.target.value.replace(/\D/g, '')) || 0))}
        className="mt-2 w-full max-w-sm rounded-lg bg-well px-3 py-2 font-mono text-xl font-bold text-slate-950 ring-1 ring-slate-200 focus-visible:outline-none"
      />
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => setFloat(defaultFloat)} disabled={open.isPending}>
          <RotateCcw /> Standard float
        </Button>
        <Button onClick={() => open.mutate({ lotId, float })} disabled={open.isPending}>
          <Banknote /> {open.isPending ? 'Opening…' : `Open drawer with ${vnd(float)}`}
        </Button>
      </div>
    </Panel>
  )
}

/** The drawer is open: the running cash total, and handing it in to the Manager. */
function OpenDrawerTotal({ lotId, drawer, onClosed }: { lotId: string; drawer: CashDrawerDTO; onClosed: (closed: CashDrawerDTO) => void }) {
  const [confirming, setConfirming] = useState(false)
  const close = useCloseCashDrawer()

  const submit = () =>
    close.mutate(
      { lotId },
      {
        onSuccess: (closed) => {
          setConfirming(false)
          onClosed(closed)
        },
        onError: () => setConfirming(false),
      },
    )

  return (
    <Panel>
      <SectionTitle icon={<Wallet />} aside={<span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">Drawer {drawer.closeNo} open</span>}>
        Cash in your drawer
      </SectionTitle>
      <p className="-mt-2 mb-4 text-sm text-slate-700">
        The total updates after every cash payment: the fee is added, the change you give back is not kept. There is nothing to count.
      </p>
      <p className="font-display text-4xl font-bold text-slate-950 sm:text-5xl">
        {formatNumber(drawer.cashTotal)} <span className="text-lg font-semibold text-slate-600">VND</span>
      </p>
      <div className="mt-5">
        <TotalBreakdown drawer={drawer} />
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={() => setConfirming(true)} disabled={close.isPending}>
          <LockKeyhole /> {close.isPending ? 'Handing in…' : 'Hand in the drawer to the Manager'}
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Hand in the cash drawer?"
        confirmLabel="Hand in drawer"
        pending={close.isPending}
        onConfirm={submit}
        description={`You hand in ${vnd(drawer.cashTotal)} to your Manager. Drawer ${drawer.closeNo + 1} opens at once with the standard float.`}
      />
    </Panel>
  )
}

/** The drawer is handed in: its cash total and the Manager's confirmation. */
function ClosedDrawer({ drawer }: { drawer: CashDrawerDTO }) {
  // Drawers handed in before counting was dropped still carry their count
  const counted = drawer.countedTotal != null
  const difference = drawer.difference ?? 0
  return (
    <Panel>
      <SectionTitle icon={<Lock />} aside={<span className={cn('rounded px-2 py-0.5 text-xs font-bold', STATUS[drawer.status].tone)}>{STATUS[drawer.status].label}</span>}>
        Drawer {drawer.closeNo} handed in {drawer.closedAt ? `at ${clock.format(Date.parse(drawer.closedAt))}` : ''}
      </SectionTitle>
      <TotalBreakdown drawer={drawer} />
      {counted && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <StatTile label="Counted"><Metric value={formatNumber(drawer.countedTotal ?? 0)} unit="VND" /></StatTile>
          <StatTile label="Difference">
            <Metric value={`${difference > 0 ? '+' : ''}${formatNumber(difference)}`} unit="VND" className={difference === 0 ? 'text-emerald-700' : 'text-amber-500'} />
          </StatTile>
        </div>
      )}
      {drawer.differenceReason && <p className="mt-4 text-sm text-slate-700"><strong className="text-slate-950">Your reason:</strong> {drawer.differenceReason}</p>}
      {drawer.status === 'Confirmed' && (
        <p className="mt-3 flex items-center gap-2 text-sm text-emerald-700">
          <UserCheck className="size-4" aria-hidden /> Confirmed by {drawer.confirmedByName ?? 'the Manager'}
          {drawer.confirmedAt ? ` at ${clock.format(Date.parse(drawer.confirmedAt))}` : ''}
          {drawer.confirmNote ? ` — ${drawer.confirmNote}` : ''}
        </p>
      )}
      <p className="mt-4 text-sm text-slate-700">Drawer {drawer.closeNo + 1} opened right after this one, with the standard float.</p>
    </Panel>
  )
}

/** Cash drawer of the signed-in Staff: one running total, handed in to the Manager whenever they want. */
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
              <Metric value={formatNumber(d.status === 'NotOpened' ? d.defaultFloat : d.floatTotal)} unit="VND" />
            </StatTile>
            <StatTile label="Cash you took" icon={<Banknote />}>
              <Metric value={formatNumber(d.cashCollected)} unit="VND" />
              <p className="mt-1 text-xs text-slate-700">{formatNumber(d.cashPayments)} cash payments in this drawer</p>
            </StatTile>
            <StatTile label="Added by your Manager" icon={<HandCoins />}>
              <Metric value={formatNumber(d.topUpTotal)} unit="VND" />
            </StatTile>
          </div>

          {d.status === 'NotOpened' && lotKey && <OpenDrawer lotId={lotKey} defaultFloat={d.defaultFloat} />}
          {d.status === 'Open' && handedIn && handedIn.id !== d.id && <ClosedDrawer drawer={handedIn} />}
          {d.status === 'Open' && lotKey && <OpenDrawerTotal key={d.id ?? 0} lotId={lotKey} drawer={d} onClosed={setHandedIn} />}
          {d.status === 'Open' && lotKey && <CashTopUpPanel lotId={lotKey} drawer={d} />}
          {(d.status === 'Closed' || d.status === 'HasDifference' || d.status === 'Confirmed') && <ClosedDrawer drawer={d} />}
        </>
      )}
    </div>
  )
}
