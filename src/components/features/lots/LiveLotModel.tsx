import { useMemo, type ReactNode } from 'react'
import { Bike, Car, Rotate3d } from 'lucide-react'
import { GarageFloorsView } from '@/components/customer/garage/GaragePreview'
import { buildTemplateGarage, findTemplate, liveFloorStats, templateForLot, type Bay } from '@/components/customer/garage/garageModel'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import type { AccountRole } from '@/types/identity.dto'
import { BaySessionPopup } from './BaySessionPopup'
import { useLotPlan2D } from '@/hooks/useLotLayout'
import { useLotRealtime } from '@/hooks/useLotRealtime'
import { useParkingCapacity } from '@/hooks/useParking'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AssignedParkingLotDTO } from '@/types/parking.dto'

/** Only these roles see who is parked in a bay (plate, customer, fee); everyone else gets the bay code on hover. */
const INSPECTING_ROLES: AccountRole[] = ['STAFF', 'MANAGER', 'ADMIN']

/** A vehicle is drawn in the bay: parked, at the barrier, or a walk-in counted in its zone. */
const hasVehicle = (bay: Bay) => bay.status === 'OCCUPIED'

const SOURCE_TEXT = {
  layout: 'live bay statuses from the gate and sensor feed',
  pushed: 'bay statuses pushed live (SignalR)',
  capacity: 'live zone occupancy (this lot has no bay layout yet)',
  model: 'no live bay data yet, showing the default model until an Admin picks one',
} as const

/**
 * Read-only 3D model of an employee's assigned lot (the customer map without booking). Every role sees the lot's
 * real bays first (published layout and bay statuses, so a vehicle is drawn in the bay it parked in). Only a lot
 * without a layout falls back to the live zone occupancy, whose counts are spread over a generated model; a lot
 * with neither still shows its building model with free bays. Shows lot tabs for several lots.
 */
export function LiveLotModel({
  lots,
  lotId,
  onLotChange,
  className,
  bayActions,
}: {
  lots: AssignedParkingLotDTO[]
  lotId: string | undefined
  onLotChange?: (lotId: string) => void
  className?: string
  /** Replaces the vehicle details popup with the caller's own (the Admin simulation acts on any bay). */
  bayActions?: {
    canSelect: (bay: Bay) => boolean
    hint: (bay: Bay) => string | null
    render: (bay: Bay, lotId: string, close: () => void) => ReactNode
  }
}) {
  const lot = lots.find((l) => l.id === lotId) ?? lots[0]
  const { user } = useAuth()
  const canInspect = user !== null && INSPECTING_ROLES.includes(user.role)
  const capacity = useParkingCapacity()
  const live = capacity.data?.find((c) => c.id === lot?.id)
  // Answered once (data or error). Not `!isPending`: a query that failed (Staff get 403 here) goes back to
  // pending on every refetch, which unmounted the model and dropped the SignalR channel every few seconds.
  const capacitySettled = capacity.data !== undefined || capacity.errorUpdateCount > 0
  // The real bays always come first. The counts-only occupancy (Admin and Manager can read it) used to win here,
  // which drew vehicles and reserved bays in made-up places.
  const planLotId = lot?.id
  const realtime = useLotRealtime(planLotId)
  const plan = useLotPlan2D(planLotId, 'slots', realtime.connected)
  const template = lot ? (findTemplate(lot.layoutTemplate) ?? templateForLot({ id: lot.id, layoutTemplate: live?.layoutTemplate })) : undefined

  const view = useMemo(() => {
    if (!lot || !template) return null
    if (plan.data?.floors.length) return { source: realtime.connected ? ('pushed' as const) : ('layout' as const), floors: plan.data.floors }
    if (live) return { source: 'capacity' as const, floors: buildTemplateGarage(template, liveFloorStats(live, template), lot.id) }
    return { source: 'model' as const, floors: buildTemplateGarage(template, [], lot.id) }
  }, [lot, template, live, plan.data, realtime.connected])
  // First load only: refetches (and retries after an error) keep the model on screen. The occupancy is only
  // waited for when the lot turns out to have no layout to draw.
  const planSettled = !plan.isLoading || plan.errorUpdateCount > 0
  const hasPlan = Boolean(plan.data?.floors.length)
  const loading = !planSettled || (!hasPlan && !capacitySettled)

  return (
    <section className={cn('rounded-2xl bg-white p-5 ring-1 ring-slate-200', className)} aria-labelledby="lot-3d-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="lot-3d-title" className="flex items-center gap-2 font-display text-xl font-semibold text-slate-950">
            <Rotate3d className="size-5 text-indigo-700" aria-hidden /> Live 3D lot model
          </h2>
          <p className="mt-0.5 text-sm text-slate-700">
            {lot ? lot.name : 'Your assigned parking lot'}
            {view && !loading && ` — monitoring only, ${SOURCE_TEXT[view.source]}.`}
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

      {!lot && (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-600">
          No parking lot assigned yet. Ask your Manager to assign you to a lot.
        </p>
      )}
      {lot && loading && <Skeleton className="mt-4 h-[24rem] rounded-xl" />}
      {lot && !loading && view && (
        <>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Free bays per level">
            {view.floors.map((f) => {
              const Icon = f.kind === 'car' ? Car : Bike
              return (
                <li key={f.index} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs ring-1 ring-slate-200">
                  <Icon className="size-4 shrink-0 text-indigo-700" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <strong className="text-slate-950">{f.level}</strong> <span className="text-slate-600">{f.zoneLabel || (f.kind === 'car' ? 'Cars' : 'Motorbikes')}</span>
                  </span>
                  <span className="font-mono font-bold text-slate-950 tabular-nums">
                    {f.liveTotal ? `${formatNumber(f.liveFree)}/${formatNumber(f.liveTotal)}` : `${f.bays.length} bays`}
                  </span>
                </li>
              )
            })}
          </ul>
          <div className="mt-3">
            {bayActions && (view.source === 'layout' || view.source === 'pushed') ? (
              <GarageFloorsView
                key={lot.id}
                floors={view.floors}
                canSelectBay={bayActions.canSelect}
                bayHint={bayActions.hint}
                renderBayPopup={(bay, close) => bayActions.render(bay, lot.id, close)}
              />
            ) : canInspect && (view.source === 'layout' || view.source === 'pushed') ? (
              // Real bays of the published layout: a parked vehicle opens its details (the API checks role and lot again)
              <GarageFloorsView
                key={lot.id}
                floors={view.floors}
                canSelectBay={hasVehicle}
                bayHint={(bay) => (hasVehicle(bay) ? 'Click for vehicle details' : null)}
                renderBayPopup={(bay, close) => <BaySessionPopup key={bay.id} lotId={lot.id} bay={bay} onClose={close} />}
              />
            ) : (
              <GarageFloorsView key={lot.id} floors={view.floors} />
            )}
          </div>
        </>
      )}
    </section>
  )
}
