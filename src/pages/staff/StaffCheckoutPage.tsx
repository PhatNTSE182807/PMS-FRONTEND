import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ArrowUp, Banknote, Car, Lock, QrCode, ReceiptText, RefreshCw, Send, ShieldCheck, Wifi } from 'lucide-react'
import { CameraFrame, Key, Panel, SectionTitle } from '@/components/features/staff/StaffBits'
import { isTypingTarget } from '@/components/features/staff/staffKeys'
import { formatClock, formatMinutes, vnd } from '@/components/features/manager/managerFormat'
import { DemoTag } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form-controls'
import { useNow } from '@/hooks/useNow'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { demoCheckout } from '@/mocks/staffOps.mock'

const FAST_NOTES = [100_000, 200_000, 500_000]
const QR_TTL_MS = 60_000

/** Fake VietQR pattern: a deterministic grid so the code looks like a QR without encoding anything. */
function QrGlyph() {
  const cells = Array.from({ length: 21 * 21 }, (_, i) => {
    const x = i % 21
    const y = Math.floor(i / 21)
    const finder = (cx: number, cy: number) => x >= cx && x < cx + 7 && y >= cy && y < cy + 7
    if (finder(0, 0) || finder(14, 0) || finder(0, 14)) {
      const lx = x % 14 === x ? x : x - 14
      const ly = y % 14 === y ? y : y - 14
      const ring = lx === 0 || lx === 6 || ly === 0 || ly === 6
      const core = lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4
      return ring || core
    }
    return ((x * 7 + y * 13 + x * y) % 5) < 2
  })
  return (
    <svg viewBox="0 0 21 21" className="size-40" role="img" aria-label="VietQR payment code (demo)">
      <rect width="21" height="21" fill="#f2f7fa" />
      {cells.map((on, i) => (on ? <rect key={i} x={i % 21} y={Math.floor(i / 21)} width="1" height="1" fill="#0b141b" /> : null))}
    </svg>
  )
}

