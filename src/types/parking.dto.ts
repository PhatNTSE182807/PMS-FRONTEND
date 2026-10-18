/*
 * Parking service (/v1/parking). Not implemented by the backend yet: served from
 * mocks/capacity.mock.ts. Source data: ParkingLot, Zone, ZoneOccupancy, ZoneVehicleCapacity.
 */

export type ParkingLotStatus = 'OPEN' | 'FULL' | 'MAINTENANCE' | 'CLOSED'

export type CapacityVehicleType = 'CAR' | 'MOTORBIKE' | 'EV_CHARGING'

export interface ParkingLotSummaryDTO {
  id: string
  code: string
  name: string
  address: string
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
