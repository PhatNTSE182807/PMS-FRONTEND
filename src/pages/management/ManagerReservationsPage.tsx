import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeftRight, CalendarDays, CarFront, Clock, Download, Search, ShieldCheck, TimerOff } from 'lucide-react'
import { Kpi, WithManagerLot } from '@/components/features/manager/ManagerBits'
import { formatClock, formatMinutes, vnd } from '@/components/features/manager/managerFormat'
import { DemoTag, PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/form-controls'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useNow } from '@/hooks/useNow'
import { cn } from '@/lib/utils'
import { demoReservations, type DemoReservation, type ReservationStatus } from '@/mocks/managerOps.mock'
import type { ManagedLot, SlotState } from '@/types/lot-management.dto'

type Filter = 'ALL' | ReservationStatus

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'All bookings' },
  { value: 'CONFIRMED', label: 'Confirmed / en route' },
  { value: 'CHECKED_IN', label: 'Checked in' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled / refunded' },
  { value: 'NO_SHOW', label: 'No-show' },
]

const SLOT_DOT: Record<SlotState, string> = {
  Available: 'bg-emerald-600',
  Reserved: 'bg-indigo-700',
  Occupied: 'bg-amber-500',
  Maintenance: 'bg-rose-500',
}

/** Bays shown in the matrix: the lot's real slots when it has zones configured, else a sample floor. */
function useBays(lot: ManagedLot) {
  return useMemo(() => {
    const real = lot.zones.flatMap((z) => z.slots.map((s) => ({ code: s.code, zone: z.name, status: s.status })))
    if (real.length) return { bays: real.slice(0, 24), demo: false }
    const states: SlotState[] = ['Occupied', 'Occupied', 'Reserved', 'Maintenance', 'Occupied', 'Occupied', 'Occupied', 'Reserved', 'Available', 'Occupied', 'Occupied', 'Reserved']
    return {
      bays: states.map((status, i) => ({ code: `B2-${String(i + 1).padStart(2, '0')}`, zone: 'Floor B2', status })),
      demo: true,
    }
  }, [lot])
}

function statusCell(r: DemoReservation, now: number) {
  switch (r.status) {
    case 'CONFIRMED': {
      const minutes = (r.start - now) / 60_000
      if (minutes <= 0) return <span className="text-amber-500">In window ({formatMinutes((r.end - now) / 60_000)} left)</span>
      return <span className="text-slate-700">Arrives in {formatMinutes(minutes)}</span>
    }
    case 'CHECKED_IN':
      return <span className="text-emerald-700">Checked in {formatClock(r.start)}</span>
    case 'COMPLETED':
      return <span className="text-slate-700">Completed</span>
    case 'CANCELLED':
      return <span className="text-slate-500">Cancelled by user</span>
    case 'NO_SHOW':
      return <span className="text-rose-700">No-show (released)</span>
  }
}

