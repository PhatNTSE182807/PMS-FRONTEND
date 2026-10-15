import { isMockService, SERVICE_PATHS } from '@/config/env'
import { capacityMock } from '@/mocks/capacity.mock'
import type { ParkingLotCapacityDTO, ParkingLotSummaryDTO } from '@/types/parking.dto'
import { http } from './axiosClient'

const base = SERVICE_PATHS.parking

/** Parking service: lots, zones and live occupancy. */
export const parkingService = {
  getParkingLots(): Promise<ParkingLotSummaryDTO[]> {
    return isMockService('parking') ? capacityMock.getParkingLots() : http.get<ParkingLotSummaryDTO[]>(`${base}/lots`)
  },

  getCapacityOverview(): Promise<ParkingLotCapacityDTO[]> {
    return isMockService('parking')
      ? capacityMock.getCapacityOverview()
      : http.get<ParkingLotCapacityDTO[]>(`${base}/lots/capacity`)
  },

  /** The occupancy simulation only exists for the mock backend (frontend demos). */
  canSimulate(): boolean {
    return isMockService('parking')
  },

  simulateCapacityTick(): ParkingLotCapacityDTO[] {
    if (!parkingService.canSimulate()) throw new Error('Occupancy simulation is only available with mock data.')
    return capacityMock.simulateTick()
  },
}
