import { useMemo } from 'react'
import { Bike, Car, Rotate3d } from 'lucide-react'
import { GaragePreview } from '@/components/customer/garage/GaragePreview'
import { findTemplate, liveFloorStats, templateForLot } from '@/components/customer/garage/garageModel'
import { Skeleton } from '@/components/ui/skeleton'
import { useParkingCapacity } from '@/hooks/useParking'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AssignedParkingLotDTO } from '@/types/parking.dto'

/**
 * Read-only 3D model of an employee's assigned lot, mirroring its live occupancy (the customer
 * map without booking). Shows lot tabs when the employee has several lots.
 */
export function LiveLotModel({
  lots,
  lotId,
  onLotChange,
  className,
}: {
  lots: AssignedParkingLotDTO[]
  lotId: string | undefined
  onLotChange?: (lotId: string) => void
  className?: string
}) {
  const capacity = useParkingCapacity()
  const lot = lots.find((l) => l.id === lotId) ?? lots[0]
  const live = capacity.data?.find((c) => c.id === lot?.id)
  const template = lot ? (findTemplate(lot.layoutTemplate) ?? templateForLot({ id: lot.id, layoutTemplate: live?.layoutTemplate })) : undefined
  const floorStats = useMemo(() => (live && template ? liveFloorStats(live, template) : []), [live, template])

  return (
    <section className={cn('rounded-2xl bg-white p-5 ring-1 ring-slate-200', className)} aria-labelledby="lot-3d-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="lot-3d-title" className="flex items-center gap-2 font-display text-xl font-semibold text-slate-950">
            <Rotate3d className="size-5 text-indigo-700" aria-hidden /> Live 3D lot model
          </h2>
          <p className="mt-0.5 text-sm text-slate-700">
            {lot ? `${lot.name} · ${template?.name ?? ''}` : 'Your assigned parking lot'} — monitoring only, refreshed from the gate and sensor feed.
          </p>
        </div>
        {lots.length > 1 && onLotChange && (
          <div role="tablist" aria-label="Assigned parking lot" className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
            {lots.map((l) => (
              <button
                key={l.id}
                type="button"
                role="tab"
                aria-selected={l.id === lot?.id}
                onClick={() => onLotChange(l.id)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-semibold transition-colors',
                  l.id === lot?.id ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-700 hover:text-slate-950',
                )}
              >
                {l.code}
              </button>
            ))}
          </div>
        )}
      </div>

      {!lot && <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-600">No parking lot assigned yet.</p>}
      {lot && capacity.isPending && <Skeleton className="mt-4 h-[24rem] rounded-xl" />}
      {lot && !capacity.isPending && !live && (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-600">No live occupancy data for this lot yet.</p>
      )}
      {lot && live && template && (
        <>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Free bays per level">
            {template.floors.map((kind, i) => {
              const s = floorStats[i]
              const free = s ? Math.max(0, s.total - s.occupied) : 0
              const Icon = kind === 'car' ? Car : Bike
              return (
                <li key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs ring-1 ring-slate-200">
                  <Icon className="size-4 shrink-0 text-indigo-700" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <strong className="text-slate-950">L{i + 1}</strong> <span className="text-slate-600">{s?.label}</span>
                  </span>
                  <span className="font-mono font-bold text-slate-950 tabular-nums">
                    {formatNumber(free)}/{formatNumber(s?.total ?? 0)}
                  </span>
                </li>
              )
            })}
          </ul>
          <div className="mt-3">
            <GaragePreview key={lot.id} template={template} floorStats={floorStats} seed={lot.id} />
          </div>
        </>
      )}
    </section>
  )
}
