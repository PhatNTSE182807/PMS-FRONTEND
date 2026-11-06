/*
 * Layout 3D of a lot and its 2D fallback: PMS.API LayoutsController (PMS.Application.Models.Layout).
 * Layouts are generated from the ready-made model an Admin picks for the lot; nobody draws them.
 * Every level is a grid of rows × cols and each bay takes one cell, the same grid the 3D model uses.
 */

export type SlotStatus = 'Available' | 'Occupied' | 'Reserved' | 'Maintenance'
export type FloorKind = 'car' | 'motorbike' | 'mixed'

/** LayoutFloorModel */
export interface LayoutFloorDTO {
  floorNo: number
  name: string
  kind: FloorKind
  rows: number
  cols: number
}

/** GET /api/lot-templates: LotTemplateResponseModel */
export interface LotTemplateDTO {
  id: string
  name: string
  summary: string
  slotsPerFloor: number
  carSlots: number
  motorbikeSlots: number
  totalSlots: number
  floors: LayoutFloorDTO[]
}

/** GET /api/public/lots/{lotId}/layout: LayoutResponseModel. Cache it by version. */
export interface LotLayoutDTO {
  parkingLotId: number
  parkingLotName: string
  lotStatus: string
  version: number
  templateId: string | null
  publishedAt: string | null
  updatedAt: string
  floors: LayoutFloorDTO[]
  zones: { zoneId: number; code: string; name: string; zoneType: string; floorNo: number | null }[]
  slots: {
    slotId: number
    code: string
    zoneId: number
    vehicleTypeCode: string | null
    floorNo: number
    row: number
    col: number
    rotation: number
    modelUrl: string | null
  }[]
}

/** GET /api/public/lots/{lotId}/layout/status: statuses and free spaces, never plates (FR-3D-08). */
export interface LotLayoutStatusDTO {
  parkingLotId: number
  version: number
  generatedAt: string
  slots: { slotId: number; status: SlotStatus }[]
  zones: { zoneId: number; total: number; free: number }[]
}

/** "slots": every bay as a cell. "zones": one block per zone and level (Level of Detail). */
export type Layout2DDetail = 'slots' | 'zones'

/** GET /api/public/lots/{lotId}/layout/2d?detail=…: Layout2DResponseModel */
export interface LotPlan2DDTO {
  parkingLotId: number
  parkingLotName: string
  lotStatus: string
  version: number
  detail: Layout2DDetail
  /** Live free and total spaces per zone (zone counters): walk-ins only move these. */
  zoneCounters?: {
    zoneId: number
    total: number
    free: number
    /** The vehicles counted here without a bay of their own, oldest entry first. Never a plate. */
    walkIns?: { vehicleColor: string | null; vehicleTypeCode: string | null }[]
  }[]
  floors: {
    floorNo: number
    name: string
    kind: FloorKind
    rows: number
    cols: number
    total: number
    free: number
    cells: {
      slotId: number
      code: string
      zoneId: number
      vehicleTypeCode: string | null
      row: number
      col: number
      rotation: number
      status: SlotStatus
      /** Registered colour of the vehicle parked here, when known. Never a plate. */
      vehicleColor?: string | null
      /** Type of the vehicle parked here, which a car bay does not fix (CAR_4 or CAR_7). */
      parkedVehicleTypeCode?: string | null
      /** Free now but booked for later: counted walk-ins are drawn in bays without a booking first. */
      bookedLater?: boolean
    }[]
    zoneBlocks: {
      zoneId: number
      code: string
      name: string
      minRow: number
      maxRow: number
      minCol: number
      maxCol: number
      total: number
      free: number
    }[]
  }[]
}
