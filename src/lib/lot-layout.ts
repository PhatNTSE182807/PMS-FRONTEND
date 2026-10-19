import type { Bay, BayStatus, GarageFloor } from '@/components/customer/garage/garageModel'
import type { LotPlan2DDTO, SlotStatus } from '@/types/layout.dto'

/** Maintenance bays cannot be booked, so the model shows them like occupied ones. */
const BAY_STATUS: Record<SlotStatus, BayStatus> = {
  Available: 'AVAILABLE',
  Reserved: 'RESERVED',
  Occupied: 'OCCUPIED',
  Maintenance: 'OCCUPIED',
}

/**
 * Backend 2D plan (detail = slots) -> the levels the 3D model and the 2D fallback draw. Both use the
 * same grid, so a published layout renders exactly where the backend placed each bay.
 */
export function planToGarageFloors(plan: LotPlan2DDTO): GarageFloor[] {
  return plan.floors.map((floor, index) => {
    const bays: Bay[] = floor.cells.map((cell) => ({
      id: String(cell.slotId),
      code: cell.code,
      floorIndex: index,
      row: cell.row,
      col: cell.col,
      status: BAY_STATUS[cell.status],
    }))
    return {
      index,
      level: floor.name,
      kind: floor.kind === 'motorbike' ? 'motorbike' : 'car',
      zoneLabel: floor.zoneBlocks.map((z) => z.name).join(' + '),
      rows: floor.rows,
      cols: floor.cols,
      bays,
      liveFree: floor.free,
      liveTotal: floor.total,
    }
  })
}
