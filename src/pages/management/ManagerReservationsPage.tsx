import { useState } from 'react'
import { CalendarDays, CarFront, Clock, Download, Search, TimerOff } from 'lucide-react'
import { Kpi, WithManagerLot } from '@/components/features/manager/ManagerBits'
import { formatClock, formatMinutes, vnd } from '@/components/features/manager/managerFormat'
import { arrivesWithinHour, dayRange, isAwaitingArrival, VOID_RESERVATION } from '@/components/features/manager/managerReservations'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/form-controls'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useNow } from '@/hooks/useNow'
import { useLotReservations } from '@/hooks/useReservations'
import { cn } from '@/lib/utils'
import type { ManagedLot } from '@/types/lot-management.dto'
import type { ReservationDTO, ReservationStatus } from '@/types/operations.dto'

interface Filter {
  label: string
  /** Statuses the tab shows; every booking when left out. */
  statuses?: ReservationStatus[]
}

const FILTERS: Filter[] = [
  { label: 'All bookings' },
  { label: 'Awaiting deposit', statuses: ['PendingDeposit'] },
  { label: 'Confirmed / en route', statuses: ['Confirmed'] },
  { label: 'Checked in', statuses: ['CheckedIn'] },
  { label: 'Completed', statuses: ['Completed'] },
  { label: 'Cancelled / refunded', statuses: ['Cancelled', 'LotCancelled'] },
  { label: 'No-show / expired', statuses: ['NoShow', 'Expired'] },
]

const matchesFilter = (filter: Filter, status: ReservationStatus) => !filter.statuses || filter.statuses.includes(status)

function depositNote(r: ReservationDTO): string {
  if (!r.hasDeposit) return 'No deposit'
  if (r.refundAmount > 0) return `Refunded ${vnd(r.refundAmount)}`
  switch (r.status) {
    case 'PendingDeposit':
      return 'Awaiting payment'
    case 'Expired':
      return 'Not paid'
    case 'NoShow':
      return 'Forfeited'
    case 'Cancelled':
      return 'Not refunded'
    default:
      return 'Paid'
  }
}

/** One table row. */
function toRow(r: ReservationDTO) {
  return {
    id: r.code,
    plate: r.plateNumber ?? 'No plate',
    vehicle: r.vehicleLabel ?? '',
    bay: r.slotCode ?? '-',
    floor: r.zoneName ?? '',
    from: Date.parse(r.checkInFrom),
    start: Date.parse(r.arrivalTime),
    end: Date.parse(r.checkInUntil),
    deposit: r.depositAmount,
    depositNote: depositNote(r),
    status: r.status,
  }
}

function statusCell(r: ReturnType<typeof toRow>, now: number) {
  switch (r.status) {
    case 'PendingDeposit':
      return <span className="text-amber-500">Awaiting deposit</span>
    case 'Confirmed': {
      const minutes = (r.start - now) / 60_000
      if (minutes <= 0) return <span className="text-amber-500">In window ({formatMinutes((r.end - now) / 60_000)} left)</span>
      return <span className="text-slate-700">Arrives in {formatMinutes(minutes)}</span>
    }
    case 'CheckedIn':
      return <span className="text-emerald-700">Checked in</span>
    case 'Completed':
      return <span className="text-slate-700">Completed</span>
    case 'Cancelled':
      return <span className="text-slate-500">Cancelled</span>
    case 'LotCancelled':
      return <span className="text-slate-500">Cancelled by the lot</span>
    case 'Expired':
      return <span className="text-rose-700">Expired (deposit not paid)</span>
    case 'NoShow':
      return <span className="text-rose-700">No-show (released)</span>
  }
}

