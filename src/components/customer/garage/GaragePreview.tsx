import { useMemo, useState, type ReactNode } from 'react'
import { Bike, Car } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildTemplateGarage, type Bay, type GarageFloor, type GarageTemplate, type ZoneStats } from './garageModel'
import { GarageView } from './GarageView'

const STATUS_TEXT: Record<Bay['status'], string> = {
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  OCCUPIED: 'occupied',
}

/**
 * Interactive 3D preview of a building template, for the Admin's lot screens. Each level shows
 * the given stats (or empty bays), with tabs to look inside one level.
 */
export function GaragePreview({
  template,
  floorStats = [],
  seed,
  className,
}: {
  template: GarageTemplate
  floorStats?: ZoneStats[]
  seed: string
  className?: string
}) {
  const floors = useMemo(() => buildTemplateGarage(template, floorStats, seed), [template, floorStats, seed])
  return <GarageFloorsView floors={floors} className={className} />
}

/**
 * Level tabs and the 3D model (or its 2D fallback) of ready-made levels, without booking. Hovering a bay shows
 * its code; with `renderBayPopup`, clicking a bay that `canSelectBay` allows opens that popup over the model.
 */
export function GarageFloorsView({
  floors,
  className,
  canSelectBay,
  bayHint,
  renderBayPopup,
}: {
  floors: GarageFloor[]
  className?: string
  canSelectBay?: (bay: Bay) => boolean
  bayHint?: (bay: Bay) => string | null
  renderBayPopup?: (bay: Bay, close: () => void) => ReactNode
}) {
  const [focus, setFocus] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Live status: the same bay from the latest floors
  const selected = selectedId ? (floors.flatMap((f) => f.bays).find((b) => b.id === selectedId) ?? null) : null
  const close = () => setSelectedId(null)
  const height = cn('relative h-[24rem] w-full overflow-hidden rounded-xl bg-slate-900 sm:h-[30rem]', className)
  const tab = (active: boolean) =>
    cn(
      'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
      active ? 'bg-selected text-indigo-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    )

  return (
    <div className="space-y-2">
      <div role="tablist" aria-label="Level" className="flex flex-wrap items-center gap-1">
        <button type="button" role="tab" aria-selected={focus === null} className={tab(focus === null)} onClick={() => setFocus(null)}>
          All levels
        </button>
        {floors.map((f) => (
          <button key={f.level} type="button" role="tab" aria-selected={focus === f.index} className={tab(focus === f.index)} onClick={() => setFocus(f.index)}>
            {f.level} {f.kind === 'car' ? <Car className="size-3.5" aria-hidden /> : <Bike className="size-3.5" aria-hidden />}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500" aria-live="polite">
          {selected ? `Bay ${selected.code} · ${STATUS_TEXT[selected.status]}` : renderBayPopup ? 'Point at a bay to see its code, click a parked vehicle for details' : 'Click a bay to see its status'}
        </span>
      </div>
      <div className="relative">
        <GarageView
          floors={floors}
          focusFloor={focus}
          selectedBayId={selected?.id ?? null}
          myBayId={null}
          canSelectBay={canSelectBay}
          bayHint={bayHint}
          onSelectBay={(bay) => {
            setSelectedId(bay.id)
            setFocus(bay.floorIndex)
          }}
          className={height}
        />
        {selected && renderBayPopup?.(selected, close)}
      </div>
    </div>
  )
}
