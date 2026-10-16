import { isMockService, SERVICE_PATHS } from '@/config/env'
import { capacityMock } from '@/mocks/capacity.mock'
import type { ParkingLotCapacityDTO, ParkingLotSummaryDTO } from '@/types/parking.dto'
import { http } from './axiosClient'

const base = SERVICE_PATHS.capacity

interface LotResponse {
  id: number
  code: string
  name: string
  address: string
}

/** Parking service: lots (PMS.API LotsController) and live occupancy (no endpoint yet). */
export const parkingService = {
  async getParkingLots(): Promise<ParkingLotSummaryDTO[]> {
    if (isMockService('parking')) return capacityMock.getParkingLots()
    const lots = await http.get<LotResponse[]>(`${SERVICE_PATHS.parking}/lots`)
    return lots.map(({ id, code, name, address }) => ({ id: String(id), code, name, address }))
  },

  getCapacityOverview(): Promise<ParkingLotCapacityDTO[]> {
    return isMockService('capacity')
      ? capacityMock.getCapacityOverview()
      : http.get<ParkingLotCapacityDTO[]>(`${base}/lots/capacity`)
  },

  /** The occupancy simulation only exists for the mock backend (frontend demos). */
  canSimulate(): boolean {
    return isMockService('capacity')
  },

  simulateCapacityTick(): ParkingLotCapacityDTO[] {
    if (!parkingService.canSimulate()) throw new Error('Occupancy simulation is only available with mock data.')
    return capacityMock.simulateTick()
  },
}
