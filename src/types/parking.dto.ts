/*
 * Parking service (/v1/parking). Not implemented by the backend yet: served from
 * Live occupancy and performance: /v1/parking/lots/capacity. Source data: ParkingLot, Zone, ZoneCounter, Slots.
 */

export type ParkingLotStatus = 'OPEN' | 'FULL' | 'MAINTENANCE' | 'CLOSED'

/** The lot only takes cars (4 and 7 seats) and motorbikes. */
export type CapacityVehicleType = 'CAR' | 'MOTORBIKE'

export interface ParkingLotSummaryDTO {
  id: string
  code: string
  name: string
  address: string
  /** The lot's one Manager, when the backend sends it; a lot never has more than one. */
  managerUserId?: string | null
  /** Active, or Maintenance (also when nobody is on duty), TemporarilyClosed…, when the backend sends it. */
  status?: string
  /** False while the lot is under maintenance or closed. */
  isBookable?: boolean
  /** 3D building template, when the backend sends it. */
  layoutTemplate?: string | null
}

/** GET /manager/lots/{lotId}/occupancy: LotOccupancyModel, live from the zone counters. */
export interface LotOccupancyDTO {
  parkingLotId: number
  totalBays: number
  occupiedBays: number
  freeBays: number
  /** 0-100, one decimal. */
  occupancyRate: number
  baysByVehicle: { vehicleType: CapacityVehicleType; totalBays: number; freeBays: number }[]
  zones: {
    zoneId: number
    zoneName: string
    vehicleType: CapacityVehicleType | null
    totalBays: number
    occupiedBays: number
    freeBays: number
  }[]
}

export interface VehicleCapacityDetail {
  vehicleType: CapacityVehicleType
  totalSlots: number
  occupiedSlots: number
  availableSlots: number
  maintenanceSlots: number
}

export type ZoneStatus = 'AVAILABLE' | 'WARNING' | 'FULL'

export interface ZoneCapacityDTO {
  zoneId: string
  /** e.g. "Basement B1 - Zone A" */
  zoneName: string
  totalSlots: number
  occupiedSlots: number
  status: ZoneStatus
}

export interface HourlyFlowDTO {
  /** "HH:00", start of the hour */
  hour: string
  checkIns: number
  checkOuts: number
}

export interface ParkingLotCapacityDTO {
  id: string
  code: string
  name: string
  address: string
  managerOnDuty: string
  status: ParkingLotStatus
  lastUpdated: string
  overallOccupancyPercentage: number
  capacityByVehicle: VehicleCapacityDetail[]
  zones: ZoneCapacityDTO[]
  /** 3D building template chosen by the Admin (GARAGE_TEMPLATES id), when the backend sends it. */
  layoutTemplate?: string | null
  /** Oldest first; the last entry is the most recent hour. */
  recentHourlyFlow: HourlyFlowDTO[]
}

/**
 * A lot an employee is assigned to: PMS.Application AssignedParkingLotModel, as returned by
 * GET /manager/lots and GET /staff/lots.
 */
export interface AssignedParkingLotDTO {
  id: string
  code: string
  name: string
  /** 3D building template (GARAGE_TEMPLATES id), when known. */
  layoutTemplate?: string | null
}