function Reservations({ lot }: { lot: ManagedLot }) {
  const now = useNow(30_000)
  const { from, to } = dayRange(now)
  const reservationsQuery = useLotReservations(lot.id, from, to)
  const reservations = reservationsQuery.data ?? []
  const rows = reservations.map(toRow)
  const [filter, setFilter] = useState(FILTERS[0])
  const [query, setQuery] = useState('')

  const count = (f: Filter) => rows.filter((r) => matchesFilter(f, r.status)).length
  const q = query.trim().toLowerCase()
  const visible = rows.filter((r) => matchesFilter(filter, r.status) && (!q || [r.id, r.plate].some((v) => v.toLowerCase().includes(q))))
  const preBookings = reservations.filter((r) => !VOID_RESERVATION.includes(r.status)).length
  const checkedIn = reservations.filter((r) => r.status === 'CheckedIn').length
  const pendingArrival = reservations.filter((r) => isAwaitingArrival(r, now) && arrivesWithinHour(r, now)).length
  const released = reservations.filter((r) => r.status === 'NoShow' || r.status === 'Expired').length

  const exportCsv = () => {
    const quote = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const lines = visible.map((r) => [r.id, r.plate, r.vehicle, r.bay, formatClock(r.from), formatClock(r.end), r.deposit, r.status].map(quote).join(','))
    const blob = new Blob(['﻿' + ['Booking,Plate,Vehicle,Bay,From,To,Deposit,Status', ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `bookings-${lot.code}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <span>Console matrix</span> / <span className="text-amber-500">Allocations</span>
          </>
        }
        title="Facility Reservations & Slot Allocations"
        description={`${lot.name} • Active booking operations`}
        actions={
          <Button variant="outline" size="lg" onClick={exportCsv} disabled={!visible.length}>
            <Download /> Export booking manifest (CSV)
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Today's pre-bookings" icon={<CalendarDays />}>
          {reservationsQuery.isPending ? (
            <Skeleton className="mt-3 h-10 w-32" />
          ) : (
            <p className="mt-3 font-display text-4xl font-bold text-slate-950">{preBookings} <span className="text-base font-medium text-slate-700">slots</span></p>
          )}
        </Kpi>
        <Kpi label="Checked in / active" icon={<CarFront />} className="border-b-2 border-amber-500">
          {reservationsQuery.isPending ? (
            <Skeleton className="mt-3 h-10 w-32" />
          ) : (
            <p className="mt-3 font-display text-4xl font-bold text-amber-500">{checkedIn} <span className="text-base font-medium text-slate-950">vehicles</span></p>
          )}
        </Kpi>
        <Kpi label="Pending arrival window" icon={<Clock />}>
          {reservationsQuery.isPending ? (
            <Skeleton className="mt-3 h-10 w-32" />
          ) : (
            <p className="mt-3 font-display text-4xl font-bold text-slate-950">{pendingArrival} <span className="text-base font-medium text-slate-700">within 1 hour</span></p>
          )}
        </Kpi>
        <Kpi label="No-show / expired today" icon={<TimerOff />}>
          {reservationsQuery.isPending ? (
            <Skeleton className="mt-3 h-10 w-32" />
          ) : (
            <p className="mt-3 font-display text-4xl font-bold text-rose-400">{released} <span className="text-base font-medium text-slate-950">released</span></p>
          )}
          <p className="mt-1 text-xs text-slate-600">The bay went back in the pool.</p>
        </Kpi>
      </div>

      <Card className="space-y-3 p-3">
        <div role="tablist" aria-label="Filter bookings" className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
                filter === f ? 'bg-[#124e66] text-indigo-800' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950',
              )}
            >
              {f.label} <span className="font-mono text-xs text-amber-500">({count(f)})</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by booking ID or plate…" className="h-10 pl-9" aria-label="Search bookings" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {['Booking ID', 'Vehicle', 'Assigned bay', 'Arrival window', 'Deposit'].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((r) => {
              const cancelled = VOID_RESERVATION.includes(r.status) || r.status === 'NoShow'
              return (
                <TableRow key={r.id} className={cn(cancelled && 'opacity-70')}>
                  <TableCell className="font-mono font-bold text-indigo-700">#{r.id}</TableCell>
                  <TableCell>
                    <span className="rounded bg-[#060f16] px-1.5 py-0.5 font-mono text-sm font-bold text-amber-500">{r.plate}</span>
                    <p className="mt-1 text-xs text-slate-700">{r.vehicle}</p>
                  </TableCell>
                  <TableCell>
                    <span className="rounded bg-slate-100 px-2 py-1 font-mono text-sm font-bold text-indigo-700">Bay {r.bay}</span>
                    <p className="mt-1 text-xs text-slate-700">{r.floor}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-mono text-sm text-slate-950">{formatClock(r.from)} – {formatClock(r.end)}</p>
                    <p className="text-xs">{statusCell(r, now)}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-mono text-sm font-bold text-slate-950">{vnd(r.deposit)}</p>
                    <p className="text-xs text-slate-600">{r.depositNote}</p>
                  </TableCell>
                </TableRow>
              )
            })}
            {reservationsQuery.isPending && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5}><Skeleton className="h-24 rounded-xl" /></TableCell>
              </TableRow>
            )}
            {reservationsQuery.isError && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="py-10 text-center text-rose-700">Reservations could not be loaded.</TableCell>
              </TableRow>
            )}
            {reservationsQuery.isSuccess && visible.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="py-10 text-center text-slate-600">No bookings match this filter.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <p className="border-t border-slate-200 px-4 py-3 text-sm text-slate-700">
          Showing <strong className="text-slate-950">{visible.length}</strong> of <strong className="text-slate-950">{rows.length}</strong> bookings
        </p>
      </Card>
    </div>
  )
}

/** /management/reservations. Today's bookings of the lot. A taken booked bay is handled by Staff in Exceptions & Alerts. */
export default function ManagerReservationsPage() {
  return <WithManagerLot>{(lot) => <Reservations lot={lot} />}</WithManagerLot>
}