export default function StaffCheckoutPage() {
  const c = demoCheckout
  const gross = c.tariff.reduce((s, l) => s + l.amount, 0)
  const [waived, setWaived] = useState(false)
  const net = waived ? 0 : gross + c.deposit.amount
  const [tendered, setTendered] = useState(0)
  const [paidByQr, setPaidByQr] = useState(false)
  const [qrIssuedAt, setQrIssuedAt] = useState(() => Date.now())
  const [phone, setPhone] = useState(c.receiptPhone)
  const [cleared, setCleared] = useState(false)
  const cashRef = useRef<HTMLInputElement>(null)
  const now = useNow(1000)
  const qrLeft = Math.max(0, Math.ceil((qrIssuedAt + QR_TTL_MS - now) / 1000))
  const change = tendered - net
  const settled = paidByQr || net === 0 || tendered >= net

  const reset = useCallback(() => {
    setTendered(0)
    setPaidByQr(false)
    setWaived(false)
    setCleared(false)
    setQrIssuedAt(Date.now())
  }, [])

  const confirm = useCallback(() => {
    if (cleared) return
    if (!settled) {
      toast.error('Payment not settled', { description: `Collect ${vnd(net - tendered)} more, or wait for the VietQR push.` })
      return
    }
    setCleared(true)
    toast.success(`Barrier lifted for ${c.plate}`, {
      description: `${paidByQr ? 'Paid by VietQR' : net === 0 ? 'Fee waived' : `Cash ${vnd(tendered)}, change ${vnd(Math.max(0, change))}`}. Demo only: no barrier is connected.`,
    })
  }, [c.plate, change, cleared, net, paidByQr, settled, tendered])

  const checkGateway = useCallback(() => {
    setPaidByQr(true)
    toast.success('NAPAS gateway: payment received', { description: `${vnd(net)} via VietQR. Demo only.` })
  }, [net])

  const toggleWaiver = useCallback(() => {
    setWaived((w) => !w)
    toast.info(waived ? 'Waiver removed' : 'Waiver applied', { description: 'A waiver needs Manager approval once the approval API exists.' })
  }, [waived])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        reset()
        return
      }
      if (isTypingTarget(e.target)) return
      if (e.key === 'F5') {
        e.preventDefault()
        cashRef.current?.focus()
      } else if (e.key === 'F8') {
        e.preventDefault()
        checkGateway()
      } else if (e.key === 'F9') {
        e.preventDefault()
        toggleWaiver()
      } else if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        confirm()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [checkGateway, confirm, reset, toggleWaiver])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-slate-50 px-4 py-3 text-xs font-semibold tracking-wider text-slate-700 uppercase">
        <span className="text-slate-950">Active transaction session</span>
        <span className="font-mono text-amber-500">TXN-ID #{c.txnId}</span>
        <span className="flex items-center gap-1.5 text-indigo-700">
          <ShieldCheck className="size-4" aria-hidden /> Anti-passback guard active
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <Wifi className="size-4 text-indigo-700" aria-hidden /> Gate-arm-01: {cleared ? 'raised' : 'ready'}
        </span>
        <DemoTag />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Left column: vehicle and tariff */}
        <div className="space-y-6">
          <Panel>
            <SectionTitle icon={<Car />} aside={<span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700 uppercase">Matched ({c.matchScore}%)</span>}>
              Active vehicle profile
            </SectionTitle>
            <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl bg-[#060f16] p-5 ring-1 ring-slate-200">
              <div>
                <p className="text-xs font-bold tracking-wider text-slate-700 uppercase">Registered plate</p>
                <p className="mt-1 font-mono text-4xl font-bold tracking-[0.12em] text-slate-950">{c.plate}</p>
                <p className="mt-1 text-sm text-amber-500">{c.vehicle}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold tracking-wider text-slate-700 uppercase">Clearance lane</p>
                <p className="font-mono text-xl font-bold text-slate-950">{c.lane}</p>
                <p className="text-xs font-bold tracking-wider text-indigo-700 uppercase">{c.laneName}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <figure>
                <figcaption className="mb-1.5 flex justify-between text-xs font-bold tracking-wider text-slate-700 uppercase">
                  Entry snapshot <span className="font-mono">{formatClock(c.checkIn)}</span>
                </figcaption>
                <CameraFrame image={c.entryImage} alt="Entry camera snapshot" bottomLeft="CAM-01-ENTRY" />
              </figure>
              <figure>
                <figcaption className="mb-1.5 flex justify-between text-xs font-bold tracking-wider text-indigo-700 uppercase">
                  Exit live capture <span className="font-mono">{formatClock(c.exitAt)}</span>
                </figcaption>
                <CameraFrame image={c.exitImage} alt="Exit camera live capture" bottomLeft="● Live OCR" />
              </figure>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 py-2">
                <dt className="text-xs font-bold text-slate-700 uppercase">Check-in</dt>
                <dd className="font-mono font-bold text-slate-950">{formatClock(c.checkIn)}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 py-2">
                <dt className="text-xs font-bold text-slate-700 uppercase">Exit present</dt>
                <dd className="font-mono font-bold text-slate-950">{formatClock(c.exitAt)}</dd>
              </div>
              <div className="rounded-lg bg-amber-50 py-2">
                <dt className="text-xs font-bold text-amber-500 uppercase">Total dwell</dt>
                <dd className="font-mono font-bold text-amber-500">{formatMinutes((c.exitAt - c.checkIn) / 60_000)}</dd>
              </div>
            </dl>
          </Panel>

          <Panel>
            <SectionTitle icon={<ReceiptText />} aside={<span className="font-mono text-xs text-slate-700">Rate card: {c.rateCard}</span>}>
              Tariff calculation breakdown
            </SectionTitle>
            <ul className="divide-y divide-slate-200">
              {c.tariff.map((l) => (
                <li key={l.label} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="font-medium text-slate-950">{l.label}</p>
                    <p className="text-sm text-slate-700">{l.detail}</p>
                  </div>
                  <span className="font-mono text-sm font-bold text-slate-950">{vnd(l.amount)}</span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-3 py-3">
                <span className="font-semibold text-slate-950 uppercase">Total gross dwell fee</span>
                <span className="font-mono text-sm font-bold text-slate-950">{vnd(gross)}</span>
              </li>
              <li className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="flex items-center gap-1.5 font-medium text-indigo-700">
                    <QrCode className="size-4" aria-hidden /> {c.deposit.label}
                  </p>
                  <p className="text-sm text-slate-700">{c.deposit.detail}</p>
                </div>
                <span className="font-mono text-sm font-bold text-indigo-700">−{vnd(Math.abs(c.deposit.amount))}</span>
              </li>
            </ul>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#060f16] p-5 ring-1 ring-slate-200">
              <div>
                <p className="text-xs font-bold tracking-wider text-amber-500 uppercase">Net final fee payable</p>
                <p className="text-sm text-slate-700">{waived ? 'Waiver applied • pending Manager approval' : 'All taxes included • Ready for settlement'}</p>
              </div>
              <p className={cn('font-mono text-4xl font-bold text-amber-500', waived && 'text-slate-500')}>{vnd(net)}</p>
            </div>
          </Panel>
        </div>

        {/* Right column: payment and barrier */}
        <div className="space-y-6">
          <Panel>
            <SectionTitle icon={<Banknote />} aside={<span className="text-xs font-semibold text-slate-700">Active provider: <span className="text-amber-500">NAPAS 24/7 gateway</span></span>}>
              Payment channel collector
            </SectionTitle>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="flex flex-col items-center rounded-xl bg-slate-50 p-4">
                <div className="flex w-full items-center justify-between text-xs font-bold">
                  <span className="rounded bg-indigo-100 px-2 py-0.5 text-indigo-700 uppercase">VietQR Pro</span>
                  <span className={cn('font-mono', paidByQr ? 'text-emerald-700' : qrLeft > 0 ? 'text-indigo-700' : 'text-rose-700')}>
                    {paidByQr ? 'Paid' : qrLeft > 0 ? `${qrLeft}s countdown` : 'Expired'}
                  </span>
                </div>
                <div className={cn('mt-4 rounded-xl bg-[#060f16] p-3 ring-1 ring-slate-200', (paidByQr || qrLeft === 0) && 'opacity-40')}>
                  <QrGlyph />
                  <p className="mt-2 text-center font-mono text-xs font-bold tracking-wider text-slate-950">VIETCOMBANK • LOT-SGC</p>
                </div>
                <div className="mt-4 flex w-full items-center gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
                  <RefreshCw className={cn('size-4 text-indigo-700', !paidByQr && 'animate-spin [animation-duration:3s]')} aria-hidden />
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="text-sm font-semibold text-slate-950">Polling webhook</p>
                    <p className="font-mono text-xs text-slate-700">Listening on port 8443</p>
                  </div>
                  {qrLeft === 0 && !paidByQr ? (
                    <Button size="sm" variant="secondary" onClick={() => setQrIssuedAt(Date.now())}>
                      Reissue
                    </Button>
                  ) : (
                    <span className={cn('rounded px-1.5 py-0.5 font-mono text-[11px] font-bold', paidByQr ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                      {paidByQr ? 'Received' : 'Awaiting push'}
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-display text-lg font-bold text-slate-950 uppercase">Cash tender desk</p>
                  <Key>F5 Keypad</Key>
                </div>
                <p className="mt-3 text-xs font-bold tracking-wider text-slate-700 uppercase">Fast denominations</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {FAST_NOTES.map((note) => (
                    <button
                      key={note}
                      type="button"
                      onClick={() => setTendered(note)}
                      className={cn(
                        'rounded-lg py-2 font-mono text-sm font-bold ring-1 transition-colors',
                        tendered === note ? 'bg-[#124e66] text-indigo-800 ring-indigo-300' : 'bg-white text-slate-950 ring-slate-200 hover:bg-slate-100',
                      )}
                    >
                      {formatNumber(note)}
                    </button>
                  ))}
                </div>
                <label htmlFor="cash-received" className="mt-4 block text-xs font-bold tracking-wider text-slate-700 uppercase">
                  Cash received (VND)
                </label>
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-[#060f16] p-2 ring-1 ring-slate-200">
                  <input
                    id="cash-received"
                    ref={cashRef}
                    inputMode="numeric"
                    value={tendered ? formatNumber(tendered) : ''}
                    placeholder="0"
                    onChange={(e) => setTendered(Number(e.target.value.replace(/\D/g, '')) || 0)}
                    className="min-w-0 flex-1 bg-transparent px-2 font-mono text-xl font-bold text-slate-950 focus-visible:outline-none"
                  />
                  <Button size="sm" variant="ghost" onClick={() => setTendered(0)}>
                    Clear
                  </Button>
                </div>
                <dl className="mt-3 space-y-1.5 rounded-lg bg-white p-3 text-sm ring-1 ring-slate-200">
                  <div className="flex justify-between">
                    <dt className="text-slate-700">Payable net</dt>
                    <dd className="font-mono font-bold text-slate-950">{vnd(net)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-700">Tendered</dt>
                    <dd className="font-mono font-bold text-indigo-700">{vnd(tendered)}</dd>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-[#060f16] px-2 py-2">
                    <dt className="text-xs font-bold text-amber-500 uppercase">{change >= 0 ? 'Change to return' : 'Still due'}</dt>
                    <dd className={cn('font-mono text-lg font-bold', change >= 0 ? 'text-amber-500' : 'text-rose-700')}>{vnd(Math.abs(change))}</dd>
                  </div>
                </dl>
                <p className="mt-2 flex justify-between font-mono text-[11px] font-bold uppercase">
                  <span className="text-slate-700">Drawer #01: engaged</span>
                  <span className="text-amber-500">Vault sync: verified</span>
                </p>
              </div>
            </div>

            <form
              className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-4 py-3"
              onSubmit={(e) => {
                e.preventDefault()
                toast.success(`Receipt sent to ${phone}`, { description: 'Demo only: no SMS or Zalo message is sent.' })
              }}
            >
              <ReceiptText className="size-5 text-slate-500" aria-hidden />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-sm font-semibold text-slate-950 uppercase">Electronic tax invoice / receipt</p>
                <p className="text-xs text-slate-700">Forward PDF receipt directly to driver</p>
              </div>
              <label className="sr-only" htmlFor="receipt-phone">Driver phone</label>
              <Input id="receipt-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-48 font-mono" />
              <Button type="submit" variant="secondary" disabled={!phone.trim()}>
                <Send /> Send
              </Button>
            </form>
          </Panel>

          <Panel>
            <SectionTitle
              icon={<Lock />}
              aside={
                <span className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-700 uppercase">
                  <span className="size-1.5 rounded-full bg-indigo-400" aria-hidden /> Enforcer status: {cleared ? 'cleared' : 'ready'}
                </span>
              }
            >
              Direct hardware clearance controls
            </SectionTitle>
            {cleared ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-100 px-5 py-4 ring-1 ring-emerald-300">
                <p className="font-display text-lg font-bold text-emerald-800">Barrier raised • {c.plate} cleared to exit</p>
                <Button variant="success" onClick={reset}>
                  Next vehicle
                </Button>
              </div>
            ) : (
              <Button variant="gold" className="h-auto min-h-16 w-full rounded-xl py-3 font-display text-lg tracking-wide whitespace-normal uppercase" onClick={confirm}>
                <Lock className="size-5!" />
                <span className="font-mono">[Space]</span> Confirm payment &amp; lift barrier
                <ArrowUp className="size-5!" />
              </Button>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { key: 'F5', label: 'Cash override', run: () => cashRef.current?.focus() },
                { key: 'F8', label: 'Check gateway', run: checkGateway },
                { key: 'F9', label: waived ? 'Remove waiver' : 'Apply waiver', run: toggleWaiver },
                { key: 'ESC', label: 'Abort TXN', run: reset, danger: true },
              ].map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={a.run}
                  className={cn(
                    'rounded-lg px-2 py-2.5 text-center text-sm font-semibold transition-colors',
                    a.danger ? 'bg-rose-100 text-rose-800 hover:bg-rose-200' : 'bg-slate-50 text-slate-950 hover:bg-slate-100',
                  )}
                >
                  <span className={cn('block font-mono text-xs font-bold', a.danger ? 'text-rose-700' : 'text-amber-500')}>[{a.key}]</span>
                  {a.label}
                </button>
              ))}
            </div>
            <p className="mt-3 flex flex-wrap justify-between gap-2 rounded-lg bg-[#060f16] px-3 py-2 font-mono text-[11px] text-slate-700 uppercase">
              <span>
                Barrier position sensor: {cleared ? 'raised (90.0°)' : 'lowered (0.0°)'} <span className="text-indigo-700">• Safety interlock: active</span>
              </span>
              <span>Inductive loop #2: occupied by {c.plate}</span>
            </p>
          </Panel>
        </div>
      </div>
    </div>
  )
}
