import type { AssignedParkingLotDTO } from '@/types/parking.dto'
import { DEMO_STAFF } from './auth.mock'
import { mockResponse } from './mockApi'
import { MOCK_PARKING_LOTS } from './parkingLots.mock'
import { findUserByLogin } from './users.mock'

/** Staff → the lot they work at (Employees.ParkingLotId). Set by the Manager in the backend. */
const STAFF_LOTS: Record<string, string> = {
  [DEMO_STAFF.userId]: 'lot-01',
}

export const lotAssignmentsMock = {
  /** GET /staff/lots: the Staff's own lot, or none. */
  getStaffLots(userId: string): Promise<AssignedParkingLotDTO[]> {
    return mockResponse(() => {
      const explicitLotId = STAFF_LOTS[userId]
      if (explicitLotId) {
        return MOCK_PARKING_LOTS.filter((l) => l.id === explicitLotId).map(({ id, code, name }) => ({ id, code, name }))
      }

      const found = findUserByLogin(userId)
      if (found && found.assignedParkingLots?.length) {
        return found.assignedParkingLots.map((l) => {
          const match = MOCK_PARKING_LOTS.find((ml) => ml.id === l.id)
          return { id: l.id, code: match?.code ?? 'LOT-01', name: l.name }
        })
      }

      // Default fallback for staff in demo mode: lot-01
      const defaultLot = MOCK_PARKING_LOTS[0]
      return [{ id: defaultLot.id, code: defaultLot.code, name: defaultLot.name }]
    })
  },
}

