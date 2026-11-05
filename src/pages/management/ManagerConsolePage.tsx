import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bike,
  Car,
  CarFront,
  Landmark,
  MapPin,
  TrendingDown,
  TrendingUp,
  UserPlus,
} from 'lucide-react'
import { LiveLotModel } from '@/components/features/lots/LiveLotModel'
import { Kpi, WithManagerLot } from '@/components/features/manager/ManagerBits'
import { formatClock, vnd } from '@/components/features/manager/managerFormat'
import { presetRange } from '@/components/features/revenue/revenueFilters'
import { EyebrowTag, PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useManagerLot } from '@/hooks/useManagerLot'
import { useLotOccupancy } from '@/hooks/useParking'
import { useLotReservations } from '@/hooks/useReservations'
import { useManagerAllTimeRevenue, useManagerRevenue } from '@/hooks/useRevenueReport'
import { useNow } from '@/hooks/useNow'
import { formatNumber, toIsoDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { LOT_STATES, type ManagedLot } from '@/types/lot-management.dto'
import type { ReservationStatus } from '@/types/operations.dto'
import type { CapacityVehicleType } from '@/types/parking.dto'

const VEHICLE_ICON: Record<CapacityVehicleType, typeof Car> = { CAR: Car, MOTORBIKE: Bike }
const VEHICLE_LABEL: Record<CapacityVehicleType, string> = { CAR: 'Cars', MOTORBIKE: 'Bikes' }

/** Bookings that will never use their bay do not count towards the day's total. */
const VOID_RESERVATION: ReservationStatus[] = ['Cancelled', 'LotCancelled', 'Expired']

function dayRange(ts: number) {
  const from = new Date(ts)
  from.setHours(0, 0, 0, 0)
  const to = new Date(ts)
  to.setHours(23, 59, 59, 999)
  return { from: from.toISOString(), to: to.toISOString() }
}

function yesterdayRange() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const day = toIsoDate(d)
  return { startDate: day, endDate: day }
}

