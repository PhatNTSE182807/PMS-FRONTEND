import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Banknote, Car, Clock, CreditCard, DoorOpen, HandCoins, QrCode as QrIcon, ReceiptText, RefreshCw, Search, ShieldAlert, ShieldCheck, Undo2 } from 'lucide-react'
import { ApiError, getErrorMessage } from '@/api/apiError'
import { gateService } from '@/api/gate.service'
import { paymentService } from '@/api/payment.service'
import { Key, Panel, SectionTitle } from '@/components/features/staff/StaffBits'
import { CashTopUpDialog, CashTopUpStatusLine } from '@/components/features/staff/CashTopUp'
import { STAFF_TOAST } from '@/components/features/staff/staffToasts'
import { isTypingTarget } from '@/components/features/staff/staffKeys'
import { formatClock, formatMinutes, vnd } from '@/components/features/manager/managerFormat'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form-controls'
import { ConfirmDialog } from '@/components/ui/dialog'
import { QrCode } from '@/components/ui/qr-code'
import { useCancelPaymentRequest, usePayCash, usePayOnline, useQuote } from '@/hooks/useGate'
import { useNow } from '@/hooks/useNow'
import { useGateRequestQueue } from '@/hooks/useGateRequests'
import { useMyStaffLots } from '@/hooks/useParking'
import { useStaffLot } from '@/hooks/useStaffLot'
import { useCashDrawer } from '@/hooks/useCashDrawer'
import { queryKeys } from '@/api/queryKeys'
import { BANKNOTES, cleanNotes, describeNotes, notesTotal, smallNotesFor, suggestChange } from '@/lib/cashNotes'
import type { BanknoteCounts } from '@/types/cashDrawer.dto'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CheckoutQuoteDTO, PaymentDTO, PaymentProvider } from '@/types/operations.dto'


/**
 * Payment counter / exit lane POS (SRS FR-OPS-02, FR-PAY-01/03/07/08, UC-02): pick a vehicle waiting to pay
 * (or find one), request the fee
 * (deposit deducted, Exit Window checked), take cash after the Staff confirms the amounts (or show a VNPay/MoMo
 * QR). A paid vehicle then waits in the Check-out lane of the gate dashboard, where the barrier is opened
 * (team decision, 2026-11-04: never from the POS). Every payment is listed in the payment history below.
 * Keyboard: F5 cash, F8 check gateway, Esc next vehicle.
 */
