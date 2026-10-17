import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bike,
  Car,
  CarFront,
  ClipboardCheck,
  Construction,
  Layers,
  MapPin,
  ReceiptText,
  RotateCcw,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  UserPlus,
  Zap,
} from 'lucide-react'
import { Kpi, WithManagerLot } from '@/components/features/manager/ManagerBits'
import { formatClock, vnd } from '@/components/features/manager/managerFormat'
import { presetRange } from '@/components/features/revenue/revenueFilters'
import { DemoTag, EyebrowTag, PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useDemoApprovals } from '@/hooks/useDemoApprovals'
import { useCapacitySimulation, useParkingCapacity } from '@/hooks/useParking'
import { usePaymentMethodBreakdown, useRevenueByParkingLot } from '@/hooks/useRevenueReport'
import { useNow } from '@/hooks/useNow'
import { formatNumber, toIsoDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { demoReservations, type ApprovalKind } from '@/mocks/managerOps.mock'
import { LOT_STATES, type ManagedLot } from '@/types/lot-management.dto'
import type { CapacityVehicleType } from '@/types/parking.dto'

const VEHICLE_ICON: Record<CapacityVehicleType, typeof Car> = { CAR: Car, MOTORBIKE: Bike, EV_CHARGING: Zap }
const VEHICLE_LABEL: Record<CapacityVehicleType, string> = { CAR: 'Cars', MOTORBIKE: 'Bikes', EV_CHARGING: 'EV' }
const KIND_ICON: Record<ApprovalKind, typeof Car> = {
  LOST_TICKET: ReceiptText,
  DEPOSIT_REFUND: RotateCcw,
  SESSION_CLOSURE: TriangleAlert,
  COUNTER_ADJUSTMENT: SlidersHorizontal,
}

function yesterdayRange() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const day = toIsoDate(d)
  return { startDate: day, endDate: day }
}

