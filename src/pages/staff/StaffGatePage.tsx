import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  BadgeCheck,
  Car,
  CircleCheck,
  Cpu,
  DoorOpen,
  Headset,
  LogIn,
  LogOut,
  Lock,
  ScanLine,
  Search,
  ShieldCheck,
  Siren,
  TrafficCone,
  TriangleAlert,
  Video,
  Wallet,
} from 'lucide-react'
import { LiveLotModel } from '@/components/features/lots/LiveLotModel'
import { GateLanesPanel } from '@/components/features/staff/GateLanesPanel'
import { CameraFrame, Metric, Panel, Plate, SectionTitle, StatTile } from '@/components/features/staff/StaffBits'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form-controls'
import { Skeleton } from '@/components/ui/skeleton'
import { useDemoIncidents } from '@/hooks/useDemoIncidents'
import { useGateHistory, useLotPayments, useOpenSessions, useZoneCounters } from '@/hooks/useGate'
import { useGateRequestQueue } from '@/hooks/useGateRequests'
import { useCapacitySimulation, useMyStaffLots } from '@/hooks/useParking'
import { useStaffLot } from '@/hooks/useStaffLot'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { demoCameras, demoGateStats, demoStation } from '@/mocks/staffOps.mock'
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
  history,
}: {
  sessions: ParkingSessionDTO[] | undefined
  history: { items: ParkingSessionDTO[]; totalCount: number } | undefined
}) {
  const latestEntry = sessions?.[0]
  const latestExit = history?.items?.find((h) => h.exitTime)

  const cameras = useMemo(() => {
    const list = [...demoCameras]
    if (latestEntry && latestEntry.plateNumber) {
      list[0] = {
        ...list[0],
        plate: latestEntry.plateNumber,
        vehicle: latestEntry.vehicleTypeName || 'Passenger vehicle',
        tag: latestEntry.sessionType === 'Reservation' ? 'Reserved' : 'OCR locked',
        status: latestEntry.status === 'Active' ? 'PASSING' : 'AWAITING',
        capturedAt: Date.parse(latestEntry.entryTime) || Date.now(),
      }
    }
    if (latestExit && latestExit.plateNumber) {
      list[1] = {
        ...list[1],
        plate: latestExit.plateNumber,
        vehicle: latestExit.vehicleTypeName || 'Passenger vehicle',
        tag: 'Plate verified',
        status: 'PASSING',
        capturedAt: latestExit.exitTime ? Date.parse(latestExit.exitTime) : Date.now(),
      }
    }
    return list
  }, [latestEntry, latestExit])

  return (
    <Panel>
      <SectionTitle
        icon={<Video />}
        aside={
          <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono">4K dual RTSP</span>
            Latency 12ms
          </span>
        }
      >
        Live optical ANPR telemetry
      </SectionTitle>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cameras.map((cam) => (
          <figure key={cam.id} className="overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200">
            <CameraFrame
              image={cam.image}
              alt={`${cam.id} ${cam.label} camera still`}
              className="rounded-none"
              topLeft={`${cam.id} [${cam.label}]`}
              topRight={`${cam.accuracy}% accuracy`}
              overlay={
                <div className="flex flex-col items-center gap-1.5">
                  <span className="rounded bg-indigo-300 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-950 uppercase">{cam.tag}</span>
                  <span className="rounded-md bg-black/75 px-3 py-1 font-mono text-lg font-bold tracking-[0.15em] text-slate-950 ring-1 ring-slate-300">
                    {cam.plate}
                  </span>
                </div>
              }
              bottomLeft="REC • 60 FPS"
              bottomRight={clockWithSeconds.format(cam.capturedAt)}
            />
            <figcaption className="flex items-center justify-between gap-3 px-4 py-3 text-xs font-bold tracking-wider uppercase">
              <span className={cn('flex items-center gap-2', cam.status === 'PASSING' ? 'text-indigo-700' : 'text-amber-500')}>
                {cam.status === 'PASSING' ? <DoorOpen className="size-4" aria-hidden /> : <Lock className="size-4" aria-hidden />}
                {cam.status === 'PASSING' ? 'Barrier open • Vehicle passing' : 'Awaiting clearance validation'}
              </span>
              <span className="text-right font-mono text-slate-700">{cam.vehicle}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl bg-slate-50 px-4 py-3">
        <div>
          <p className="text-xs font-bold tracking-wider text-slate-700 uppercase">Optical edge server</p>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-950">
            <Cpu className="size-4 text-slate-500" aria-hidden /> NVIDIA Jetson AGX #04
          </p>
        </div>
        <div>
          <p className="text-xs font-bold tracking-wider text-slate-700 uppercase">Barrier hardware</p>
          <p className="text-sm font-semibold text-indigo-700">FAAC B680 Pro • Operational</p>
        </div>
        <Button variant="secondary" className="ml-auto" onClick={() => toast.success('ANPR recalibration queued')}>
          <ScanLine /> Recalibrate ANPR
        </Button>
      </div>
    </Panel>
  )
}

function DispatchBar() {
  const [armed, setArmed] = useState(false)
  const override = () => {
    if (!armed) {
      setArmed(true)
      return
    }
    setArmed(false)
    toast.error('Emergency barrier override engaged', { description: 'All lanes of Station 01 opened.' })
  }
  return (
    <Panel className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center sm:py-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-slate-100 text-amber-500">
          <TriangleAlert className="size-5" aria-hidden />
        </span>
        <div>
          <p className="font-display text-lg font-bold text-slate-950">Tactical rapid dispatch &amp; barrier override</p>
          <p className="text-sm text-slate-700">Gate terminal direct override for Station 01 console</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 lg:ml-auto">
        <Button variant="secondary" onClick={() => toast.info('Blocked slot reported to the floor team')}>
          <TrafficCone /> Report blocked slot
        </Button>
        <Button variant="secondary" onClick={() => toast.info('Intercom channel open')}>
          <Headset /> Intercom audio <span className="size-1.5 rounded-full bg-indigo-400" aria-hidden />
        </Button>
        <Button variant="destructive" onClick={override} onBlur={() => setArmed(false)}>
          <Siren /> {armed ? 'Click again to confirm' : 'Emergency barrier override'}
        </Button>
      </div>
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
                <td className="px-4 py-3 font-mono text-xs text-slate-900">{e.slotCode ?? e.zoneName ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={cn('rounded px-2 py-0.5 text-xs font-bold tracking-wide uppercase', SESSION_TONE[e.status] ?? 'bg-slate-100 text-slate-800')}>{e.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/staff/checkout?session=${e.id}`}>
                      <LogOut /> Exit
                    </Link>
                  </Button>
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
    </Panel>
  )
}

export default function StaffGatePage() {
  const { open } = useDemoIncidents()
  const myLots = useMyStaffLots()
  const { lot } = useStaffLot()
  const [lotId, setLotId] = useState<string>()
  useCapacitySimulation(true)
  const [query, setQuery] = useState('')
  const lotKey = lotId ?? lot?.id ?? myLots.data?.[0]?.id
  const sessions = useOpenSessions(lotKey)
  const counters = useZoneCounters(lotKey)
  const history = useGateHistory(lotKey, 1, 50)
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
    return sessions.isSuccess ? count : open.length
  }, [sessions.data, sessions.isSuccess, checkIns.data, checkOuts.data, open.length])

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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
        <AnprTelemetry sessions={sessions.data} history={history.data} />
        {lotKey ? (
          <GateLanesPanel lotId={lotKey} />
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

      <DispatchBar />
      <ActivityStream sessions={sessions.data ?? []} isLoading={sessions.isPending} query={query} setQuery={setQuery} />
    </div>
  )
}
