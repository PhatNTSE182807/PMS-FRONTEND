import { isMockService, SERVICE_PATHS } from '@/config/env'
import { session } from '@/lib/session'
import { capacityMock } from '@/mocks/capacity.mock'
import { lotAssignmentsMock } from '@/mocks/lotAssignments.mock'
import type { AssignedParkingLotDTO, LotOccupancyDTO, ParkingLotCapacityDTO, ParkingLotSummaryDTO } from '@/types/parking.dto'
import { http } from './axiosClient'

const base = SERVICE_PATHS.capacity

interface LotResponse {
  id: number
  code: string
  name: string
  address: string
  managerUserId: string | null
  status?: string
  isBookable?: boolean
  layoutTemplate?: string | null
}

/** Parking service: lots (PMS.API LotsController) and live occupancy (/v1/parking/lots/capacity). */
export const parkingService = {
  async getParkingLots(): Promise<ParkingLotSummaryDTO[]> {
    if (isMockService('parking')) return capacityMock.getParkingLots()
    const lots = await http.get<LotResponse[]>(`${SERVICE_PATHS.parking}/lots`)
    return lots.map(({ id, code, name, address, managerUserId, status, isBookable, layoutTemplate }) => ({
      id: String(id),
      code,
      name,
      address,
      managerUserId,
      status,
      isBookable,
      layoutTemplate,
    }))
  },

  /** GET /staff/lots: the lot the signed-in Staff works at, as assigned by their Manager. */
  async getMyStaffLots(): Promise<AssignedParkingLotDTO[]> {
    const user = session.getUser()
    if (user?.role !== 'STAFF') return []
    if (isMockService('team')) return lotAssignmentsMock.getStaffLots(user.userId)
    const lots = await http.get<{ id: number; code: string; name: string }[]>('/staff/lots')
    return lots.map(({ id, code, name }) => ({ id: String(id), code, name }))
  },

  /** GET /manager/lots/{lotId}/occupancy: live occupied and free bays of a lot the Manager runs. */
  getLotOccupancy(lotId: string): Promise<LotOccupancyDTO> {
    return http.get<LotOccupancyDTO>(`/manager/lots/${lotId}/occupancy`)
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
