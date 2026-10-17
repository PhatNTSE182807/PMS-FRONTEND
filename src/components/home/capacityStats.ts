import { CRITICAL_OCCUPANCY_THRESHOLD, HIGH_OCCUPANCY_THRESHOLD } from '@/lib/occupancy'
import type { CapacityVehicleType, ParkingLotCapacityDTO } from '@/types/parking.dto'

export type VehicleFilter = 'ALL' | CapacityVehicleType

/** Free and total spaces of a lot, optionally for one vehicle type. */
export function lotSpaces(lot: ParkingLotCapacityDTO, filter: VehicleFilter = 'ALL') {
  const details = lot.capacityByVehicle.filter((d) => filter === 'ALL' || d.vehicleType === filter)
  return {
    free: details.reduce((sum, d) => sum + d.availableSlots, 0),
    total: details.reduce((sum, d) => sum + d.totalSlots, 0),
  }
}

/** Lots that are taking vehicles (a full lot is still operating). */
export const isOperating = (lot: ParkingLotCapacityDTO) => lot.status === 'OPEN' || lot.status === 'FULL'

/** Headline numbers for the hero. */
export function systemTotals(lots: ParkingLotCapacityDTO[]) {
  const open = lots.filter(isOperating)
  return {
    openLots: open.length,
    freeSpaces: open.reduce((sum, lot) => sum + lotSpaces(lot).free, 0),
    totalSpaces: lots.reduce((sum, lot) => sum + lotSpaces(lot).total, 0),
  }
}

export type OccupancyLevel = 'low' | 'medium' | 'high'

/** Same thresholds as the admin capacity page (lib/occupancy). */
export function occupancyLevel(percentage: number): OccupancyLevel {
  if (percentage > CRITICAL_OCCUPANCY_THRESHOLD) return 'high'
  if (percentage >= HIGH_OCCUPANCY_THRESHOLD) return 'medium'
  return 'low'
}

export const LEVEL_LABEL: Record<OccupancyLevel, string> = {
  low: 'Plenty of space',
  medium: 'Filling up',
  high: 'Almost full',
}

export const STATUS_LABEL: Record<ParkingLotCapacityDTO['status'], string> = {
  OPEN: 'Open',
  FULL: 'Full',
  MAINTENANCE: 'Maintenance',
  CLOSED: 'Closed',
}
