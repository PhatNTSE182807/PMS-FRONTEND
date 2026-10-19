import type { AssignedParkingLotDTO } from '@/types/parking.dto'
import { DEMO_STAFF } from './auth.mock'
import { mockResponse } from './mockApi'
import { MOCK_PARKING_LOTS } from './parkingLots.mock'

/** Staff → the lot they work at (Employees.ParkingLotId). Set by the Manager in the backend. */
const STAFF_LOTS: Record<string, string> = {
  [DEMO_STAFF.userId]: 'lot-01',
}

export const lotAssignmentsMock = {
  /** Proposed GET /staff/lots: the Staff's own lot, or none. */
  getStaffLots(userId: string): Promise<AssignedParkingLotDTO[]> {
    return mockResponse(() =>
      MOCK_PARKING_LOTS.filter((l) => l.id === STAFF_LOTS[userId]).map(({ id, code, name }) => ({ id, code, name })),
    )
  },
}
