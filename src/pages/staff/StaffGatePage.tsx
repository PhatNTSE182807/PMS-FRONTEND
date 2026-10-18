import { useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import { CameraFrame, Key, Metric, Panel, Plate, SectionTitle, StatTile } from '@/components/features/staff/StaffBits'
import { formatClock } from '@/components/features/manager/managerFormat'
import { DemoTag } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form-controls'
import { useDemoIncidents } from '@/hooks/useDemoIncidents'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { demoCameras, demoGateEvents, demoGateSession, demoGateStats, demoStation, type GateClearance } from '@/mocks/staffOps.mock'

const CLEARANCE: Record<GateClearance, { label: string; tone: string }> = {
  AUTO_PASSED: { label: 'Automatic passed', tone: 'bg-indigo-100 text-indigo-700' },
  PAID_OPENING: { label: 'Paid • Opening', tone: 'bg-amber-100 text-amber-700' },
  COMPLETED: { label: 'Completed • Closed', tone: 'bg-slate-100 text-slate-800' },
}

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

function KpiRow() {
  const s = demoGateStats
  const occupancy = Math.round((s.activeBays / s.totalBays) * 100)
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatTile label="Throughput today" icon={<Car />}>
        <Metric value={formatNumber(s.throughputToday)} />
        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-700">
          <CircleCheck className="size-4 text-emerald-600" aria-hidden /> Zero toll violations
          <span className="ml-auto font-mono text-xs font-bold text-emerald-700">+{s.throughputTrend}%</span>
        </p>
      </StatTile>
      <StatTile label="Facility capacity" className="ring-amber-300/40">
        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            <Metric value={s.activeBays} unit={`/ ${s.totalBays}`} className="mt-0" />
            <p className="mt-1 text-sm text-amber-500">Bays active • Heavy inflow</p>
          </div>
          <CapacityRing percent={occupancy} />
        </div>
      </StatTile>
      <StatTile label="General open" icon={<DoorOpen />}>
        <Metric value={s.generalOpen} unit="bays" className="text-indigo-700" />
        <p className="mt-1 text-sm text-slate-700">Levels B1, B2, B3 active</p>
      </StatTile>
      <StatTile label="VIP & pre-booked" icon={<ShieldCheck />}>
        <Metric value={s.reservedVip} unit="reserved" className="text-amber-500" />
        <p className="mt-1 text-sm text-slate-700">Executive concierge</p>
      </StatTile>
      <StatTile label="Cash in drawer" icon={<Wallet />}>
        <Metric value={formatNumber(s.cashInDrawer)} unit="VND" />
        <p className="mt-1 text-sm text-slate-700">Synced with cash vault module</p>
      </StatTile>
    </div>
  )
}