function Console({ lot }: { lot: ManagedLot }) {
  const now = useNow(30_000)
  const capacity = useParkingCapacity()
  useCapacitySimulation(true)
  const live = capacity.data?.find((c) => c.id === lot.id)

  const today = presetRange('today')
  const todayByLot = useRevenueByParkingLot(today)
  const yesterdayByLot = useRevenueByParkingLot(yesterdayRange())
  const methods = usePaymentMethodBreakdown({ ...today, parkingLotId: lot.id })
  const revenue = todayByLot.data?.find((r) => r.parkingLotId === lot.id)?.totalRevenue ?? 0
  const previous = yesterdayByLot.data?.find((r) => r.parkingLotId === lot.id)?.totalRevenue ?? 0
  const change = previous ? ((revenue - previous) / previous) * 100 : 0
  const qr = methods.data?.find((m) => m.method === 'QR_BANKING')?.amount ?? 0
  const cash = methods.data?.find((m) => m.method === 'CASH')?.amount ?? 0

  const { pending } = useDemoApprovals()

  const totals = (live?.capacityByVehicle ?? []).reduce(
    (s, d) => ({ total: s.total + d.totalSlots, free: s.free + d.availableSlots }),
    { total: 0, free: 0 },
  )
  const occupied = totals.total - totals.free
  const occupancy = totals.total ? (occupied / totals.total) * 100 : 0

  const upcoming = demoReservations
    .filter((r) => r.status === 'CONFIRMED' && r.start >= now - 30 * 60_000)
    .sort((a, b) => a.start - b.start)
  const checkedIn = demoReservations.filter((r) => r.status === 'CHECKED_IN' || r.status === 'COMPLETED').length
  const next = upcoming[0]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <EyebrowTag>Facility console</EyebrowTag>
            <span className="font-mono tracking-normal">{lot.code}</span>
            <span className={cn('rounded-full px-2.5 py-0.5', lot.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
              {LOT_STATES[lot.status]}
            </span>
          </>
        }
        title={lot.name}
        description={undefined}
        actions={
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link to="/management/lots">
                  <Construction className="text-amber-500" /> Closure / maintenance mode
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/management/staff">
                  <UserPlus /> Staff &amp; POS
                </Link>
              </Button>
            </div>
            <Button asChild size="lg">
              <Link to="/management/lots">
                <Layers /> Open zones &amp; bays editor
              </Link>
            </Button>
          </div>
        }
      />
      <p className="-mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-sm text-slate-700">
        <span className="flex items-center gap-1.5"><MapPin className="size-4 text-indigo-700" aria-hidden /> {lot.address}</span>
        <span>{lot.is24Hours ? 'Open 24/7' : `Open ${lot.openTime} – ${lot.closeTime}`}</span>
        <span>{lot.zones.length} configured zones</span>
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi label="Current occupancy" icon={<CarFront />}>
          {capacity.isPending ? (
            <Skeleton className="mt-3 h-10 w-32" />
          ) : (
            <p className="mt-3 font-display text-4xl font-bold text-slate-950 tabular-nums">
              {occupancy.toFixed(1)}%{' '}
              <span className="text-sm font-semibold text-indigo-700">
                {formatNumber(occupied)} / {formatNumber(totals.total)} bays
              </span>
            </p>
          )}
          <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
            {(live?.capacityByVehicle ?? []).map((d, i) => (
              <span
                key={d.vehicleType}
                className={['bg-indigo-700', 'bg-amber-500', 'bg-emerald-600'][i % 3]}
                style={{ width: `${totals.total ? ((d.totalSlots - d.availableSlots) / totals.total) * 100 : 0}%` }}
              />
            ))}
          </div>
          <p className="mt-2 flex flex-wrap gap-x-4 text-xs text-slate-700">
            {(live?.capacityByVehicle ?? []).map((d) => {
              const Icon = VEHICLE_ICON[d.vehicleType]
              return (
                <span key={d.vehicleType} className="flex items-center gap-1">
                  <Icon className="size-3.5" aria-hidden />
                  {VEHICLE_LABEL[d.vehicleType]}: <strong className="text-slate-950">{formatNumber(d.totalSlots - d.availableSlots)} / {formatNumber(d.totalSlots)}</strong>
                </span>
              )
            })}
          </p>
        </Kpi>

        <Kpi label="Today's revenue">
          {todayByLot.isPending ? (
            <Skeleton className="mt-3 h-10 w-48" />
          ) : (
            <p className="mt-3 font-display text-3xl font-bold text-amber-500 tabular-nums">{vnd(revenue)}</p>
          )}
          <p className={cn('mt-1 flex items-center gap-1 text-sm', change >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
            {change >= 0 ? <TrendingUp className="size-4" aria-hidden /> : <TrendingDown className="size-4" aria-hidden />}
            {change >= 0 ? '+' : ''}
            {change.toFixed(1)}% <span className="text-slate-700">vs yesterday</span>
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700">
            <span>VietQR / bank<strong className="block font-mono text-sm text-slate-950">{vnd(qr)}</strong></span>
            <span>Cash<strong className="block font-mono text-sm text-slate-950">{vnd(cash)}</strong></span>
          </div>
        </Kpi>

        <Kpi label="Action queue" icon={<ClipboardCheck />} className="sm:col-span-2 xl:col-span-1">
          <p className="mt-3 font-display text-4xl font-bold text-amber-500">
            {pending.length} <span className="text-base font-semibold text-slate-950">items need sign-off</span>
          </p>
          <ul className="mt-3 space-y-1 text-sm text-slate-700">
            {pending.slice(0, 3).map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <span className={cn('size-1.5 rounded-full', a.priority === 'HIGH' ? 'bg-rose-500' : 'bg-amber-500')} aria-hidden />
                {a.title}
              </li>
            ))}
          </ul>
          <Link to="/management/approvals" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:underline">
            Review queue <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Kpi>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-slate-950">Live Bay &amp; Zone Capacity</h2>
              <p className="mt-0.5 text-sm text-slate-700">Real-time occupancy per zone from the gate and sensor feed.</p>
            </div>
            <Button variant="outline" asChild>
              <Link to="/management/lots">
                <SlidersHorizontal /> Manage bays &amp; maintenance
              </Link>
            </Button>
          </div>

          <ul className="mt-5 space-y-3">
            {capacity.isPending && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            {!capacity.isPending && !live?.zones.length && (
              <li className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-600">No live zone data for this lot yet.</li>
            )}
            {live?.zones.map((zone) => {
              const percent = zone.totalSlots ? (zone.occupiedSlots / zone.totalSlots) * 100 : 0
              const tone = percent >= 90 ? 'rose' : percent >= 75 ? 'amber' : 'indigo'
              return (
                <li key={zone.zoneId} className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-950">{zone.zoneName}</p>
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-xs font-bold',
                          tone === 'rose' ? 'bg-rose-100 text-rose-700' : tone === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700',
                        )}
                      >
                        {Math.round(percent)}% {tone === 'rose' ? 'Occupied' : tone === 'amber' ? 'Busy' : 'Normal'}
                      </span>
                      <span className="font-mono text-sm font-bold text-slate-950">
                        {formatNumber(zone.occupiedSlots)} / {formatNumber(zone.totalSlots)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-200">
                    <div
                      className={cn('h-full rounded-full transition-[width] duration-500', tone === 'rose' ? 'bg-rose-400' : tone === 'amber' ? 'bg-amber-500' : 'bg-indigo-700')}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-600">{formatNumber(zone.totalSlots - zone.occupiedSlots)} slots available</p>
                </li>
              )
            })}
          </ul>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-slate-950">
                  Approval &amp; Incident Queue <DemoTag />
                </h2>
                <p className="mt-0.5 text-sm text-slate-700">Exceptions that need the Facility Manager's sign-off.</p>
              </div>
              <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">{pending.length} active</span>
            </div>
            <ul className="mt-4 space-y-3">
              {pending.slice(0, 3).map((a) => {
                const Icon = KIND_ICON[a.kind]
                return (
                  <li key={a.id} className={cn('rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200', a.priority === 'HIGH' && 'border-l-2 border-rose-400')}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-2 font-semibold text-slate-950">
                        <Icon className="size-4 text-amber-500" aria-hidden /> {a.title}
                      </p>
                      <span className="font-mono text-xs text-slate-600">#{a.id}</span>
                    </div>
                    {a.plate && <p className="mt-2 font-mono text-lg font-bold text-indigo-700">{a.plate}</p>}
                    <p className="mt-1 line-clamp-2 text-sm text-slate-700">{a.summary}</p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="font-mono text-sm font-bold text-amber-500">{a.amount ? vnd(Math.abs(a.amount)) : 'No charge'}</span>
                      <Button size="sm" asChild>
                        <Link to={`/management/approvals?id=${a.id}`}>Review</Link>
                      </Button>
                    </div>
                  </li>
                )
              })}
              {pending.length === 0 && <li className="text-sm text-slate-600">Nothing waiting for sign-off.</li>}
            </ul>
          </section>

          <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-slate-950">
                  Reservations Today <DemoTag />
                </h2>
                <p className="mt-0.5 text-sm text-slate-700">Scheduled pre-booked parking bays.</p>
              </div>
              <span className="font-mono text-lg font-bold text-indigo-700">{demoReservations.length} bookings</span>
            </div>
            <div className="mt-4 grid grid-cols-3 divide-x divide-slate-200 rounded-xl bg-slate-50 py-3 text-center text-xs text-slate-700">
              <span><strong className="block text-lg text-slate-950">{checkedIn}</strong>Checked in</span>
              <span><strong className="block text-lg text-amber-500">{upcoming.filter((r) => r.start - now < 60 * 60_000).length}</strong>Within 1 hour</span>
              <span><strong className="block text-lg text-slate-950">{upcoming.length}</strong>Upcoming</span>
            </div>
            {next && (
              <div className="mt-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <p className="flex items-center justify-between text-xs font-bold tracking-wider text-amber-500 uppercase">
                  Next incoming arrival
                  <span className="font-mono text-slate-700 normal-case">{formatClock(next.start)}</span>
                </p>
                <p className="mt-2 flex items-center gap-2 font-mono text-lg font-bold text-slate-950">
                  {next.plate}
                  <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-700">Bay {next.bay}</span>
                </p>
                <p className="text-sm text-slate-700">{next.vehicle} • {next.customer}</p>
              </div>
            )}
            <ul className="mt-3 space-y-1.5 text-sm">
              {upcoming.slice(1, 4).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 text-slate-700">
                  <span>
                    <strong className="font-mono text-slate-950">{r.plate}</strong> • Bay {r.bay}
                  </span>
                  <span className="font-mono text-xs">{formatClock(r.start)}</span>
                </li>
              ))}
            </ul>
            <Link to="/management/reservations" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:underline">
              All reservations <ArrowRight className="size-4" aria-hidden />
            </Link>
          </section>
        </div>
      </div>
    </div>
  )
}

/** /management/console: the Manager's home for the selected lot. */
export default function ManagerConsolePage() {
  return <WithManagerLot>{(lot) => <Console lot={lot} />}</WithManagerLot>
}
