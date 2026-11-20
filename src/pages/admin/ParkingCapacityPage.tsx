import { useMemo, useState, type ReactNode } from 'react'
import { Building2, CircleParking, Gauge, ParkingMeter, RefreshCw, SquareParking } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { OccupancyBar } from '@/components/features/capacity/OccupancyGauge'
import { ParkingLotCard } from '@/components/features/capacity/ParkingLotCard'
import { ZoneDetailsDialog } from '@/components/features/capacity/ZoneDetailsDialog'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { useParkingCapacity } from '@/hooks/useParking'
import { formatNumber } from '@/lib/format'
import { occupancyRate, parkingSlots } from '@/lib/occupancy'
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
  const [zoneLotId, setZoneLotId] = useState<string | null>(null)

  const lots = useMemo(() => capacity.data ?? [], [capacity.data])
  // Looked up on every render, so the open dialog follows live updates.
  const zoneLot = lots.find((lot) => lot.id === zoneLotId) ?? null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parking Lot Performance"
        description="Monitor the real-time occupancy of every lot and zone."
        actions={
          <Button variant="outline" onClick={() => capacity.refetch()} disabled={capacity.isFetching}>
            <RefreshCw className={cn(capacity.isFetching && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      {capacity.isPending ? (
        <CapacitySkeleton />
      ) : capacity.isError && lots.length === 0 ? (
        <Card>
          <ErrorState message={getErrorMessage(capacity.error)} onRetry={() => capacity.refetch()} />
        </Card>
      ) : (
        <>
          <SystemBanner lots={lots} />

          {lots.length === 0 ? (
            <Card>
              <EmptyState icon={Gauge} title="No parking lots yet" description="Parking lots appear here once they are created." />
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
              {lots.map((lot) => (
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
