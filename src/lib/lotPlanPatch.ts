import type { LotLiveChangesDTO, LotPlan2DDTO, SlotStatus } from '@/types/layout.dto'

type Floor = LotPlan2DDTO['floors'][number]
type Cell = Floor['cells'][number]
type CellPatch = Partial<Pick<Cell, 'status' | 'vehicleColor' | 'parkedVehicleTypeCode' | 'bookedLater'>>

/** Newest server time applied per bay and zone of a lot ("lotId:s:12", "lotId:z:3"), to drop pushes that arrive late. */
const appliedAt = new Map<string, number>()

/**
 * The floor totals the server counts on the 2D plan: normal bays and penalty bays apart, a bay is free when
 * Available. Recounted here so a patched plan shows the same numbers a reload would.
 */
function recount(floor: Floor): Floor {
  const standard = floor.cells.filter((c) => c.kind !== 'Penalty')
  const penalty = floor.cells.filter((c) => c.kind === 'Penalty')
  return {
    ...floor,
    total: standard.length,
    free: standard.filter((c) => c.status === 'Available').length,
    penaltyTotal: penalty.length,
    penaltyFree: penalty.filter((c) => c.status === 'Available').length,
  }
}

/**
 * Applies bay patches to a plan. Returns null when a bay is not on the plan (a new layout, a stale cache): the
 * caller then reloads the plan instead of drawing a guess.
 */
function patchCells(plan: LotPlan2DDTO, patches: Map<number, CellPatch>): LotPlan2DDTO | null {
  if (patches.size === 0) return plan
  let found = 0
  const floors = plan.floors.map((floor) => {
    let touched = false
    const cells = floor.cells.map((cell) => {
      const patch = patches.get(cell.slotId)
      if (!patch) return cell
      found++
      touched = true
      return { ...cell, ...patch }
    })
    return touched ? recount({ ...floor, cells }) : floor
  })
  return found === patches.size ? { ...plan, floors } : null
}

/** A bay changed status (SlotStatusChanged). An emptied bay loses its vehicle paint; the live push that follows fills the rest. */
export function applySlotStatus(plan: LotPlan2DDTO, slotId: number, status: SlotStatus): LotPlan2DDTO | null {
  const patch: CellPatch = status === 'Available' ? { status, vehicleColor: null, parkedVehicleTypeCode: null } : { status }
  return patchCells(plan, new Map([[slotId, patch]]))
}

/** A zone's free and used spaces moved (ZoneCounterChanged): only the counts, its walk-ins come with LotLiveChanged. */
export function applyZoneCounter(plan: LotPlan2DDTO, zoneId: number, total: number, free: number): LotPlan2DDTO {
  if (!plan.zoneCounters?.some((z) => z.zoneId === zoneId)) return plan
  return { ...plan, zoneCounters: plan.zoneCounters.map((z) => (z.zoneId === zoneId ? { ...z, total, free } : z)) }
}

/**
 * The full new state of the bays and zones a saved change touched (LotLiveChanged). Bays and zones already
 * patched from a newer push are skipped. Returns null when the plan must be reloaded instead.
 */
export function applyLiveChanges(plan: LotPlan2DDTO, changes: LotLiveChangesDTO): LotPlan2DDTO | null {
  const lot = changes.parkingLotId
  const isNewer = (key: string) => {
    const last = appliedAt.get(key) ?? 0
    if (changes.at < last) return false
    appliedAt.set(key, changes.at)
    return true
  }

  const patches = new Map<number, CellPatch>()
  for (const cell of changes.cells) {
    if (!isNewer(`${lot}:s:${cell.slotId}`)) continue
    patches.set(cell.slotId, {
      status: cell.status,
      vehicleColor: cell.vehicleColor,
      parkedVehicleTypeCode: cell.parkedVehicleTypeCode,
      bookedLater: cell.bookedLater,
    })
  }
  const patched = patchCells(plan, patches)
  if (!patched) return null

  const zones = changes.zoneCounters.filter((z) => isNewer(`${lot}:z:${z.zoneId}`))
  if (zones.length === 0) return patched
  const counters = patched.zoneCounters ?? []
  // A zone the plan does not know yet: reload rather than guess where it is drawn
  if (zones.some((z) => !counters.some((c) => c.zoneId === z.zoneId))) return null
  const byId = new Map(zones.map((z) => [z.zoneId, z]))
  return { ...patched, zoneCounters: counters.map((c) => byId.get(c.zoneId) ?? c) }
}