function Reservations({ lot }: { lot: ManagedLot }) {
  const now = useNow(30_000)
  const [rows, setRows] = useState(demoReservations)
  const [filter, setFilter] = useState<Filter>('ALL')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(rows[0]?.id)
  const { bays, demo: demoBays } = useBays(lot)
  const vacant = bays.filter((b) => b.status === 'Available')
  const [target, setTarget] = useState<string>()

  const count = (f: Filter) => (f === 'ALL' ? rows.length : rows.filter((r) => r.status === f).length)
  const q = query.trim().toLowerCase()
  const visible = rows.filter(
    (r) => (filter === 'ALL' || r.status === filter) && (!q || [r.id, r.plate, r.phone, r.customer].some((v) => v.toLowerCase().includes(q))),
  )
  const selected = rows.find((r) => r.id === selectedId)
  const pendingArrival = rows.filter((r) => r.status === 'CONFIRMED' && r.start <= now + 60 * 60_000).length

  const reassign = () => {
    if (!selected || !target) return
    setRows((list) => list.map((r) => (r.id === selected.id ? { ...r, bay: target } : r)))
    toast.success(`#${selected.id} moved to bay ${target}`, { description: 'Demo only: the gate cameras are updated once the booking API exists.' })
    setTarget(undefined)
  }

  const exportCsv = () => {
    const quote = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const lines = visible.map((r) => [r.id, r.customer, r.phone, r.plate, r.vehicle, r.bay, formatClock(r.start), formatClock(r.end), r.deposit, r.status].map(quote).join(','))
    const blob = new Blob(['﻿' + ['Booking,Customer,Phone,Plate,Vehicle,Bay,From,To,Deposit,Status', ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' })
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
            <span>Console matrix</span> / <span className="text-amber-500">Allocations</span> <DemoTag />
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
          <p className="mt-3 font-display text-4xl font-bold text-slate-950">{rows.length} <span className="text-base font-medium text-slate-700">slots</span></p>
        </Kpi>
        <Kpi label="Checked in / active" icon={<CarFront />} className="border-b-2 border-amber-500">
          <p className="mt-3 font-display text-4xl font-bold text-amber-500">{count('CHECKED_IN')} <span className="text-base font-medium text-slate-950">vehicles</span></p>
        </Kpi>
        <Kpi label="Pending arrival window" icon={<Clock />}>
          <p className="mt-3 font-display text-4xl font-bold text-slate-950">{pendingArrival} <span className="text-base font-medium text-slate-700">within 1 hour</span></p>
        </Kpi>
        <Kpi label="No-show / expired today" icon={<TimerOff />}>
          <p className="mt-3 font-display text-4xl font-bold text-rose-400">{count('NO_SHOW')} <span className="text-base font-medium text-slate-950">released</span></p>
          <p className="mt-1 text-xs text-slate-600">Deposit forfeited, bay back in the pool.</p>
        </Kpi>
      </div>

      <Card className="space-y-3 p-3">
        <div role="tablist" aria-label="Filter bookings" className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
                filter === f.value ? 'bg-[#124e66] text-indigo-800' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950',
              )}
            >
              {f.label} <span className="font-mono text-xs text-amber-500">({count(f.value)})</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by booking ID, plate or phone number…" className="h-10 pl-9" aria-label="Search bookings" />
        </div>
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {['Booking ID', 'Customer', 'Vehicle', 'Assigned bay', 'Arrival window', 'Deposit'].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => {
                const isSelected = r.id === selectedId
                const cancelled = r.status === 'CANCELLED' || r.status === 'NO_SHOW'
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
                      <p className={cn('font-semibold text-slate-950', cancelled && 'line-through')}>{r.customer}</p>
                      <p className="font-mono text-xs text-slate-600">{r.phone}</p>
                    </TableCell>
                    <TableCell>
                      <span className="rounded bg-[#060f16] px-1.5 py-0.5 font-mono text-sm font-bold text-amber-500">{r.plate}</span>
                      <p className="mt-1 text-xs text-slate-700">{r.vehicle}</p>
                    </TableCell>
                    <TableCell>
                      <span className="rounded bg-slate-100 px-2 py-1 font-mono text-sm font-bold text-indigo-700">Bay {r.bay}</span>
                      <p className="mt-1 text-xs text-slate-700">{r.floor}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-mono text-sm text-slate-950">{formatClock(r.start)} – {formatClock(r.end)}</p>
                      <p className="text-xs">{statusCell(r, now)}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-mono text-sm font-bold text-slate-950">{vnd(r.deposit)}</p>
                      <p className="text-xs text-slate-600">{r.status === 'CANCELLED' ? 'Refunded 100%' : r.payment}</p>
                    </TableCell>
                  </TableRow>
                )
              })}
              {visible.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="py-10 text-center text-slate-600">No bookings match this filter.</TableCell>
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
                  <Button variant="gold" className="flex-1" disabled={!target || selected.status !== 'CONFIRMED'} onClick={reassign}>
                    Confirm reassignment
                  </Button>
                  <Button variant="outline" onClick={() => setTarget(undefined)} disabled={!target}>
                    Clear
                  </Button>
                </div>
                {selected.status !== 'CONFIRMED' && <p className="mt-2 text-xs text-slate-600">Only upcoming bookings can be moved.</p>}
                <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
                  <ShieldCheck className="size-4 shrink-0" aria-hidden />
                  A goodwill discount is applied automatically when a booking is moved because its bay was obstructed.
                </p>
              </>
            ) : (
              <p className="mt-4 text-sm text-slate-600">Select a booking to reassign its bay.</p>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-slate-950">Slot mini-matrix</h2>
              {demoBays ? <DemoTag /> : <span className="text-xs text-slate-600">{lot.zones.length} zones</span>}
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {bays.map((b) => (
                <span
                  key={b.code}
                  title={`${b.code}: ${b.status}`}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg py-2 font-mono text-[11px] text-slate-800 ring-1 ring-slate-200',
                    b.status === 'Maintenance' ? 'bg-rose-50' : target === b.code ? 'bg-indigo-100' : 'bg-slate-50',
                  )}
                >
                  {b.code}
                  <span className={cn('size-1.5 rounded-full', SLOT_DOT[b.status])} aria-hidden />
                </span>
              ))}
            </div>
            <p className="mt-3 flex flex-wrap gap-3 text-xs text-slate-700">
              {(Object.keys(SLOT_DOT) as SlotState[]).map((s) => (
                <span key={s} className="flex items-center gap-1"><span className={cn('size-1.5 rounded-full', SLOT_DOT[s])} />{s}</span>
              ))}
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

/** /management/reservations. Bookings are demo data until the booking API exists. */
export default function ManagerReservationsPage() {
  return <WithManagerLot>{(lot) => <Reservations lot={lot} />}</WithManagerLot>
}
