import type { Bay, BayStatus, GarageFloor } from '@/components/customer/garage/garageModel'
import type { LotPlan2DDTO, SlotStatus } from '@/types/layout.dto'

/** Maintenance bays cannot be booked, so the model shows them like occupied ones. */
const BAY_STATUS: Record<SlotStatus, BayStatus> = {
  Available: 'AVAILABLE',
  Reserved: 'RESERVED',
  Occupied: 'OCCUPIED',
  Maintenance: 'OCCUPIED',
}

type WalkIn = NonNullable<NonNullable<LotPlan2DDTO['zoneCounters']>[number]['walkIns']>[number]

const parkedKind = (vehicleTypeCode: string | null | undefined) => (vehicleTypeCode === 'CAR_7' ? 'suv' : 'car')

/**
 * Backend 2D plan (detail = slots) -> the levels the 3D model and the 2D fallback draw. Both use the
 * same grid, so a published layout renders exactly where the backend placed each bay.
 */
export function planToGarageFloors(plan: LotPlan2DDTO): GarageFloor[] {
  const walkIns = walkInBays(plan)
  return plan.floors.map((floor, index) => {
    const bays: Bay[] = floor.cells.map((cell) => ({
      id: String(cell.slotId),
      code: cell.code,
      floorIndex: index,
      row: cell.row,
      col: cell.col,
      status: walkIns.has(cell.slotId) ? 'OCCUPIED' : BAY_STATUS[cell.status],
      vehicleColor: cell.vehicleColor ?? walkIns.get(cell.slotId)?.vehicleColor ?? null,
      vehicleKind: parkedKind(cell.parkedVehicleTypeCode ?? walkIns.get(cell.slotId)?.vehicleTypeCode ?? cell.vehicleTypeCode),
    }))
    return {
      index,
      level: floor.name,
      kind: floor.kind === 'motorbike' ? 'motorbike' : 'car',
      zoneLabel: floor.zoneBlocks.map((z) => z.name).join(' + '),
      rows: floor.rows,
      cols: floor.cols,
      bays,
      // Walk-ins drawn on this level are not free either
      liveFree: Math.max(0, floor.free - floor.cells.filter((c) => walkIns.has(c.slotId)).length),
      liveTotal: floor.total,
    }
  })
}

/**
 * Walk-ins are not given a bay: only the zone counter knows how many are inside. The model still shows them,
 * filling free bays of their zone in a fixed order (front rows first) so the same bays stay filled between
 * refreshes. Spaces used = counter total - counter free; bays already shown as held or taken count first.
 * Each filled bay maps to one of those vehicles, while the counter's list lasts; the others are not known (null).
 */
function walkInBays(plan: LotPlan2DDTO): Map<number, WalkIn | null> {
  const filled = new Map<number, WalkIn | null>()
  const cells = plan.floors.flatMap((floor, floorIndex) => floor.cells.map((cell) => ({ ...cell, floorIndex })))
  for (const zone of plan.zoneCounters ?? []) {
    const inZone = cells.filter((c) => c.zoneId === zone.zoneId)
    const shown = inZone.filter((c) => c.status !== 'Available').length
    const missing = Math.max(0, zone.total - zone.free - shown)
    const free = inZone
      .filter((c) => c.status === 'Available')
      .sort((a, b) => a.floorIndex - b.floorIndex || a.row - b.row || a.col - b.col)
    const vehicles = zone.walkIns ?? []
    free.slice(0, Math.max(0, missing)).forEach((cell, i) => filled.set(cell.slotId, vehicles[i] ?? null))
  }
  return filled
}
