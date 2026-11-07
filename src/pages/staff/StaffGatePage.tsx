import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  BadgeCheck,
  Car,
  CircleCheck,
  DoorOpen,
  LogIn,
  LogOut,
  Search,
  ShieldCheck,
  TriangleAlert,
  Video,
  Wallet,
  TicketX
} from 'lucide-react'
import { LiveLotModel } from '@/components/features/lots/LiveLotModel'
import { GateLaneCameras } from '@/components/features/staff/GateLaneCameras'
import { GateLanesPanel } from '@/components/features/staff/GateLanesPanel'
import { Metric, Panel, Plate, SectionTitle, StatTile } from '@/components/features/staff/StaffBits'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form-controls'
import { Skeleton } from '@/components/ui/skeleton'
import { useGateExits, useGateHistory, useLotPayments, useOpenSessions, useZoneCounters } from '@/hooks/useGate'
import { useGateRequestQueue } from '@/hooks/useGateRequests'
import { useCapacitySimulation, useMyStaffLots } from '@/hooks/useParking'
import { useStaffLot } from '@/hooks/useStaffLot'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { LostTicketPapersDialog, type LostTicketVehicle } from '@/components/features/staff/LostTicketPapersDialog'
import { demoGateStats, demoStation } from '@/mocks/staffOps.mock'
import type { ParkingSessionDTO, StaffPaymentHistoryPageDTO, ZoneCounterDTO } from '@/types/operations.dto'

const clockWithSeconds = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function CapacityRing({ percent }: { percent: number }) {
  const r = 18
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 44 44" className="size-14 -rotate-90" role="img" aria-label={`${percent}% of bays occupied`}>
      <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" className="stroke-slate-200" />
      <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" strokeLinecap="round" className="stroke-amber-500" strokeDasharray={`${(c * percent) / 100} ${c}`} />
      <text x="22" y="22" dy="0.35em" textAnchor="middle" className="rotate-90 fill-slate-950 font-mono text-[10px] font-bold" style={{ transformOrigin: 'center' }}>
        {percent}%
      </text>
    </svg>
  )
}

function KpiRow({
  counters,
  sessions,
  history,
  payments,
}: {
  counters: ZoneCounterDTO[] | undefined
  sessions: ParkingSessionDTO[] | undefined
  history: { items: ParkingSessionDTO[]; totalCount: number } | undefined
  payments: StaffPaymentHistoryPageDTO | undefined
}) {
  const s = demoGateStats
  // Live Zone Counters when the lot has them; the demo figures otherwise
  const total = counters?.length ? counters.reduce((sum, c) => sum + c.totalCapacity, 0) : s.totalBays
  const free = counters?.length ? counters.reduce((sum, c) => sum + c.availableSpaces, 0) : s.generalOpen
  const active = total - free
  const reserved = sessions ? sessions.filter((x) => x.sessionType === 'Reservation').length : s.reservedVip
  const occupancy = total ? Math.round((active / total) * 100) : 0

  // Calculate Throughput today from real history and open sessions (with fallback to demo stats)
  const throughputToday = useMemo(() => {
    if (!history && !sessions) return s.throughputToday
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const startMs = startOfToday.getTime()

    const openToday = sessions?.filter((e) => new Date(e.entryTime).getTime() >= startMs).length ?? 0
    const closedToday = history?.items?.filter((e) => new Date(e.entryTime).getTime() >= startMs).length ?? 0
    const todayTotal = openToday + closedToday
    return todayTotal > 0 ? todayTotal : (history?.totalCount ?? s.throughputToday)
  }, [history, sessions, s.throughputToday])

  // Calculate Cash in drawer from real payments (with fallback to demo stats)
  const cashInDrawer = useMemo(() => {
    if (!payments) return s.cashInDrawer
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const startMs = startOfToday.getTime()

    const todayCash = payments.items
      .filter((p) => p.status === 'Succeeded' && p.method === 'Cash' && (!p.paidAt || new Date(p.paidAt).getTime() >= startMs))
      .reduce((sum, p) => sum + p.amount, 0)

    if (todayCash > 0) return todayCash
    if (payments.items.length > 0) {
      // Sum recent cash drawer payments if none recorded today yet
      const recentDrawer = payments.items
        .filter((p) => p.status === 'Succeeded' && p.method === 'Cash')
        .slice(0, 20)
        .reduce((sum, p) => sum + p.amount, 0)
      if (recentDrawer > 0) return recentDrawer
    }
    return 0
  }, [payments, s.cashInDrawer])

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatTile label="Throughput today" icon={<Car />}>
        <Metric value={formatNumber(throughputToday)} />
        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-700">
          <CircleCheck className="size-4 text-emerald-600" aria-hidden /> Zero toll violations
          <span className="ml-auto font-mono text-xs font-bold text-emerald-700">+{s.throughputTrend}%</span>
        </p>
      </StatTile>
      <StatTile label="Facility capacity" className="ring-amber-300/40">
        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            <Metric value={active} unit={`/ ${total}`} className="mt-0" />
            <p className="mt-1 text-sm text-amber-500">Spaces taken or held</p>
          </div>
          <CapacityRing percent={occupancy} />
        </div>
      </StatTile>
      <StatTile label="General open" icon={<DoorOpen />}>
        <Metric value={free} unit="free" className="text-indigo-700" />
        <p className="mt-1 text-sm text-slate-700">
          {counters?.length ? counters.map((c) => `${c.zoneCode} ${c.availableSpaces}`).join(' • ') : 'Levels B1, B2, B3 active'}
        </p>
      </StatTile>
      <StatTile label="Pre-booked inside" icon={<ShieldCheck />}>
        <Metric value={reserved} unit="reserved" className="text-amber-500" />
        <p className="mt-1 text-sm text-slate-700">Checked in on a reservation</p>
      </StatTile>
      <StatTile label="Cash in drawer" icon={<Wallet />}>
        <Metric value={formatNumber(cashInDrawer)} unit="VND" />
        <p className="mt-1 text-sm text-slate-700">Synced with cash vault module</p>
      </StatTile>
    </div>
  )
}

