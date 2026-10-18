import { lazy, Suspense, useMemo, useState } from 'react'
import { Bike, Car } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildTemplateGarage, type Bay, type GarageTemplate, type ZoneStats } from './garageModel'

// three.js is large: load it only when a preview is on screen.
const Garage3D = lazy(() => import('./Garage3D'))

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
  const [focus, setFocus] = useState<number | null>(null)
  const [selected, setSelected] = useState<Bay | null>(null)
  const height = cn('relative h-[24rem] w-full overflow-hidden rounded-xl bg-slate-900 sm:h-[30rem]', className)
  const tab = (active: boolean) =>
    cn(
      'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
      active ? 'bg-[#124e66] text-indigo-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
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
          {selected ? `Bay ${selected.code} · ${STATUS_TEXT[selected.status]}` : 'Drag to rotate • scroll to zoom • click a bay'}
        </span>
      </div>
      <Suspense fallback={<div className={cn(height, 'grid place-items-center text-sm text-slate-400')}>Loading 3D model…</div>}>
        <Garage3D
          floors={floors}
          focusFloor={focus}
          selectedBayId={selected?.id ?? null}
          myBayId={null}
          onSelectBay={(bay) => {
            setSelected(bay)
            setFocus(bay.floorIndex)
          }}
          className={height}
        />
      </Suspense>
    </div>
  )
}
