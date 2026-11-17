import { buildTemplateGarage, standardBays, templateForLot, type BayStatus } from '@/components/customer/garage/garageModel'
import type { Layout2DDetail, LotPlan2DDTO, SlotStatus } from '@/types/layout.dto'
import { mockFail, mockResponse } from './mockApi'
import { findMockLot } from './parkingLots.mock'

const SLOT_STATUS: Record<BayStatus, SlotStatus> = { AVAILABLE: 'Available', RESERVED: 'Reserved', OCCUPIED: 'Occupied' }

/** Demo lots use the same model the 3D map shows, about half full, like the backend generates it. */
function demoLayout(lotId: string) {
  const lot = findMockLot(lotId)
  if (!lot) mockFail(404, `Parking lot with ID ${lotId} was not found.`)
  const template = templateForLot({ id: lotId })
  const floors = buildTemplateGarage(
    template,
    template.floors.map((kind) => ({
      label: kind === 'car' ? 'Cars' : 'Motorbikes',
      total: template.slotsPerFloor,
      occupied: Math.round(template.slotsPerFloor * 0.45),
    })),
    lotId,
  )
  return { lot, template, floors }
}

export const layoutMock = {
  plan2D(lotId: string, detail: Layout2DDetail): Promise<LotPlan2DDTO> {
    return mockResponse(() => {
      const { lot, floors } = demoLayout(lotId)
      return {
        parkingLotId: 0,
        parkingLotName: lot.name,
        lotStatus: 'Active',
        version: 1,
        detail,
        floors: floors.map((f) => {
          const bays = standardBays(f)
          const free = bays.filter((b) => b.status === 'AVAILABLE').length
          return {
            floorNo: f.index,
            name: f.level,
            kind: f.kind,
            rows: f.rows,
            cols: f.cols,
            total: bays.length,
            free,
            penaltyTotal: f.bays.length - bays.length,
            penaltyFree: f.bays.filter((b) => b.penalty && b.status === 'AVAILABLE').length,
            cells:
              detail === 'slots'
                ? f.bays.map((b, i) => ({
                    slotId: f.index * 1000 + i + 1,
                    code: b.code,
                    zoneId: f.index + 1,
                    vehicleTypeCode: f.kind === 'car' ? 'CAR_4' : 'MOTORBIKE',
                    row: b.row,
                    col: b.col,
                    rotation: b.row % 2 === 0 ? 0 : 180,
                    status: SLOT_STATUS[b.status],
                    // Demo data: every third car parked is a 7-seat SUV
                    parkedVehicleTypeCode: f.kind === 'car' && b.status === 'OCCUPIED' && i % 3 === 0 ? 'CAR_7' : null,
                    kind: b.penalty ? ('Penalty' as const) : ('Standard' as const),
                  }))
                : [],
            zoneBlocks:
              detail === 'zones'
                ? [{ zoneId: f.index + 1, code: f.level, name: f.zoneLabel, minRow: 0, maxRow: f.rows - 1, minCol: 0, maxCol: Math.max(...bays.map((b) => b.col)), total: bays.length, free }]
                : [],
          }
        }),
      }
    })
  },
}