function AnprTelemetry({
  sessions,
  exits,
}: {
  sessions: ParkingSessionDTO[] | undefined
  /** The vehicles that left last, by exit time (the exit lane cameras). */
  exits: ParkingSessionDTO[] | undefined
}) {
  return (
    <Panel>
      <SectionTitle
        icon={<Video />}
      >
        Live optical ANPR telemetry
      </SectionTitle>
      <GateLaneCameras sessions={sessions} history={exits} />
    </Panel>
  )
}

const SESSION_TONE: Record<string, string> = {
  PendingEntry: 'bg-amber-100 text-amber-700',
  Active: 'bg-indigo-100 text-indigo-700',
  PendingPayment: 'bg-rose-100 text-rose-700',
  Paid: 'bg-emerald-100 text-emerald-700',
  LostTicketPending: 'bg-rose-100 text-rose-700',
}

/** Vehicles inside the lot (or entering), live from the gate API; refreshed by SignalR or polling. */
function ActivityStream({ sessions, isLoading, query, setQuery }: { sessions: ParkingSessionDTO[]; isLoading: boolean; query: string; setQuery: (q: string) => void }) {
  const [lostVehicle, setLostVehicle] = useState<LostTicketVehicle | null>(null)
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    if (!q) return sessions
    return sessions.filter((e) => `${e.plateNumber}${e.code}`.toLowerCase().replace(/[^a-z0-9]/g, '').includes(q))
  }, [query, sessions])

  return (
    <Panel>
      <SectionTitle
        aside={
          <label className="relative">
            <span className="sr-only">Lookup plate</span>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-500" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Lookup plate…" className="w-52 pl-8 font-mono uppercase" />
          </label>
        }
      >
        Vehicles in the lot
      </SectionTitle>
      <p className="-mt-3 mb-4 text-sm text-slate-700">Open parking sessions: entering, parked, paying or paid and on the way out.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-bold tracking-wider text-slate-700 uppercase">
              <th className="rounded-l-lg px-4 py-3">Entered</th>
              <th className="px-4 py-3">Vehicle plate</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Access</th>
              <th className="px-4 py-3">Bay / zone</th>
              <th className="px-4 py-3">Status</th>
              <th className="rounded-r-lg px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs font-bold text-slate-900">{clockWithSeconds.format(Date.parse(e.entryTime))}</td>
                <td className="px-4 py-3"><Plate>{e.plateNumber || 'NO PLATE'}</Plate></td>
                <td className="px-4 py-3 text-slate-950">{e.vehicleTypeName ?? '—'}</td>
                <td className={cn('px-4 py-3 text-xs font-semibold', e.sessionType === 'Reservation' ? 'text-amber-500' : 'text-slate-900')}>
                  {e.sessionType === 'Reservation' ? `Reservation ${e.reservationCode ?? ''}` : e.sessionType === 'Whitelist' ? 'Whitelist (free)' : 'Walk-in'}
                  {e.isOverdue && <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-rose-700">Overdue</span>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-900">
                  {e.slotCode ? (
                    <>
                      <span className="font-mono text-sm font-bold text-slate-950">Bay {e.slotCode}</span>
                      {e.zoneName && <span className="block text-slate-600">{e.zoneName}</span>}
                    </>
                  ) : (
                    // A walk-in the lane did not give a bay: only its zone counter knows it
                    <span className="font-mono">{e.zoneName ?? '—'}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={cn('rounded px-2 py-0.5 text-xs font-bold tracking-wide uppercase', SESSION_TONE[e.status] ?? 'bg-slate-100 text-slate-800')}>{e.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                  {e.sessionType !== 'Reservation' && (e.status === 'Active' || e.status === 'PendingPayment') && (!e.isLostTicket || e.lostTicketStatus === 'Rejected') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      title="The driver lost the paper ticket: upload the Citizen ID and registration certificate"
                      onClick={() => setLostVehicle({ sessionId: e.id, plate: e.hasPlate ? e.plateNumber : '', vehicleTypeName: e.vehicleTypeName, code: e.code })}
                    >
                      <TicketX /> Lost ticket
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" asChild title="Ask for the fee now and open this vehicle on the checkout screen">
                    <Link to={`/staff/checkout?session=${e.id}`} state={{ plate: e.hasPlate ? e.plateNumber : '' }}>
                      <LogOut /> Force check-out
                    </Link>
                  </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-700">
                  {query ? `No vehicle matches “${query}”.` : 'No vehicle is in the lot.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <LostTicketPapersDialog vehicle={lostVehicle} onClose={() => setLostVehicle(null)} />
    </Panel>
  )
}

export default function StaffGatePage() {
  // /staff/gate?lane=checkout (from the POS after a payment) opens the Check-out lane
  const lane = useSearchParams()[0].get('lane')
  const myLots = useMyStaffLots()
  const { lot } = useStaffLot()
  const [lotId, setLotId] = useState<string>()
  useCapacitySimulation(true)
  const [query, setQuery] = useState('')
  const lotKey = lotId ?? lot?.id ?? myLots.data?.[0]?.id
  const sessions = useOpenSessions(lotKey)
  const counters = useZoneCounters(lotKey)
  const history = useGateHistory(lotKey, 1, 50)
  const exits = useGateExits(lotKey)
  const cashPayments = useLotPayments(lotKey, 'Cash', 50)
  const checkIns = useGateRequestQueue(lotKey, 'CheckIn')
  const checkOuts = useGateRequestQueue(lotKey, 'CheckOut')

  // Real incidents detected from live open sessions and app gate requests
  const incidentCount = useMemo(() => {
    let count = 0
    if (sessions.data) {
      count += sessions.data.filter((s) => s.isLostTicket || s.lostTicketStatus === 'Pending' || s.isOverdue || s.plateMismatch).length
    }
    count += (checkIns.data?.length ?? 0) + (checkOuts.data?.length ?? 0)
    return count
  }, [sessions.data, checkIns.data, checkOuts.data])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-slate-700 uppercase">
            <BadgeCheck className="size-4 text-indigo-700" aria-hidden /> {myLots.data?.find((l) => l.id === lotKey)?.name ?? demoStation.station}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-950">Gate operations dashboard</h1>
        </div>
        {incidentCount > 0 && (
          <Button variant="outline" asChild>
            <Link to="/staff/exceptions">
              <TriangleAlert className="text-amber-500" /> {incidentCount} incident{incidentCount > 1 ? 's' : ''} need manual review
            </Link>
          </Button>
        )}
      </div>

      <KpiRow counters={counters.data} sessions={sessions.data} history={history.data} payments={cashPayments.data} />

      {/* Four cameras (entry lane on top, exit lane below) with the Check-in / Check-out lanes beside them */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
        <AnprTelemetry sessions={sessions.data} exits={exits.data?.items} />
        {lotKey ? (
          <GateLanesPanel lotId={lotKey} initialTab={lane === 'checkout' ? 'CheckOut' : 'CheckIn'} />
        ) : (
          <Panel>
            <SectionTitle icon={<LogIn />}>Entry lane</SectionTitle>
            <p className="text-sm text-slate-700">{myLots.isPending ? 'Loading your lot…' : 'No parking lot is assigned to you yet. Ask your Manager.'}</p>
          </Panel>
        )}
      </div>

      {myLots.isPending ? (
        <Skeleton className="h-[30rem] rounded-2xl" />
      ) : (
        <LiveLotModel lots={myLots.data ?? []} lotId={lotId} onLotChange={setLotId} />
      )}

      <ActivityStream sessions={sessions.data ?? []} isLoading={sessions.isPending} query={query} setQuery={setQuery} />
    </div>
  )
}
