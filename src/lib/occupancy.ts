import type { VehicleCapacityDetail, ZoneStatus } from '@/types/parking.dto'

/**
 * Occupancy rules from the spec:
 *   AVAILABLE  < 70%     (emerald)
 *   HIGH       70 – 90%  (amber)
 *   CRITICAL   > 90%     (rose, pulsing at 100%)
 */
export type OccupancyLevel = 'AVAILABLE' | 'HIGH' | 'CRITICAL'

export const HIGH_OCCUPANCY_THRESHOLD = 70
export const CRITICAL_OCCUPANCY_THRESHOLD = 90

/** Occupancy Rate (%) = Occupied Slots / Total Capacity × 100 */
export function occupancyRate(occupied: number, total: number): number {
  return total > 0 ? (occupied / total) * 100 : 0
}

export function occupancyLevel(rate: number): OccupancyLevel {
  if (rate > CRITICAL_OCCUPANCY_THRESHOLD) return 'CRITICAL'
  if (rate >= HIGH_OCCUPANCY_THRESHOLD) return 'HIGH'
  return 'AVAILABLE'
}

export function zoneStatusFor(rate: number): ZoneStatus {
  const level = occupancyLevel(rate)
  return level === 'CRITICAL' ? 'FULL' : level === 'HIGH' ? 'WARNING' : 'AVAILABLE'
}

/** Parking slots only: EV chargers are a separate service and do not fill the lot. */
export function parkingSlots(capacity: VehicleCapacityDetail[]) {
  return capacity
    .filter((c) => c.vehicleType !== 'EV_CHARGING')
    .reduce(
      (sum, c) => ({
        total: sum.total + c.totalSlots,
        occupied: sum.occupied + c.occupiedSlots,
        available: sum.available + c.availableSlots,
      }),
      { total: 0, occupied: 0, available: 0 },
    )
}