export default function StaffCheckoutPage() {
  const myLots = useMyStaffLots()
  const { lot } = useStaffLot()
  const lotKey = lot?.id ?? myLots.data?.[0]?.id
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  // Only vehicles on their way out: the fee was requested (Force check-out at the gate dashboard, the lane or the
  // counter), or the driver asked in the app to leave and pay at the exit lane (bookings included). Vehicles still
  // parked are not listed; find one by plate to charge it anyway.
  const exitRequests = useGateRequestQueue(lotKey, 'CheckOut')
  const leavingIds = new Set((exitRequests.data ?? []).filter((r) => r.status === 'Waiting' && r.sessionId).map((r) => r.sessionId))
  const sessions = useQuery({
    queryKey: ['staff-waiting-payment', lotKey],
    queryFn: () => gateService.getSessions(lotKey!),
    enabled: Boolean(lotKey),
    refetchInterval: 5000,
  })
  const waiting = {
    ...sessions,
    // Paid vehicles are done here: they wait in the Check-out lane of the gate dashboard
    data: sessions.data
      ?.filter((s) => s.status === 'PendingPayment' || (s.status === 'Active' && leavingIds.has(s.id)))
      .sort((a, b) => Date.parse(a.entryTime) - Date.parse(b.entryTime)),
  }
  const [queueFilter, setQueueFilter] = useState('')
  const queue = (waiting.data ?? []).filter((s) =>
    (s.plateNumber ?? '').replace(/[^A-Z0-9]/gi, '').toUpperCase().includes(queueFilter.replace(/[^A-Z0-9]/gi, '').toUpperCase()),
  )
  const QUEUE_SHOWN = 8
  // Payments taken at the lot, cash only by default
  const [historyPlate, setHistoryPlate] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const [cashOnly, setCashOnly] = useState(true)
  const history = useQuery({
    queryKey: ['staff-payment-history', lotKey, historyPage, historyPlate, cashOnly],
    queryFn: () => gateService.getPayments(lotKey!, { page: historyPage, plate: historyPlate, method: cashOnly ? 'Cash' : undefined }),
    enabled: Boolean(lotKey),
    refetchInterval: 10000,
  })
  const [confirmCash, setConfirmCash] = useState(false)
  const [lookup, setLookup] = useState('')
  const [quote, setQuote] = useState<CheckoutQuoteDTO | null>(null)
  const [qr, setQr] = useState<PaymentDTO | null>(null)
  // Cash taken note by note (it feeds the Staff's drawer), or typed as an amount when the notes are not entered
  const [receivedNotes, setReceivedNotes] = useState<BanknoteCounts>({})
  const [typedAmount, setTypedAmount] = useState(0)
  const byNotes = notesTotal(receivedNotes) > 0
  const tendered = byNotes ? notesTotal(receivedNotes) : typedAmount
  const setTendered = (amount: number) => {
    setReceivedNotes({})
    setTypedAmount(amount)
  }
  const addNote = (value: number) => {
    setTypedAmount(0)
    setReceivedNotes((notes) => ({ ...notes, [value]: (notes[value] ?? 0) + 1 }))
  }
  const [exitPlate, setExitPlate] = useState('')
  const [searching, setSearching] = useState(false)
  const cashRef = useRef<HTMLInputElement>(null)
  const now = useNow(1000)

  const requestQuote = useQuote()
  const payCash = usePayCash()
  const payOnline = usePayOnline()
  const cancelRequest = useCancelPaymentRequest()

  const session = quote?.session
  const due = quote?.amountDue ?? 0
  const change = tendered - due
  // Change from what is in the drawer now, the notes just handed over included
  const drawer = useCashDrawer(lotKey)
  // A closed drawer's notes are no longer at hand: the next one starts empty
  const inDrawer: BanknoteCounts = { ...(drawer.data?.status === 'Open' ? drawer.data.expectedNotes : {}) }
  for (const [value, count] of Object.entries(receivedNotes)) inDrawer[Number(value)] = (inDrawer[Number(value)] ?? 0) + count
  const changeNotes = change > 0 ? suggestChange(change, inDrawer) : {}
  // A cash request the Manager has not decided yet (shown instead of asking again)
  const pendingTopUp = drawer.data?.topUps?.find((r) => r.status === 'Pending') ?? null
  const [askingCash, setAskingCash] = useState(false)
  const qrLeft = qr?.callbackDeadline ? Math.max(0, Math.ceil((Date.parse(qr.callbackDeadline) - now) / 1000)) : 0
  const blocking = quote?.alerts.filter((a) => a.blocking) ?? []

  /** Fee request for a session (moves it to "Chờ thanh toán", or to Paid when nothing is due). */
  const loadQuote = useCallback(
    (sessionId: number, plate?: string) =>
      requestQuote.mutate(
        { sessionId, plateNumber: plate || undefined },
        {
          onSuccess: (q) => {
            setQuote(q)
            // The vehicle now waits to pay: show it in the queue at once
            void queryClient.invalidateQueries({ queryKey: ['staff-waiting-payment'] })
            setQr(null)
            setTendered(0)
            if (q.amountDue > 0 && q.exitWindowLateFee > 0) toast.warning(STAFF_TOAST.graceExceeded)
          },
          onError: (e) => toast.error(getErrorMessage(e)),
        },
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the mutation object changes every render
    [],
  )

  // Opened from the gate dashboard: /staff/checkout?session=123
  const sessionParam = params.get('session')
  // The plate read at entry (passed by the gate dashboard, never in the URL), so the exit check starts filled in
  const plateParam = (useLocation().state as { plate?: string } | null)?.plate || null
  // Ask for the fee once per opened session (React runs effects twice in development)
  const openedSession = useRef<string | null>(null)
  useEffect(() => {
    if (!sessionParam) {
      openedSession.current = null
      return
    }
    if (openedSession.current === sessionParam) return
    openedSession.current = sessionParam
    if (plateParam) setExitPlate(plateParam)
    loadQuote(Number(sessionParam), plateParam ?? undefined)
  }, [sessionParam, plateParam, loadQuote])

  const find = async (event: FormEvent) => {
    event.preventDefault()
    if (!lotKey || !lookup.trim()) return
    setSearching(true)
    try {
      const value = lookup.trim()
      const found = await gateService.lookup(lotKey, /^SS/i.test(value) ? { code: value.toUpperCase() } : { plate: value })
      setExitPlate(found.hasPlate ? found.plateNumber : '')
      setParams({ session: String(found.id) })
      toast.success(STAFF_TOAST.ticketLoaded)
    } catch (e) {
      toast.error(e instanceof ApiError && e.status === 404 ? STAFF_TOAST.vehicleNotFound : getErrorMessage(e))
    } finally {
      setSearching(false)
    }
  }

  const reset = useCallback(() => {
    setQuote(null)
    setQr(null)
    setTendered(0)
    setLookup('')
    setExitPlate('')
    setParams({})
  }, [setParams])

  /** Runs after the Staff confirms the amounts: records the cash payment, which then shows in the payment history. */
  const takeCash = () => {
    if (!session) return
    payCash.mutate(
      {
        sessionId: session.id,
        amount: tendered,
        // Note by note only when the change can be given from the drawer; otherwise the amount alone is recorded
        received: byNotes && changeNotes ? cleanNotes(receivedNotes) : undefined,
        change: byNotes && changeNotes ? cleanNotes(changeNotes) : undefined,
      },
      {
        onSuccess: (p) => {
          setConfirmCash(false)
          toast.success(`Cash ${vnd(p.amount)} recorded`, {
            description: change > 0 ? `Give back ${vnd(change)}${changeNotes && describeNotes(changeNotes) ? `: ${describeNotes(changeNotes)}` : ''}.` : undefined,
          })
          void queryClient.invalidateQueries({ queryKey: queryKeys.cashDrawer.all })
          void queryClient.invalidateQueries({ queryKey: ['staff-payment-history'] })
          void queryClient.invalidateQueries({ queryKey: ['staff-waiting-payment'] })
          loadQuote(session.id, exitPlate)
        },
        onError: (e) => {
          setConfirmCash(false)
          toast.error(getErrorMessage(e))
        },
      },
    )
  }

  /** Opens a vehicle from the "waiting for payment" list. */
  const openWaiting = (id: number, plate: string | null) => {
    setExitPlate(plate ?? '')
    setParams({ session: String(id) })
  }

  const showQr = (provider: PaymentProvider) => {
    if (!session) return
    payOnline.mutate(
      { sessionId: session.id, provider },
      {
        onSuccess: (p) => {
          if (!p.payUrl) {
            toast.success(`Paid ${vnd(p.amount)} via XXIV Wallet!`)
            loadQuote(session.id, exitPlate)
          } else {
            setQr(p)
          }
        },
        onError: (e) => toast.error(getErrorMessage(e)),
      },
    )
  }

  /** FR-PAY-08: ask the gateway whether the guest's QR payment went through. */
  const checkGateway = useCallback(async () => {
    if (!qr || !session) return
    try {
      const result = await paymentService.check(qr.id)
      if (result.outcome === 'Applied' || result.outcome === 'AlreadyProcessed') {
        toast.success(`${qr.provider}: payment received`)
        loadQuote(session.id, exitPlate)
      } else if (result.outcome === 'Refunded') {
        toast.info('The QR payment came after another payment and was refunded automatically.')
        loadQuote(session.id, exitPlate)
      } else {
        toast.info(result.message ?? 'Still waiting for the gateway.', { description: qrLeft === 0 ? 'You may take cash instead.' : undefined })
      }
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }, [exitPlate, loadQuote, qr, qrLeft, session])

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
        void checkGateway()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [checkGateway, reset])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-slate-50 px-4 py-3 text-xs font-semibold tracking-wider text-slate-700 uppercase">
        <span className="text-slate-950">Payment counter POS</span>
        {session && <span className="font-mono text-amber-500">Session #{session.code}</span>}
        <span className="flex items-center gap-1.5 text-indigo-700">
          <ShieldCheck className="size-4" aria-hidden /> Entry/exit plate check active
        </span>
        <Link to="/staff/gate?lane=checkout" className="ml-auto flex items-center gap-1.5 text-indigo-700 hover:underline">
          <DoorOpen className="size-4" aria-hidden /> Barrier: Check-out lane
        </Link>
      </div>

      <Panel>
        <form className="flex flex-wrap items-center gap-3" onSubmit={find}>
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Plate or session code</span>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-500" aria-hidden />
            <Input value={lookup} onChange={(e) => setLookup(e.target.value.toUpperCase())} placeholder="Plate read at the exit, or session code (SS…)" className="pl-8 font-mono uppercase" />
          </label>
          <Button type="submit" disabled={!lotKey || searching || !lookup.trim()}>
            <Search /> Find vehicle
          </Button>
        </form>
      </Panel>

      <Panel>
        <SectionTitle
          icon={<Clock />}
          aside={
            waiting.data && (
              <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-500">
                {waiting.data.filter((s) => s.status === 'PendingPayment').length} fee requested · {waiting.data.filter((s) => leavingIds.has(s.id)).length} asked to exit
              </span>
            )
          }
        >
          Vehicles to collect from
        </SectionTitle>
        {!lotKey && <p className="text-sm text-slate-700">No assigned parking lot is available.</p>}
        {lotKey && waiting.isLoading && <p className="text-sm text-slate-700">Loading…</p>}
        {waiting.isError && <p className="text-sm text-rose-700">Unable to load the queue: {getErrorMessage(waiting.error)}</p>}
        {waiting.data && waiting.data.length > 0 && (
          <>
            <label className="sr-only" htmlFor="queue-filter">Filter by plate</label>
            <Input id="queue-filter" className="mb-2" value={queueFilter} onChange={(e) => setQueueFilter(e.target.value)} placeholder="Filter by plate" />
          </>
        )}
        {waiting.data && queue.length === 0 && (
          <p className="text-sm text-slate-700">{waiting.data.length === 0 ? 'No vehicle is waiting to pay. Use Force check-out on the gate dashboard, or find a vehicle by plate.' : 'No vehicle matches this plate.'}</p>
        )}
        {queue.length > 0 && (
          <ul className="divide-y divide-slate-200">
            {queue.slice(0, QUEUE_SHOWN).map((s) => (
              <li key={s.id} className={cn('flex flex-wrap items-center gap-x-6 gap-y-1 py-3', session?.id === s.id && 'bg-amber-50/40')}>
                <span className="w-36 font-mono text-lg font-bold text-slate-950">{s.plateNumber || 'NO PLATE'}</span>
                <span className={cn('rounded px-2 py-0.5 text-xs font-bold', s.status === 'PendingPayment' ? 'bg-amber-50 text-amber-500' : 'bg-slate-50 text-slate-700')}>
                  {s.status === 'PendingPayment' ? 'Fee requested' : 'Asked to exit'}
                </span>
                <span className="font-mono text-xs text-slate-700">{s.code}</span>
                <span className="text-sm text-slate-700">{s.vehicleTypeName}</span>
                <span className="text-sm text-slate-700">In since {formatClock(Date.parse(s.entryTime))}</span>
                <Button size="sm" className="ml-auto" variant={session?.id === s.id ? 'secondary' : 'default'} onClick={() => openWaiting(s.id, s.plateNumber)}>
                  <Banknote /> {session?.id === s.id ? 'Open' : 'Collect payment'}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {queue.length > QUEUE_SHOWN && (
          <p className="mt-2 text-xs text-slate-700">{queue.length - QUEUE_SHOWN} more: filter by plate to find them.</p>
        )}
      </Panel>

      {!session ? (
        <Panel>
          <p className="py-10 text-center text-slate-700">
            {requestQuote.isPending ? 'Calculating the fee…' : 'Find a vehicle by plate or session code, or open one from the gate dashboard.'}
          </p>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {/* Left column: vehicle and fee */}
          <div className="space-y-6">
            <Panel>
              <SectionTitle icon={<Car />} aside={<span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700 uppercase">{session.status}</span>}>
                Vehicle
              </SectionTitle>
              <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl bg-[#060f16] p-5 ring-1 ring-slate-200">
                <div>
                  <p className="text-xs font-bold tracking-wider text-slate-700 uppercase">Entry plate</p>
                  <p className="mt-1 font-mono text-4xl font-bold tracking-[0.12em] text-slate-950">{session.plateNumber || 'NO PLATE'}</p>
                  <p className="mt-1 text-sm text-amber-500">
                    {session.vehicleTypeName} • {session.sessionType === 'Reservation' ? `Reservation ${session.reservationCode}` : session.sessionType ?? 'Walk-in'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold tracking-wider text-slate-700 uppercase">Bay / zone</p>
                  <p className="font-mono text-xl font-bold text-slate-950">{session.slotCode ?? session.zoneName ?? '—'}</p>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 py-2">
                  <dt className="text-xs font-bold text-slate-700 uppercase">Check-in</dt>
                  <dd className="font-mono font-bold text-slate-950">{formatClock(Date.parse(session.entryTime))}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 py-2">
                  <dt className="text-xs font-bold text-slate-700 uppercase">Now</dt>
                  <dd className="font-mono font-bold text-slate-950">{formatClock(now)}</dd>
                </div>
                <div className="rounded-lg bg-amber-50 py-2">
                  <dt className="text-xs font-bold text-amber-500 uppercase">Dwell</dt>
                  <dd className="font-mono font-bold text-amber-500">{formatMinutes(quote.durationMinutes)}</dd>
                </div>
              </dl>
              <div className="mt-4 space-y-2">
                <label className="block text-xs font-bold tracking-wider text-slate-700 uppercase" htmlFor="exit-plate">Plate read at the exit</label>
                <div className="flex gap-2">
                  <Input id="exit-plate" value={exitPlate} onChange={(e) => setExitPlate(e.target.value.toUpperCase())} className="font-mono uppercase" />
                  <Button variant="secondary" onClick={() => loadQuote(session.id, exitPlate)} disabled={requestQuote.isPending}>
                    <RefreshCw /> Recheck
                  </Button>
                </div>
              </div>
            </Panel>

            <Panel>
              <SectionTitle icon={<ReceiptText />} aside={<span className="font-mono text-xs text-slate-700">{quote.pricingRuleId ? `Rule #${quote.pricingRuleId} v${quote.pricingRuleVersion}` : 'Default tariff'}</span>}>
                Fee breakdown
              </SectionTitle>
              <ul className="divide-y divide-slate-200">
                {quote.days.map((d) => (
                  <li key={d.date} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="font-medium text-slate-950">{d.date}</p>
                      <p className="text-sm text-slate-700">{formatMinutes(d.minutes)} • {d.blocks} block{d.blocks === 1 ? '' : 's'}{d.capped ? ' • daily cap' : ''}</p>
                    </div>
                    <span className="font-mono text-sm font-bold text-slate-950">{vnd(d.amount)}</span>
                  </li>
                ))}
                {quote.days.length === 0 && (
                  <li className="py-3 text-sm text-slate-700">{quote.zeroFeeReason === 'Whitelist' ? 'Whitelisted plate: free of charge.' : 'No parking fee for this stay.'}</li>
                )}
                <FeeLine label="Parking fee" value={quote.fee} />
                {quote.lostTicketFee > 0 && <FeeLine label="Lost ticket fine" value={quote.lostTicketFee} />}
                {quote.exitWindowLateFee > 0 && <FeeLine label="Exit window missed" value={quote.exitWindowLateFee} />}
                {quote.depositApplied > 0 && <FeeLine label="Reservation deposit" value={-quote.depositApplied} tone="text-indigo-700" />}
                {quote.alreadyPaid > 0 && <FeeLine label="Already paid" value={-quote.alreadyPaid} tone="text-indigo-700" />}
              </ul>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[#060f16] p-5 ring-1 ring-slate-200">
                <div>
                  <p className="text-xs font-bold tracking-wider text-amber-500 uppercase">Amount due</p>
                  <p className="text-sm text-slate-700">
                    {quote.depositRefund > 0 ? `${vnd(quote.depositRefund)} of the deposit is refunded at exit` : session.status === 'Paid' ? 'Settled' : 'Ready for payment'}
                  </p>
                </div>
                <p className="font-mono text-4xl font-bold text-amber-500">{vnd(due)}</p>
              </div>
            </Panel>
          </div>

          {/* Right column: payment and barrier */}
          <div className="space-y-6">
            <Panel>
              <SectionTitle icon={<Banknote />}>Payment</SectionTitle>
              {due === 0 ? (
                <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
                  Nothing to collect{quote.zeroFeeReason ? ` (${quote.zeroFeeReason})` : ''}: the vehicle goes to the Check-out lane.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="flex flex-col items-center rounded-xl bg-slate-50 p-4">
                    <div className="flex w-full items-center justify-between text-xs font-bold">
                      <span className="rounded bg-indigo-100 px-2 py-0.5 text-indigo-700 uppercase">{qr?.provider ?? 'Dynamic QR'}</span>
                      {qr && <span className={cn('font-mono', qrLeft > 0 ? 'text-indigo-700' : 'text-rose-700')}>{qrLeft > 0 ? `${qrLeft}s wait` : 'Switch allowed'}</span>}
                    </div>
                    {qr?.payUrl ? (
                      <>
                        <QrCode value={qr.payUrl} label={`${qr.provider} payment QR`} className="mt-4 w-44 ring-1 ring-slate-200" />
                        <a href={qr.payUrl} target="_blank" rel="noreferrer" className="mt-2 text-xs font-semibold text-indigo-700 underline">Open payment page</a>
                        <Button size="sm" variant="secondary" className="mt-3" onClick={() => void checkGateway()}>
                          <RefreshCw /> Check gateway (F8)
                        </Button>
                      </>
                    ) : (
                      <div className="mt-4 grid w-full gap-2">
                        {/* The wallet can only be charged when the session belongs to a customer account */}
                        {session.isCustomerAccount && (
                          <Button className="bg-[#059669] text-white hover:bg-[#047857]" disabled={payOnline.isPending} onClick={() => showQr('Wallet')}>
                            <CreditCard /> Charge XXIV Wallet
                          </Button>
                        )}
                        <Button variant="gold" disabled={payOnline.isPending} onClick={() => showQr('VNPay')}>
                          <QrIcon /> VNPay QR
                        </Button>
                        <Button className="bg-[#a50064] text-white hover:bg-[#c2187a]" disabled={payOnline.isPending} onClick={() => showQr('MoMo')}>
                          <QrIcon /> MoMo QR
                        </Button>
                        <p className="text-center text-xs text-slate-700">The guest scans it with their banking or MoMo app.</p>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-display text-lg font-bold text-slate-950 uppercase">Cash</p>
                      <Key>F5</Key>
                    </div>
                    <p className="mt-3 text-xs font-bold tracking-wider text-slate-700 uppercase">Notes handed over</p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {BANKNOTES.slice(0, 6).map((note) => (
                        <button
                          key={note}
                          type="button"
                          onClick={() => addNote(note)}
                          className={cn('relative rounded-lg py-2 font-mono text-sm font-bold ring-1 transition-colors', receivedNotes[note] ? 'bg-[#124e66] text-indigo-800 ring-indigo-300' : 'bg-white text-slate-950 ring-slate-200 hover:bg-slate-100')}
                        >
                          {formatNumber(note / 1000)}k
                          {receivedNotes[note] ? <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-amber-500 text-[11px] text-slate-950">{receivedNotes[note]}</span> : null}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="secondary" className="flex-1" onClick={() => setReceivedNotes(suggestChange(due, Object.fromEntries(BANKNOTES.map((v) => [v, 999]))) ?? {})}>
                        Exact {formatNumber(due)}
                      </Button>
                      <Button size="sm" variant="ghost" disabled={!tendered} onClick={() => setTendered(0)}>
                        Clear
                      </Button>
                    </div>
                    <label htmlFor="cash-received" className="mt-4 block text-xs font-bold tracking-wider text-slate-700 uppercase">Cash received (VND)</label>
                    <input
                      id="cash-received"
                      ref={cashRef}
                      inputMode="numeric"
                      value={tendered ? formatNumber(tendered) : ''}
                      placeholder="0"
                      onChange={(e) => setTendered(Number(e.target.value.replace(/\D/g, '')) || 0)}
                      className="mt-2 w-full rounded-lg bg-[#060f16] px-3 py-2 font-mono text-xl font-bold text-slate-950 ring-1 ring-slate-200 focus-visible:outline-none"
                    />
                    <p className="mt-2 flex justify-between text-sm">
                      <span className="text-slate-700">{change >= 0 ? 'Change' : 'Still due'}</span>
                      <span className={cn('font-mono font-bold', change >= 0 ? 'text-amber-500' : 'text-rose-700')}>{vnd(Math.abs(change))}</span>
                    </p>
                    {change > 0 && (
                      <p className={cn('mt-1 text-xs', changeNotes ? 'text-slate-700' : 'text-rose-700')}>
                        {changeNotes
                          ? `Give back: ${describeNotes(changeNotes)}`
                          : 'The drawer has no notes for this change: give it from elsewhere, the amount is still recorded.'}
                      </p>
                    )}
                    {/* Out of notes for change: ask the Manager for small notes (once at a time) */}
                    {lotKey && pendingTopUp ? (
                      <div className="mt-2">
                        <CashTopUpStatusLine lotId={lotKey} request={pendingTopUp} />
                      </div>
                    ) : (
                      lotKey && change > 0 && !changeNotes && (
                        <Button size="sm" variant="secondary" className="mt-2 w-full" onClick={() => setAskingCash(true)}>
                          <HandCoins /> Ask the Manager for notes
                        </Button>
                      )
                    )}
                    {lotKey && askingCash && (
                      <CashTopUpDialog
                        lotId={lotKey}
                        open={askingCash}
                        onOpenChange={setAskingCash}
                        initialNotes={smallNotesFor(Math.max(change, 100_000))}
                        initialReason={`Out of notes to give ${vnd(change)} change`}
                      />
                    )}
                    <p className="mt-1 text-xs text-slate-600">
                      {drawer.data?.status === 'Open'
                        ? `Drawer ${drawer.data.closeNo} is open. Typing an amount instead of tapping notes keeps them out of the drawer count.`
                        : 'No cash drawer open: one opens with this payment.'}
                    </p>
                    <Button className="mt-3 w-full" disabled={tendered < due || payCash.isPending} onClick={() => setConfirmCash(true)}>
                      <Banknote /> Take cash
                    </Button>
                  </div>
                </div>
              )}
              {session.status === 'PendingPayment' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  onClick={() => cancelRequest.mutate(session.id, { onSuccess: () => { toast.info('Payment request cancelled: the vehicle stays parked.'); reset() } })}
                >
                  <Undo2 /> Customer backed up (cancel payment)
                </Button>
              )}
            </Panel>

            {/* The barrier is opened from the Check-out lane of the gate dashboard, never from here */}
            <Panel>
              <SectionTitle icon={<DoorOpen />}>Exit</SectionTitle>
              {blocking.length > 0 && (
                <div className="mb-3 space-y-2 rounded-xl bg-rose-50 p-3 ring-1 ring-rose-200">
                  {blocking.map((a) => (
                    <p key={a.code} className="flex items-start gap-2 text-sm text-rose-800">
                      <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {a.message}
                    </p>
                  ))}
                  <p className="text-xs text-slate-700">The Staff at the Check-out lane sees this too and checks it before opening the barrier.</p>
                </div>
              )}
              {session.status === 'Paid' ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-100 px-5 py-4 ring-1 ring-emerald-300">
                  <p className="font-display text-lg font-bold text-emerald-800">
                    Paid • {session.plateNumber || session.code} moved to the Check-out lane
                    {quote.depositRefund > 0 ? ` • refund ${vnd(quote.depositRefund)} at exit` : ''}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" asChild>
                      <Link to="/staff/gate?lane=checkout">
                        <DoorOpen /> Open the Check-out lane
                      </Link>
                    </Button>
                    <Button variant="success" onClick={reset}>Next vehicle</Button>
                  </div>
                </div>
              ) : (
                <p className="rounded-xl bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-900">
                  Collect {vnd(due)} first. Once paid, the vehicle moves to the Check-out lane of the gate dashboard, where the barrier is opened.
                </p>
              )}
            </Panel>
          </div>
        </div>
      )}

      <Panel>
        <SectionTitle
          icon={<ReceiptText />}
          aside={
            <div className="flex rounded-lg bg-slate-50 p-0.5 text-xs font-bold" role="group" aria-label="Payment method">
              {[true, false].map((cash) => (
                <button
                  key={String(cash)}
                  type="button"
                  aria-pressed={cashOnly === cash}
                  onClick={() => { setCashOnly(cash); setHistoryPage(1) }}
                  className={cn('rounded-md px-3 py-1', cashOnly === cash ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-700')}
                >
                  {cash ? 'Cash' : 'All methods'}
                </button>
              ))}
            </div>
          }
        >
          Payment history
        </SectionTitle>
        <label className="sr-only" htmlFor="history-plate">Search by plate</label>
        <Input id="history-plate" value={historyPlate} onChange={(e) => { setHistoryPlate(e.target.value); setHistoryPage(1) }} placeholder="Search by plate" />
        {lotKey && history.isLoading && <p className="mt-3 text-sm text-slate-700">Loading payments…</p>}
        {history.isError && <p className="mt-3 text-sm text-rose-700">Unable to load payments: {getErrorMessage(history.error)}</p>}
        {history.data && history.data.items.length === 0 && <p className="mt-3 text-sm text-slate-700">No payments yet.</p>}
        {history.data && history.data.items.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs font-bold tracking-wider text-slate-700 uppercase">
                <tr><th className="py-2">Paid at</th><th>Plate</th><th>Session</th><th>Method</th><th className="text-right">Amount</th><th className="pl-6">Collected by</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {history.data.items.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 font-mono">{p.paidAt ? new Date(p.paidAt).toLocaleString() : '—'}</td>
                    <td className="font-mono font-bold text-slate-950">{p.plateNumber || 'No plate'}</td>
                    <td className="font-mono text-xs">{p.sessionCode ?? '—'}</td>
                    <td>{p.method}{p.channel === 'Kiosk' ? ' · counter' : p.channel === 'Lane' ? ' · lane' : p.channel === 'App' ? ' · app' : ''}{p.status !== 'Succeeded' ? ` · ${p.status}` : ''}</td>
                    <td className="text-right font-mono font-bold text-slate-950">{vnd(p.amount)}</td>
                    <td className="pl-6">{p.collectedByName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {history.data && history.data.totalCount > 0 && (
          <div className="mt-3 flex items-center gap-3 text-sm">
            <Button variant="secondary" size="sm" disabled={historyPage <= 1} onClick={() => setHistoryPage((page) => page - 1)}>Previous</Button>
            <span>Page {historyPage} · {history.data.totalCount} payments</span>
            <Button variant="secondary" size="sm" disabled={historyPage * history.data.pageSize >= history.data.totalCount} onClick={() => setHistoryPage((page) => page + 1)}>Next</Button>
          </div>
        )}
      </Panel>

      {session && (
        <ConfirmDialog
          open={confirmCash}
          onOpenChange={setConfirmCash}
          title="Confirm cash payment"
          confirmLabel={payCash.isPending ? 'Recording…' : 'Confirm payment'}
          pending={payCash.isPending}
          onConfirm={takeCash}
          description={
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between"><dt>Vehicle</dt><dd className="font-mono font-bold">{session.plateNumber || 'No plate'} · {session.code}</dd></div>
              <div className="flex justify-between"><dt>Amount due</dt><dd className="font-mono font-bold">{vnd(due)}</dd></div>
              <div className="flex justify-between"><dt>Cash received</dt><dd className="font-mono font-bold">{vnd(tendered)}</dd></div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5"><dt>Change to give back</dt><dd className="font-mono font-bold">{vnd(Math.max(0, change))}</dd></div>
              {byNotes && <div className="flex justify-between"><dt>Notes received</dt><dd className="font-mono">{describeNotes(receivedNotes)}</dd></div>}
              {change > 0 && changeNotes && describeNotes(changeNotes) && <div className="flex justify-between"><dt>Notes to give back</dt><dd className="font-mono">{describeNotes(changeNotes)}</dd></div>}
            </dl>
          }
        />
      )}
    </div>
  )
}

function FeeLine({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <span className={cn('font-medium text-slate-950', tone)}>{label}</span>
      <span className={cn('font-mono text-sm font-bold text-slate-950', tone)}>{value < 0 ? `−${vnd(-value)}` : vnd(value)}</span>
    </li>
  )
}
