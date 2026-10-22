import { isMockService, SERVICE_PATHS } from '@/config/env'
import { parkingHistoryMock } from '@/mocks/parkingHistory.mock'
import type { ParkingHistoryPageDTO, ParkingHistoryQuery, ParkingReceiptDTO } from '@/types/parkingHistory.dto'
import { http } from './axiosClient'

const base = `${SERVICE_PATHS.booking}/parking-sessions`
// Served by ParkingSessionsController, next to reservations and payments
const mocked = () => isMockService('booking')

/** The signed-in customer's finished parking sessions and their e-receipts (FR-CUS-02). */
export const parkingHistoryService = {
  /** Finished sessions, newest exit first, one page at a time. */
  getHistory(query: ParkingHistoryQuery = {}): Promise<ParkingHistoryPageDTO> {
    return mocked()
      ? parkingHistoryMock.getHistory(query)
      : http.get<ParkingHistoryPageDTO>(`${base}/history`, { params: query })
  },

  /** E-receipt of one finished session: fee breakdown, deposit and payments. */
  getReceipt(sessionId: number): Promise<ParkingReceiptDTO> {
    return mocked() ? parkingHistoryMock.getReceipt(sessionId) : http.get<ParkingReceiptDTO>(`${base}/${sessionId}/receipt`)
  },
}