function Console({ lot }: { lot: ManagedLot }) {
  const now = useNow(30_000)
  // Live occupancy of this lot from its zone counters (walk-ins and bookings alike)
  const occupancyQuery = useLotOccupancy(lot.id)
  const live = occupancyQuery.data
  const { lots: assigned, setLotId } = useManagerLot()

  // Real revenue of this lot (settled sessions): cash taken at the counter shows up within seconds
  const today = presetRange('today')
  const todayRevenue = useManagerRevenue({ ...today, parkingLotId: lot.id })
  const yesterdayRevenue = useManagerRevenue({ ...yesterdayRange(), parkingLotId: lot.id })
  const revenue = todayRevenue.data?.totalRevenue ?? 0
  const previous = yesterdayRevenue.data?.totalRevenue ?? 0
  const change = previous ? ((revenue - previous) / previous) * 100 : 0
  const methods = todayRevenue.data?.paymentMethods ?? []
  const qr = methods.find((m) => m.method === 'QR_BANKING')?.amount ?? 0
  const cash = methods.find((m) => m.method === 'CASH')?.amount ?? 0
  const wallet = methods.find((m) => m.method === 'RFID_WALLET')?.amount ?? 0

  const totals = { total: live?.totalBays ?? 0, free: live?.freeBays ?? 0 }
  const occupied = live?.occupiedBays ?? 0
  const occupancy = live?.occupancyRate ?? 0
  const byVehicle = live?.baysByVehicle ?? []

  // Everything this lot has earned since its first parking session
  const allTime = useManagerAllTimeRevenue(lot.id)
  const allTimeMethods = allTime.data?.paymentMethods ?? []
  const allTimeOf = (method: string) => allTimeMethods.find((m) => m.method === method)?.amount ?? 0

  // Bookings arriving today, earliest first; a confirmed one still counts until its hold ends
  const { from, to } = dayRange(now)
  const reservationsQuery = useLotReservations(lot.id, from, to)
  const reservations = reservationsQuery.data ?? []
  const bookings = reservations.filter((r) => !VOID_RESERVATION.includes(r.status)).length
  const upcoming = reservations.filter((r) => r.status === 'Confirmed' && Date.parse(r.checkInUntil) >= now)
  const withinHour = upcoming.filter((r) => Date.parse(r.arrivalTime) - now < 60 * 60_000).length
  const checkedIn = reservations.filter((r) => r.status === 'CheckedIn' || r.status === 'Completed').length
  const next = upcoming[0]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <EyebrowTag>Facility console</EyebrowTag>
            <span className="font-mono tracking-normal">{lot.code}</span>
            <span className={cn('rounded-full px-2.5 py-0.5', lot.status === 'Active' && lot.isStaffed !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
              {lot.status === 'Active' && lot.isStaffed === false ? 'Maintenance · add Staff to open for bookings' : LOT_STATES[lot.status]}
            </span>
          </>
        }
        title={lot.name}
        description={undefined}
        actions={
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link to="/management/staff">
                  <UserPlus /> Staff &amp; POS
                </Link>
              </Button>
            </div>
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
          {occupancyQuery.isPending ? (
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
            {byVehicle.map((d, i) => (
              <span
                key={d.vehicleType}
                className={['bg-indigo-700', 'bg-amber-500', 'bg-emerald-600'][i % 3]}
                style={{ width: `${totals.total ? ((d.totalBays - d.freeBays) / totals.total) * 100 : 0}%` }}
              />
            ))}
          </div>
          <p className="mt-2 flex flex-wrap gap-x-4 text-xs text-slate-700">
            {byVehicle.map((d) => {
              const Icon = VEHICLE_ICON[d.vehicleType]
              return (
                <span key={d.vehicleType} className="flex items-center gap-1">
                  <Icon className="size-3.5" aria-hidden />
                  {VEHICLE_LABEL[d.vehicleType]}: <strong className="text-slate-950">{formatNumber(d.totalBays - d.freeBays)} / {formatNumber(d.totalBays)}</strong>
                </span>
              )
            })}
          </p>
        </Kpi>

        <Kpi label="Today's revenue">
          {todayRevenue.isPending ? (
            <Skeleton className="mt-3 h-10 w-48" />
          ) : (
            <p className="mt-3 font-display text-3xl font-bold text-amber-500 tabular-nums">{vnd(revenue)}</p>
          )}
          <p className={cn('mt-1 flex items-center gap-1 text-sm', change >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
            {change >= 0 ? <TrendingUp className="size-4" aria-hidden /> : <TrendingDown className="size-4" aria-hidden />}
            {change >= 0 ? '+' : ''}
            {change.toFixed(1)}% <span className="text-slate-700">vs yesterday</span>
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-700">
            <span>Cash<strong className="block font-mono text-sm text-slate-950">{vnd(cash)}</strong></span>
            <span>VNPay / MoMo<strong className="block font-mono text-sm text-slate-950">{vnd(qr)}</strong></span>
            <span>Wallet<strong className="block font-mono text-sm text-slate-950">{vnd(wallet)}</strong></span>
          </div>
          {todayRevenue.data && (
            <p className="mt-2 text-xs text-slate-700">{formatNumber(todayRevenue.data.totalSessions)} paid sessions today</p>
          )}
          {todayRevenue.isError && <p className="mt-2 text-xs text-rose-700">Revenue could not be loaded.</p>}
        </Kpi>

        <Kpi label="All-time revenue" icon={<Landmark />} className="sm:col-span-2 xl:col-span-1">
          {allTime.isPending ? (
            <Skeleton className="mt-3 h-10 w-48" />
          ) : (
            <p className="mt-3 font-display text-3xl font-bold text-amber-500 tabular-nums">{vnd(allTime.data?.totalRevenue ?? 0)}</p>
          )}
          {allTime.data && (
            <p className="mt-1 text-sm text-slate-700">
              {formatNumber(allTime.data.totalSessions)} paid sessions since {allTime.data.startDate}
            </p>
          )}
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-700">
            <span>Cash<strong className="block font-mono text-sm text-slate-950">{vnd(allTimeOf('CASH'))}</strong></span>
            <span>VNPay / MoMo<strong className="block font-mono text-sm text-slate-950">{vnd(allTimeOf('QR_BANKING'))}</strong></span>
            <span>Wallet<strong className="block font-mono text-sm text-slate-950">{vnd(allTimeOf('RFID_WALLET'))}</strong></span>
          </div>
          {allTime.isError && <p className="mt-2 text-xs text-rose-700">Revenue could not be loaded.</p>}
        </Kpi>
      </div>

      <LiveLotModel lots={assigned.data ?? [lot]} lotId={lot.id} onLotChange={setLotId} />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-slate-950">Live Bay &amp; Zone Capacity</h2>
              <p className="mt-0.5 text-sm text-slate-700">Real-time occupancy per zone from the gate and sensor feed.</p>
            </div>
          </div>

          <ul className="mt-5 space-y-3">
            {occupancyQuery.isPending && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            {!occupancyQuery.isPending && !live?.zones.length && (
              <li className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-600">No live zone data for this lot yet.</li>
            )}
            {live?.zones.map((zone) => {
              const percent = zone.totalBays ? (zone.occupiedBays / zone.totalBays) * 100 : 0
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
                        {formatNumber(zone.occupiedBays)} / {formatNumber(zone.totalBays)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-200">
                    <div
                      className={cn('h-full rounded-full transition-[width] duration-500', tone === 'rose' ? 'bg-rose-400' : tone === 'amber' ? 'bg-amber-500' : 'bg-indigo-700')}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-600">{formatNumber(zone.freeBays)} bays free</p>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold text-slate-950">Reservations Today</h2>
              <p className="mt-0.5 text-sm text-slate-700">Scheduled pre-booked parking bays.</p>
            </div>
            {reservationsQuery.isPending ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <span className="font-mono text-lg font-bold text-indigo-700">
                {formatNumber(bookings)} {bookings === 1 ? 'booking' : 'bookings'}
              </span>
            )}
          </div>
          {reservationsQuery.isPending ? (
            <Skeleton className="mt-4 h-16 rounded-xl" />
          ) : (
            <div className="mt-4 grid grid-cols-3 divide-x divide-slate-200 rounded-xl bg-slate-50 py-3 text-center text-xs text-slate-700">
              <span><strong className="block text-lg text-slate-950">{checkedIn}</strong>Checked in</span>
              <span><strong className="block text-lg text-amber-500">{withinHour}</strong>Within 1 hour</span>
              <span><strong className="block text-lg text-slate-950">{upcoming.length}</strong>Upcoming</span>
            </div>
          )}
          {reservationsQuery.isError && <p className="mt-3 text-sm text-rose-700">Reservations could not be loaded.</p>}
          {reservationsQuery.isSuccess && !next && <p className="mt-4 text-sm text-slate-600">No more arrivals expected today.</p>}
          {next && (
            <div className="mt-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <p className="flex items-center justify-between text-xs font-bold tracking-wider text-amber-500 uppercase">
                Next incoming arrival
                <span className="font-mono text-slate-700 normal-case">{formatClock(Date.parse(next.arrivalTime))}</span>
              </p>
              <p className="mt-2 flex items-center gap-2 font-mono text-lg font-bold text-slate-950">
                {next.plateNumber ?? 'No plate'}
                {next.slotCode && <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-700">Bay {next.slotCode}</span>}
              </p>
              <p className="text-sm text-slate-700">{[next.vehicleLabel, next.code].filter(Boolean).join(' • ')}</p>
            </div>
          )}
          <ul className="mt-3 space-y-1.5 text-sm">
            {upcoming.slice(1, 4).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 text-slate-700">
                <span>
                  <strong className="font-mono text-slate-950">{r.plateNumber ?? 'No plate'}</strong>
                  {r.slotCode && ` • Bay ${r.slotCode}`}
                </span>
                <span className="font-mono text-xs">{formatClock(Date.parse(r.arrivalTime))}</span>
              </li>
            ))}
          </ul>
          <Link to="/management/reservations" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:underline">
            All reservations <ArrowRight className="size-4" aria-hidden />
          </Link>
        </section>
      </div>
    </div>
  )
}

/** /management/console: the Manager's home for the selected lot. */
export default function ManagerConsolePage() {
  return <WithManagerLot>{(lot) => <Console lot={lot} />}</WithManagerLot>
}
