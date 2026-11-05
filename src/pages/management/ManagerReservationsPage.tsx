import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeftRight, CalendarDays, CarFront, Clock, Download, Search, ShieldCheck, TimerOff } from 'lucide-react'
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
import type { ManagedLot, SlotState } from '@/types/lot-management.dto'
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

/** Bays offered for reassignment: the lot's real slots when it has zones configured, else a sample floor. */
function useBays(lot: ManagedLot) {
  return useMemo(() => {
    const real = lot.zones.flatMap((z) => z.slots.map((s) => ({ code: s.code, zone: z.name, status: s.status })))
    if (real.length) return real.slice(0, 24)
    const states: SlotState[] = ['Occupied', 'Occupied', 'Reserved', 'Maintenance', 'Occupied', 'Occupied', 'Occupied', 'Reserved', 'Available', 'Occupied', 'Occupied', 'Reserved']
    return states.map((status, i) => ({ code: `B2-${String(i + 1).padStart(2, '0')}`, zone: 'Floor B2', status }))
  }, [lot])
}

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

/** One table row; `movedBays` holds the bays changed on this page, which are not saved yet. */
function toRow(r: ReservationDTO, movedBays: Record<string, string>) {
  return {
    id: r.code,
    plate: r.plateNumber ?? 'No plate',
    vehicle: r.vehicleLabel ?? '',
    bay: movedBays[r.code] ?? r.slotCode ?? '-',
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
  const [movedBays, setMovedBays] = useState<Record<string, string>>({})
  const rows = reservations.map((r) => toRow(r, movedBays))
  const [filter, setFilter] = useState(FILTERS[0])
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string>()
  const bays = useBays(lot)
  const vacant = bays.filter((b) => b.status === 'Available')
  const [target, setTarget] = useState<string>()

  const count = (f: Filter) => rows.filter((r) => matchesFilter(f, r.status)).length
  const q = query.trim().toLowerCase()
  const visible = rows.filter((r) => matchesFilter(filter, r.status) && (!q || [r.id, r.plate].some((v) => v.toLowerCase().includes(q))))
  const selected = rows.find((r) => r.id === selectedId) ?? rows[0]
  const preBookings = reservations.filter((r) => !VOID_RESERVATION.includes(r.status)).length
  const checkedIn = reservations.filter((r) => r.status === 'CheckedIn').length
  const pendingArrival = reservations.filter((r) => isAwaitingArrival(r, now) && arrivesWithinHour(r, now)).length
  const released = reservations.filter((r) => r.status === 'NoShow' || r.status === 'Expired').length

  const reassign = () => {
    if (!selected || !target) return
    setMovedBays((moved) => ({ ...moved, [selected.id]: target }))
    toast.success(`#${selected.id} moved to bay ${target}`, { description: 'Demo only: the gate cameras are updated once the booking API exists.' })
    setTarget(undefined)
  }

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

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
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
                const isSelected = r.id === selected?.id
                const cancelled = VOID_RESERVATION.includes(r.status) || r.status === 'NoShow'
                return (
                  <TableRow
                    key={r.id}
                    tabIndex={0}
                    aria-selected={isSelected}
                    onClick={() => setSelectedId(r.id)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSelectedId(r.id))}
                    className={cn('cursor-pointer', isSelected && 'bg-slate-100 hover:bg-slate-100', cancelled && 'opacity-70')}
                  >
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

        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-slate-950">
                <ArrowLeftRight className="size-5 text-amber-500" aria-hidden /> Bay Reassignment
              </h2>
              <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-700 uppercase">Node ops</span>
            </div>
            <p className="mt-2 text-sm text-slate-700">
              If a reserved bay is blocked or taken by another vehicle, move the booking to a vacant bay in one click.
            </p>

            {selected ? (
              <>
                <dl className="mt-4 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-slate-700">Active selection</dt><dd className="font-mono font-bold text-indigo-700">#{selected.id}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-700">Vehicle plate</dt><dd className="font-mono font-bold text-amber-500">{selected.plate}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-700">Current bay</dt><dd className="font-mono font-bold text-slate-950">Bay {selected.bay}</dd></div>
                </dl>
                <p className="mt-4 text-xs font-bold tracking-wider text-slate-800 uppercase">Select an alternative bay</p>
                <div className="mt-2 space-y-2" role="radiogroup" aria-label="Alternative bay">
                  {vacant.slice(0, 4).map((b) => (
                    <label key={b.code} className={cn('flex cursor-pointer items-center gap-3 rounded-lg p-3 ring-1', target === b.code ? 'bg-indigo-50 ring-indigo-300' : 'bg-slate-50 ring-slate-200 hover:bg-slate-100')}>
                      <input type="radio" name="bay" value={b.code} checked={target === b.code} onChange={() => setTarget(b.code)} className="accent-indigo-600" />
                      <span className="flex-1">
                        <span className="font-mono font-bold text-slate-950">Bay {b.code}</span>
                        <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 uppercase">Vacant</span>
                        <span className="block text-xs text-slate-600">{b.zone}</span>
                      </span>
                    </label>
                  ))}
                  {vacant.length === 0 && <p className="text-sm text-slate-600">No vacant bay right now.</p>}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="gold" className="flex-1" disabled={!target || selected.status !== 'Confirmed'} onClick={reassign}>
                    Confirm reassignment
                  </Button>
                  <Button variant="outline" onClick={() => setTarget(undefined)} disabled={!target}>
                    Clear
                  </Button>
                </div>
                {selected.status !== 'Confirmed' && <p className="mt-2 text-xs text-slate-600">Only upcoming bookings can be moved.</p>}
                <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
                  <ShieldCheck className="size-4 shrink-0" aria-hidden />
                  A goodwill discount is applied automatically when a booking is moved because its bay was obstructed.
                </p>
              </>
            ) : (
              <p className="mt-4 text-sm text-slate-600">Select a booking to reassign its bay.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

/** /management/reservations. Today's bookings of the lot; a bay reassignment is not saved until its API exists. */
export default function ManagerReservationsPage() {
  return <WithManagerLot>{(lot) => <Reservations lot={lot} />}</WithManagerLot>
}
