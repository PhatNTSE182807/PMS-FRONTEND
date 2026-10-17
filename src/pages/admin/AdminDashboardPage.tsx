import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bike, Building2, Car, Gauge, Store, TrendingDown, TrendingUp, UserCog, Users, Wallet, Zap } from 'lucide-react'
import { presetRange } from '@/components/features/revenue/revenueFilters'
import { PageHeader } from '@/components/layout/PageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { useCustomerList } from '@/hooks/useCustomers'
import { useCapacitySimulation, useParkingCapacity } from '@/hooks/useParking'
import { useRevenueByParkingLot, useRevenueKpi, useRevenueTimeSeries } from '@/hooks/useRevenueReport'
import { useStaffList } from '@/hooks/useStaff'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CapacityVehicleType, ParkingLotCapacityDTO } from '@/types/parking.dto'
import type { RevenueByParkingLotDTO } from '@/types/report.dto'

const VEHICLE_ICON: Record<CapacityVehicleType, typeof Car> = { CAR: Car, MOTORBIKE: Bike, EV_CHARGING: Zap }
const VEHICLE_LABEL: Record<CapacityVehicleType, string> = { CAR: 'Cars', MOTORBIKE: 'Bikes', EV_CHARGING: 'EV' }
const HUB_ICONS = [Building2, Store, Building2, Store]

const vnd = (value: number) => `${formatNumber(Math.round(value))} VND`

function lotTotals(lot: ParkingLotCapacityDTO) {
  const total = lot.capacityByVehicle.reduce((s, d) => s + d.totalSlots, 0)
  const free = lot.capacityByVehicle.reduce((s, d) => s + d.availableSlots, 0)
  return { total, free, occupied: total - free, percent: total > 0 ? ((total - free) / total) * 100 : 0 }
}

/** Flow label from occupancy: the same 75% / 90% thresholds as the capacity page. */
function flow(percent: number, status: ParkingLotCapacityDTO['status']) {
  if (status === 'MAINTENANCE' || status === 'CLOSED') return { label: status === 'CLOSED' ? 'Closed' : 'Maintenance', tone: 'bg-slate-100 text-slate-700' }
  if (percent >= 90) return { label: `Peak load ${Math.round(percent)}%`, tone: 'bg-rose-100 text-rose-700' }
  if (percent >= 75) return { label: 'Steady turnover', tone: 'bg-amber-100 text-amber-700' }
  return { label: 'Optimal flow', tone: 'bg-indigo-100 text-indigo-700' }
}

function findRevenue(rows: RevenueByParkingLotDTO[] | undefined, lot: ParkingLotCapacityDTO) {
  return rows?.find((r) => r.parkingLotId === lot.id) ?? rows?.find((r) => r.parkingLotName === lot.name)
}

function StatCard({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('rounded-2xl bg-white p-6 ring-1 ring-slate-200', className)}>{children}</section>
}

