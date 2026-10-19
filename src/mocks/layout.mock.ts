import { buildTemplateGarage, GARAGE_TEMPLATES, templateCapacity, templateForLot, type BayStatus } from '@/components/customer/garage/garageModel'
import type { Layout2DDetail, LotLayoutDTO, LotLayoutStatusDTO, LotPlan2DDTO, LotTemplateDTO, SlotStatus } from '@/types/layout.dto'
import { mockFail, mockResponse } from './mockApi'
import { findMockLot } from './parkingLots.mock'

const SLOT_STATUS: Record<BayStatus, SlotStatus> = { AVAILABLE: 'Available', RESERVED: 'Reserved', OCCUPIED: 'Occupied' }
const rowsFor = (slots: number) => (slots > 30 ? 4 : 2)

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
  templates(): Promise<LotTemplateDTO[]> {
    return mockResponse(() =>
      GARAGE_TEMPLATES.map((t) => {
        const mix = templateCapacity(t)
        const rows = rowsFor(t.slotsPerFloor)
        return {
          id: t.id,
          name: t.name,
          summary: t.summary,
          slotsPerFloor: t.slotsPerFloor,
          carSlots: mix.car,
          motorbikeSlots: mix.motorbike,
          totalSlots: mix.total,
          floors: t.floors.map((kind, i) => ({ floorNo: i, name: `L${i + 1}`, kind, rows, cols: Math.ceil(t.slotsPerFloor / rows) })),
        }
      }),
    )
  },

  layout(lotId: string): Promise<LotLayoutDTO> {
    return mockResponse(() => {
      const { lot, template, floors } = demoLayout(lotId)
      return {
        parkingLotId: 0,
        parkingLotName: lot.name,
        lotStatus: 'Active',
        version: 1,
        templateId: template.id,
        publishedAt: null,
        updatedAt: new Date().toISOString(),
        floors: floors.map((f) => ({ floorNo: f.index, name: f.level, kind: f.kind, rows: f.rows, cols: f.cols })),
        zones: floors.map((f) => ({ zoneId: f.index + 1, code: f.level, name: f.zoneLabel, zoneType: 'Floor', floorNo: f.index })),
        slots: floors.flatMap((f) =>
          f.bays.map((b, i) => ({
            slotId: f.index * 1000 + i + 1,
            code: b.code,
            zoneId: f.index + 1,
            vehicleTypeCode: f.kind === 'car' ? 'CAR_4' : 'MOTORBIKE',
            floorNo: f.index,
            row: b.row,
            col: b.col,
            rotation: b.row % 2 === 0 ? 0 : 180,
            modelUrl: null,
          })),
        ),
      }
    })
  },

  status(lotId: string): Promise<LotLayoutStatusDTO> {
    return mockResponse(() => {
      const { floors } = demoLayout(lotId)
      return {
        parkingLotId: 0,
        version: 1,
        generatedAt: new Date().toISOString(),
        slots: floors.flatMap((f) => f.bays.map((b, i) => ({ slotId: f.index * 1000 + i + 1, status: SLOT_STATUS[b.status] }))),
        zones: floors.map((f) => ({
          zoneId: f.index + 1,
          total: f.bays.length,
          free: f.bays.filter((b) => b.status === 'AVAILABLE').length,
        })),
      }
    })
  },

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
          const free = f.bays.filter((b) => b.status === 'AVAILABLE').length
          return {
            floorNo: f.index,
            name: f.level,
            kind: f.kind,
            rows: f.rows,
            cols: f.cols,
            total: f.bays.length,
            free,
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
                  }))
                : [],
            zoneBlocks:
              detail === 'zones'
                ? [{ zoneId: f.index + 1, code: f.level, name: f.zoneLabel, minRow: 0, maxRow: f.rows - 1, minCol: 0, maxCol: f.cols - 1, total: f.bays.length, free }]
                : [],
          }
        }),
      }
    })
  },
}
