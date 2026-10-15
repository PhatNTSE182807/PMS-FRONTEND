import { useMemo, useState, type ReactNode } from 'react'
import { Activity, Building2, CircleParking, Gauge, ParkingMeter, RefreshCw, SquareParking, WifiOff } from 'lucide-react'
import { parkingService } from '@/api/parking.service'
import { getErrorMessage } from '@/api/apiError'
import { OccupancyBar } from '@/components/features/capacity/OccupancyGauge'
import { ParkingLotCard } from '@/components/features/capacity/ParkingLotCard'
import { ZoneDetailsDialog } from '@/components/features/capacity/ZoneDetailsDialog'
import { CAPACITY_FILTERS, type CapacityFilter } from '@/components/features/capacity/occupancyStyles'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { useNow } from '@/hooks/useNow'
import { SIMULATION_TICK_MS, useCapacitySimulation, useParkingCapacity } from '@/hooks/useParking'
import { formatNumber, formatRelativeTime } from '@/lib/format'
import { occupancyLevel, occupancyRate, parkingSlots } from '@/lib/occupancy'
import { cn } from '@/lib/utils'
import type { ParkingLotCapacityDTO } from '@/types/parking.dto'

function SystemStat({ icon: Icon, label, value, children }: {
  icon: typeof Building2
  label: string
  value: string
  children?: ReactNode
}) {
  return (
    <div className="flex items-start gap-3 p-5">
      <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
        {children}
      </div>
    </div>
  )
}

function SystemBanner({ lots }: { lots: ParkingLotCapacityDTO[] }) {
  const active = lots.filter((lot) => lot.status !== 'CLOSED')
  const totals = parkingSlots(active.flatMap((lot) => lot.capacityByVehicle))
  const rate = occupancyRate(totals.occupied, totals.total)

  return (
    <Card className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4 xl:divide-x">
      <SystemStat icon={Building2} label="Active lots" value={`${active.length} / ${lots.length}`} />
      <SystemStat icon={SquareParking} label="Total capacity" value={formatNumber(totals.total)} />
      <SystemStat icon={CircleParking} label="In use" value={formatNumber(totals.occupied)}>
        <div className="mt-2 flex items-center gap-2">
          <OccupancyBar percentage={rate} className="flex-1" />
          <span className="text-xs font-medium text-slate-600 tabular-nums">{rate.toFixed(1).replace('.', ',')}%</span>
        </div>
      </SystemStat>
      <SystemStat icon={ParkingMeter} label="Available" value={formatNumber(totals.available)} />
    </Card>
  )
}

function CapacitySkeleton() {
  return (
    <>
      <Skeleton className="h-28 rounded-xl" />
      <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-80 rounded-xl" />
        ))}
      </div>
    </>
  )
}

export default function ParkingCapacityPage() {
  const capacity = useParkingCapacity()
  const canSimulate = parkingService.canSimulate()
  const [isSimulating, setIsSimulating] = useState(false)
  const [filter, setFilter] = useState<CapacityFilter>('ALL')
  const [zoneLotId, setZoneLotId] = useState<string | null>(null)
  const now = useNow(1000)

  useCapacitySimulation(isSimulating)

  const lots = useMemo(() => capacity.data ?? [], [capacity.data])
  const counts = useMemo(() => {
    const result: Record<CapacityFilter, number> = { ALL: lots.length, AVAILABLE: 0, HIGH: 0, CRITICAL: 0 }
    for (const lot of lots) result[occupancyLevel(lot.overallOccupancyPercentage)]++
    return result
  }, [lots])
  const visibleLots = filter === 'ALL' ? lots : lots.filter((lot) => occupancyLevel(lot.overallOccupancyPercentage) === filter)
  // Looked up on every render, so the open dialog follows live updates.
  const zoneLot = lots.find((lot) => lot.id === zoneLotId) ?? null

  const isLive = !capacity.isError

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parking Lot Capacity"
        description="Monitor the real-time occupancy of every lot and zone."
        actions={
          <Button variant="outline" onClick={() => capacity.refetch()} disabled={capacity.isFetching}>
            <RefreshCw className={cn(capacity.isFetching && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      {/* Real-time control bar */}
      <Card className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-3 px-2">
          <span className="relative flex size-2.5" aria-hidden>
            {isLive && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
            <span className={cn('relative inline-flex size-2.5 rounded-full', isLive ? 'bg-emerald-500' : 'bg-rose-500')} />
          </span>
          <div className="text-sm" aria-live="polite">
            <span className="font-medium text-slate-900">{isLive ? 'Live Updates' : 'Disconnected'}</span>
            <span className="text-slate-500">
              {' · '}
              {capacity.dataUpdatedAt ? `Updated ${formatRelativeTime(capacity.dataUpdatedAt, now)}` : 'Loading…'}
            </span>
          </div>
          {!isLive && <WifiOff className="size-4 text-rose-500" aria-hidden />}
        </div>

        {canSimulate && (
          <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200 lg:ml-2">
            <button
              type="button"
              role="switch"
              aria-checked={isSimulating}
              onClick={() => setIsSimulating((v) => !v)}
              className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', isSimulating ? 'bg-indigo-600' : 'bg-slate-300')}
            >
              <span
                className={cn(
                  'absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform',
                  isSimulating && 'translate-x-4',
                )}
              />
            </button>
            <Activity className={cn('size-4', isSimulating ? 'text-indigo-600' : 'text-slate-400')} aria-hidden />
            Simulate traffic ({SIMULATION_TICK_MS / 1000}s)
          </label>
        )}

        <div role="group" aria-label="Filter by occupancy" className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 lg:ml-auto">
          {CAPACITY_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                filter === option.value ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:text-slate-900',
              )}
            >
              {option.label}
              <span className="rounded-full bg-slate-200/70 px-1.5 text-xs text-slate-600 tabular-nums">{counts[option.value]}</span>
            </button>
          ))}
        </div>
      </Card>

      {capacity.isPending ? (
        <CapacitySkeleton />
      ) : capacity.isError && lots.length === 0 ? (
        <Card>
          <ErrorState message={getErrorMessage(capacity.error)} onRetry={() => capacity.refetch()} />
        </Card>
      ) : (
        <>
          <SystemBanner lots={lots} />

          {visibleLots.length === 0 ? (
            <Card>
              <EmptyState
                icon={Gauge}
                title="No parking lots at this level"
                description="Pick another occupancy level or show all lots."
                action={
                  <Button variant="outline" onClick={() => setFilter('ALL')}>
                    Show all
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
              {visibleLots.map((lot) => (
                <ParkingLotCard key={lot.id} lot={lot} onShowZones={(selected) => setZoneLotId(selected.id)} />
              ))}
            </div>
          )}
        </>
      )}

      <ZoneDetailsDialog lot={zoneLot} onOpenChange={(open) => !open && setZoneLotId(null)} />
    </div>
  )
}