/** /admin/dashboard: revenue and live occupancy across the whole network. */
export default function AdminDashboardPage() {
  const capacity = useParkingCapacity()
  useCapacitySimulation(true)
  const lots = capacity.data ?? []

  const week = presetRange('last7')
  const today = presetRange('today')
  const month = presetRange('thisMonth')
  const kpi = useRevenueKpi(week)
  const series = useRevenueTimeSeries(week)
  const todayByLot = useRevenueByParkingLot(today)
  const monthByLot = useRevenueByParkingLot(month)
  const customers = useCustomerList({ pageNumber: 1, pageSize: 1 })
  const staff = useStaffList({ pageNumber: 1, pageSize: 1, status: 'ACTIVE' })

  const network = lots.reduce(
    (sum, lot) => {
      const t = lotTotals(lot)
      return { total: sum.total + t.total, occupied: sum.occupied + t.occupied }
    },
    { total: 0, occupied: 0 },
  )
  const networkPercent = network.total > 0 ? (network.occupied / network.total) * 100 : 0
  const openLots = lots.filter((l) => l.status === 'OPEN' || l.status === 'FULL').length
  const bestDay = series.data?.points.reduce((max, p) => Math.max(max, p.totalRevenue), 0) ?? 0
  const growth = kpi.data?.revenueGrowthPercent ?? 0
  const todayTotal = todayByLot.data?.reduce((s, r) => s + r.totalRevenue, 0) ?? 0

  const sortedLots = [...lots].sort(
    (a, b) => (findRevenue(todayByLot.data, b)?.totalRevenue ?? 0) - (findRevenue(todayByLot.data, a)?.totalRevenue ?? 0),
  )

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <span className="text-amber-500">Executive node alpha</span>
            <span aria-hidden>•</span>
            <span>Ho Chi Minh metro net</span>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-700">Production sync</span>
          </>
        }
        title="Central Command Telemetry"
        actions={
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 font-mono text-xs ring-1 ring-slate-200">
            <span className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-slate-800">
              <span className="size-1.5 rounded-full bg-indigo-700" aria-hidden />
              HUBS OPEN <strong className="text-indigo-700">{openLots} / {lots.length}</strong>
            </span>
            <span className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-slate-800">
              <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
              BAYS <strong className="text-amber-500">{formatNumber(network.total)}</strong>
            </span>
          </div>
        }
      />

      <nav aria-label="Dashboard sections" className="flex flex-wrap gap-2 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200">
        <span className="flex items-center gap-2 rounded-lg bg-[#124e66] px-4 py-2 text-sm font-semibold text-indigo-800">
          <Gauge className="size-4" aria-hidden /> Overview &amp; revenue
        </span>
        <Link to="/admin/customers" className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100">
          <Users className="size-4" aria-hidden /> User directory &amp; accounts
          <span className="rounded-full bg-indigo-100 px-2 text-xs font-bold text-indigo-700">{formatNumber(customers.data?.totalCount ?? 0)}</span>
        </Link>
        <Link to="/admin/staff" className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100">
          <UserCog className="size-4" aria-hidden /> Manager &amp; staff console
          <span className="rounded-full bg-amber-100 px-2 text-xs font-bold text-amber-700">{formatNumber(staff.data?.totalCount ?? 0)} active</span>
        </Link>
      </nav>

      <div className="grid gap-6 lg:grid-cols-2">
        <StatCard>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-[0.1em] text-slate-800 uppercase">Total gross revenue</p>
              <p className="mt-1 text-sm font-semibold text-amber-500">Chainwide consolidated revenue, last 7 days</p>
            </div>
            <span className="grid size-10 place-items-center rounded-lg bg-slate-100 text-amber-500"><Wallet className="size-5" aria-hidden /></span>
          </div>
          {kpi.isPending ? (
            <Skeleton className="mt-6 h-12 w-72" />
          ) : (
            <p className="mt-6 font-display text-4xl font-bold tracking-tight text-slate-950 tabular-nums sm:text-5xl">{vnd(kpi.data?.totalRevenue ?? 0)}</p>
          )}
          <p className={cn('mt-2 flex items-center gap-1.5 text-sm', growth >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
            {growth >= 0 ? <TrendingUp className="size-4" aria-hidden /> : <TrendingDown className="size-4" aria-hidden />}
            {growth >= 0 ? '+' : ''}
            {growth.toFixed(1)}% <span className="text-slate-700">vs the previous 7 days</span>
          </p>
          <div className="mt-6 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm">
            <span className="font-semibold text-slate-800">Best day in the period</span>
            <span className="font-mono font-bold text-indigo-700">{vnd(bestDay)}</span>
          </div>
        </StatCard>

        <StatCard>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-[0.1em] text-slate-800 uppercase">Overall network performance</p>
              <p className="mt-1 text-sm font-semibold text-indigo-700">Real-time bay utilisation across all hubs</p>
            </div>
            <span className="grid size-10 place-items-center rounded-lg bg-slate-100 text-indigo-700"><Gauge className="size-5" aria-hidden /></span>
          </div>
          {capacity.isPending ? (
            <Skeleton className="mt-6 h-12 w-40" />
          ) : (
            <p className="mt-6 font-display text-5xl font-bold tracking-tight text-indigo-700 tabular-nums">{networkPercent.toFixed(1)}%</p>
          )}
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-mono font-bold text-slate-900">
              {formatNumber(network.occupied)} / {formatNumber(network.total)} bays occupied
            </span>{' '}
            across {lots.length} metro hubs
          </p>
          <div className="mt-6">
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-slate-800">Network load factor</span>
              <span className="font-mono font-bold text-amber-500">{networkPercent.toFixed(1)}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-100" role="meter" aria-label="Network occupancy" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(networkPercent)}>
              <div className="h-full rounded-full bg-amber-500 transition-[width] duration-500" style={{ width: `${Math.min(100, networkPercent)}%` }} />
            </div>
          </div>
        </StatCard>
      </div>

      <StatCard className="p-0">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-950">Hub Facility Performance Yields</h2>
            <p className="mt-1 text-sm text-slate-700">Today's gate revenue and month-to-date totals, with live occupancy.</p>
          </div>
          <span className="rounded-md bg-indigo-100 px-3 py-1 text-xs font-bold tracking-wider text-indigo-700 uppercase">
            {lots.length} metro hubs
          </span>
        </div>

        <ul className="space-y-3 p-4 sm:p-6">
          {capacity.isPending &&
            Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
          {sortedLots.map((lot, index) => {
            const t = lotTotals(lot)
            const f = flow(t.percent, lot.status)
            const Icon = HUB_ICONS[index % HUB_ICONS.length]
            const todayRow = findRevenue(todayByLot.data, lot)
            const monthRow = findRevenue(monthByLot.data, lot)
            const barTone = t.percent >= 90 ? 'bg-amber-500' : 'bg-indigo-700'
            return (
              <li key={lot.id} className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="grid size-11 place-items-center rounded-lg bg-white text-indigo-700 ring-1 ring-slate-200">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div>
                      <p className="flex flex-wrap items-center gap-2 font-display text-base font-semibold text-slate-950">
                        {lot.name}
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-700">{lot.code}</span>
                      </p>
                      <p className="text-sm text-slate-700">
                        {lot.address} • {formatNumber(t.total)} bays total
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-lg font-bold text-amber-500">{vnd(todayRow?.totalRevenue ?? 0)}</p>
                    <p className="font-mono text-xs font-semibold text-slate-700">MTD: {vnd(monthRow?.totalRevenue ?? 0)}</p>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 rounded-lg bg-[#0b141b] p-3 sm:grid-cols-[1.2fr_1fr_auto] sm:items-center">
                  <div>
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-slate-900">Occupancy load</span>
                      <span className="font-mono font-bold text-amber-500">{t.percent.toFixed(1)}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-slate-200">
                      <div className={cn('h-full rounded-full transition-[width] duration-500', barTone)} style={{ width: `${Math.min(100, t.percent)}%` }} />
                    </div>
                    <div className="mt-1.5 flex justify-between font-mono text-[11px] text-slate-600">
                      <span>{formatNumber(t.occupied)} / {formatNumber(t.total)} bays</span>
                      <span>{formatNumber(t.free)} available</span>
                    </div>
                  </div>
                  <div className="sm:border-l sm:border-slate-200 sm:pl-4">
                    <p className="text-xs font-bold tracking-wider text-slate-800 uppercase">Free by vehicle</p>
                    <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-slate-700">
                      {lot.capacityByVehicle.map((d) => {
                        const VIcon = VEHICLE_ICON[d.vehicleType]
                        return (
                          <span key={d.vehicleType} className="inline-flex items-center gap-1">
                            <VIcon className="size-3.5 text-indigo-700" aria-hidden />
                            <strong className="font-mono text-slate-950">{formatNumber(d.availableSlots)}</strong> {VEHICLE_LABEL[d.vehicleType]}
                          </span>
                        )
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">Flow dynamics</p>
                    <span className={cn('mt-1 inline-block rounded-md px-2.5 py-1 text-xs font-bold tracking-wide uppercase', f.tone)}>{f.label}</span>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <span className="text-sm text-slate-700">Aggregated gross chain total today</span>
          <span className="font-mono text-lg font-bold text-slate-950">{vnd(todayTotal)}</span>
        </div>
      </StatCard>
    </div>
  )
}
