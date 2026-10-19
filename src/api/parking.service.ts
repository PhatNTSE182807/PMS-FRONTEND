import { isMockService, SERVICE_PATHS } from '@/config/env'
import { session } from '@/lib/session'
import { capacityMock } from '@/mocks/capacity.mock'
import { lotAssignmentsMock } from '@/mocks/lotAssignments.mock'
import type { AssignedParkingLotDTO, ParkingLotCapacityDTO, ParkingLotSummaryDTO } from '@/types/parking.dto'
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

  /**
   * The lot(s) the signed-in Staff works at. No endpoint yet (proposed GET /staff/lots, same
   * shape as GET /manager/lots), so it is always mocked. Managers use lotManagementService.list().
   */
  async getMyStaffLots(): Promise<AssignedParkingLotDTO[]> {
    const user = session.getUser()
    return user?.role === 'STAFF' ? lotAssignmentsMock.getStaffLots(user.userId) : []
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
