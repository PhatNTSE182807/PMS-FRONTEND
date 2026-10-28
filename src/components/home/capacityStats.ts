import { CRITICAL_OCCUPANCY_THRESHOLD, HIGH_OCCUPANCY_THRESHOLD } from '@/lib/occupancy'
import type { ParkingLotCapacityDTO } from '@/types/parking.dto'

/** Lots that are taking vehicles (a full lot is still operating). */
export const isOperating = (lot: ParkingLotCapacityDTO) => lot.status === 'OPEN' || lot.status === 'FULL'

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
