import { Bike, Car, Layers, MapPin, UserRound, Zap, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatNumber } from '@/lib/format'
import { occupancyRate } from '@/lib/occupancy'
import { cn } from '@/lib/utils'
import type { CapacityVehicleType, ParkingLotCapacityDTO, VehicleCapacityDetail } from '@/types/parking.dto'
import { OccupancyBar, OccupancyGauge } from './OccupancyGauge'
import { LOT_STATUS_STYLES } from './occupancyStyles'

const VEHICLE_ROWS: Record<CapacityVehicleType, { label: string; icon: LucideIcon }> = {
  CAR: { label: 'Car zone', icon: Car },
  MOTORBIKE: { label: 'Motorbike zone', icon: Bike },
  EV_CHARGING: { label: 'EV charging', icon: Zap },
}

function CapacityRow({ detail }: { detail: VehicleCapacityDetail }) {
  const { label, icon: Icon } = VEHICLE_ROWS[detail.vehicleType]
  const isCharger = detail.vehicleType === 'EV_CHARGING'
  const rate = occupancyRate(detail.occupiedSlots, detail.totalSlots)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 font-medium text-slate-700">
          <Icon className="size-4 text-slate-400" aria-hidden />
          {label}
        </span>
        <span className="text-slate-900 tabular-nums">
          {formatNumber(detail.occupiedSlots)} / {formatNumber(detail.totalSlots)} {isCharger ? 'chargers' : 'slots'}
        </span>
      </div>
      <OccupancyBar percentage={rate} />
      <p className="text-xs text-slate-500">
        {isCharger ? (
          <>{formatNumber(detail.occupiedSlots)} chargers in use · {formatNumber(detail.availableSlots)} free</>
        ) : (
          <>
            <span className="font-medium text-slate-700">{formatNumber(detail.availableSlots)}</span> slots free
            {detail.maintenanceSlots > 0 && ` · ${formatNumber(detail.maintenanceSlots)} under maintenance`}
          </>
        )}
      </p>
    </div>
  )
}

interface ParkingLotCardProps {
  lot: ParkingLotCapacityDTO
  onShowZones: (lot: ParkingLotCapacityDTO) => void
}

export function ParkingLotCard({ lot, onShowZones }: ParkingLotCardProps) {
  const status = LOT_STATUS_STYLES[lot.status]
  const isFull = lot.status === 'FULL' || lot.overallOccupancyPercentage >= 100

  return (
    <Card className={cn('flex flex-col transition-shadow hover:shadow-md', isFull && 'ring-2 ring-rose-300')}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">{lot.name}</h2>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-500">
            <MapPin className="mt-px size-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-2">{lot.address}</span>
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <UserRound className="size-3.5 shrink-0" aria-hidden />
            Shift manager: <span className="font-medium text-slate-700">{lot.managerOnDuty}</span>
          </p>
        </div>
        <span className="shrink-0 font-mono text-[11px] text-slate-400">{lot.code}</span>
      </div>

      <div className="flex flex-1 flex-col gap-5 p-5 sm:flex-row sm:items-center">
        <OccupancyGauge percentage={lot.overallOccupancyPercentage} isFull={isFull} />
        <div className="flex-1 space-y-4">
          {lot.capacityByVehicle.map((detail) => (
            <CapacityRow key={detail.vehicleType} detail={detail} />
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 px-5 py-3">
        <Button variant="ghost" size="sm" className="-ml-2 text-indigo-600 hover:text-indigo-700" onClick={() => onShowZones(lot)}>
          <Layers />
          View zone details
        </Button>
      </div>
    </Card>
  )
}