function AnprTelemetry() {
  return (
    <Panel>
      <SectionTitle
        icon={<Video />}
        aside={
          <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <DemoTag />
            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono">4K dual RTSP</span>
            Latency 12ms
          </span>
        }
      >
        Live optical ANPR telemetry
      </SectionTitle>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {demoCameras.map((cam) => (
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
        <Button variant="secondary" className="ml-auto" onClick={() => toast.success('ANPR recalibration queued', { description: 'Demo only: no camera is connected yet.' })}>
          <ScanLine /> Recalibrate ANPR
        </Button>
      </div>
    </Panel>
  )
}

function GateSession({ onLookup }: { onLookup: () => void }) {
  const navigate = useNavigate()
  const s = demoGateSession
  const hotkeys = [
    { key: 'F1', label: 'Manual barrier lift', hint: 'Bypass validation', primary: true, run: () => toast.warning('Barrier lifted manually', { description: `Logged against ${demoStation.employeeCode}. Demo only: no barrier is connected.` }) },
    { key: 'F2', label: 'Scan ticket / NFC', hint: 'RFID terminal', run: () => toast.info('Waiting for a ticket or NFC card…', { description: 'Demo only: no reader is connected.' }) },
    { key: 'F3', label: 'Lookup plate', hint: 'Manual database query', run: onLookup },
    { key: 'F4', label: 'Flag incident', hint: 'Record exception log', run: () => void navigate('/staff/exceptions') },
  ]
  const rows: [string, ReactNode][] = [
    ['Vehicle class', s.vehicleClass],
    ['Registered driver', `${s.driver} • ${s.driverId}`],
    ['Assigned location', <span className="text-amber-500">{s.bay}</span>],
    ['Reservation status', <span className="text-indigo-700">{s.reservation}</span>],
    ['Inductive loop sensor', <span className="flex items-center justify-end gap-1.5"><span className="size-1.5 rounded-full bg-indigo-400" aria-hidden />Loop S1 activated</span>],
  ]
  return (
    <Panel>
      <SectionTitle aside={<span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold tracking-wider text-indigo-700 uppercase">Entry in progress</span>}>
        Current gate session
      </SectionTitle>
      <div className="flex items-start justify-between gap-3 rounded-xl bg-[#060f16] p-5 ring-1 ring-slate-200">
        <div>
          <p className="text-xs font-bold tracking-wider text-amber-500 uppercase">Identified number plate</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-[0.15em] text-slate-950">{s.plate}</p>
        </div>
        <div className="text-right">
          <span className="rounded bg-amber-500 px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-(--color-on-gold) uppercase">{s.tier}</span>
          <p className="mt-1 text-xs text-slate-700">Pre-validated pass</p>
        </div>
      </div>
      <dl className="mt-4 divide-y divide-slate-200 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 py-2.5">
            <dt className="text-slate-700">{label}</dt>
            <dd className="text-right font-semibold text-slate-950">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 mb-3 text-xs font-bold tracking-wider text-slate-700 uppercase">Operator gate hotkeys</p>
      <div className="grid grid-cols-2 gap-3">
        {hotkeys.map((h) => (
          <button
            key={h.key}
            type="button"
            onClick={h.run}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-3 text-left ring-1 transition-colors',
              h.primary ? 'bg-[#124e66] ring-indigo-300 hover:bg-[#186382]' : 'bg-slate-50 ring-slate-200 hover:bg-slate-100',
            )}
          >
            <Key>{h.key}</Key>
            <span className="leading-tight">
              <span className={cn('block text-sm font-semibold', h.primary ? 'text-indigo-800' : 'text-slate-950')}>{h.label}</span>
              <span className="text-xs text-slate-700">{h.hint}</span>
            </span>
          </button>
        ))}
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
    toast.error('Emergency barrier override engaged', { description: 'All lanes of Station 01 opened. Demo only: no barrier is connected.' })
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
        <Button variant="secondary" onClick={() => toast.info('Blocked slot reported to the floor team', { description: 'Demo only.' })}>
          <TrafficCone /> Report blocked slot
        </Button>
        <Button variant="secondary" onClick={() => toast.info('Intercom channel open', { description: 'Demo only: no intercom is connected.' })}>
          <Headset /> Intercom audio <span className="size-1.5 rounded-full bg-indigo-400" aria-hidden />
        </Button>
        <Button variant="destructive" onClick={override} onBlur={() => setArmed(false)}>
          <Siren /> {armed ? 'Click again to confirm' : 'Emergency barrier override'}
        </Button>
      </div>
    </Panel>
  )
}

function ActivityStream({ query, setQuery, inputRef }: { query: string; setQuery: (q: string) => void; inputRef: RefObject<HTMLInputElement | null> }) {
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    if (!q) return demoGateEvents
    return demoGateEvents.filter((e) => `${e.plate}${e.vehicle}`.toLowerCase().replace(/[^a-z0-9]/g, '').includes(q))
  }, [query])

  return (
    <Panel>
      <SectionTitle
        aside={
          <div className="flex items-center gap-2">
            <DemoTag />
            <label className="relative">
              <span className="sr-only">Lookup plate</span>
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-500" aria-hidden />
              <Input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Lookup plate…" className="w-52 pl-8 font-mono uppercase" />
            </label>
          </div>
        }
      >
        Gate flow activity stream
      </SectionTitle>
      <p className="-mt-3 mb-4 text-sm text-slate-700">Real-time telemetry log for {demoStation.facility} {demoStation.lane.toLowerCase()} gate</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-bold tracking-wider text-slate-700 uppercase">
              <th className="rounded-l-lg px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Vehicle plate</th>
              <th className="px-4 py-3">Type / make</th>
              <th className="px-4 py-3">Direction</th>
              <th className="px-4 py-3">Payment / access</th>
              <th className="px-4 py-3">Gate clearance</th>
              <th className="rounded-r-lg px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((e) => (
              <tr key={`${e.at}-${e.plate}`} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs font-bold text-slate-900">{clockWithSeconds.format(e.at)}</td>
                <td className="px-4 py-3"><Plate>{e.plate}</Plate></td>
                <td className="px-4 py-3 text-slate-950">{e.vehicle}</td>
                <td className="px-4 py-3">
                  <span className={cn('flex items-center gap-1.5 text-xs font-bold uppercase', e.direction === 'ENTRY' ? 'text-indigo-700' : 'text-slate-800')}>
                    {e.direction === 'ENTRY' ? <LogIn className="size-3.5" aria-hidden /> : <LogOut className="size-3.5" aria-hidden />}
                    {e.direction}
                  </span>
                </td>
                <td className={cn('px-4 py-3 text-xs font-semibold', e.premium ? 'text-amber-500' : 'text-slate-900')}>{e.access}</td>
                <td className="px-4 py-3">
                  <span className={cn('rounded px-2 py-0.5 text-xs font-bold tracking-wide uppercase', CLEARANCE[e.clearance].tone)}>{CLEARANCE[e.clearance].label}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toast.info(`${e.plate} • ${e.vehicle}`, { description: `${e.direction === 'ENTRY' ? 'Entered' : 'Left'} at ${formatClock(e.at)} • ${e.access}` })}
                  >
                    {e.clearance === 'COMPLETED' && e.access.startsWith('Cash') ? 'Receipt' : 'Inspect'}
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-700">
                  No gate event matches “{query}”.
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
  const [query, setQuery] = useState('')
  const lookupRef = useRef<HTMLInputElement>(null)
  const lookup = () => {
    lookupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    lookupRef.current?.focus()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-slate-700 uppercase">
            <BadgeCheck className="size-4 text-indigo-700" aria-hidden /> {demoStation.station} • {demoStation.lane}
            <DemoTag />
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-950">Gate operations dashboard</h1>
        </div>
        {open.length > 0 && (
          <Button variant="outline" asChild>
            <Link to="/staff/exceptions">
              <TriangleAlert className="text-amber-500" /> {open.length} incidents need manual review
            </Link>
          </Button>
        )}
      </div>

      <KpiRow />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
        <AnprTelemetry />
        <GateSession onLookup={lookup} />
      </div>

      <DispatchBar />
      <ActivityStream query={query} setQuery={setQuery} inputRef={lookupRef} />
    </div>
  )
}
