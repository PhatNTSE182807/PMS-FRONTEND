import { profileMock } from '@/mocks/profile.mock'
import type { ParkingHistoryItemDTO, ParkingHistoryPageDTO, ParkingHistoryQuery, ParkingReceiptDTO } from '@/types/parkingHistory.dto'
import { mockFail, mockResponse } from './mockApi'

/** Demo "backend" of the parking history: a few finished sessions of the demo driver's cars, same rules as the API. */

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
// Fixed when the bundle loads, so the dates stay put while the page is open
const loadedAt = Date.now()

interface Seed {
  id: number
  daysAgo: number
  minutes: number
  lot: [name: string, district: string, address: string]
  zone: string
  slot: string
  vehicle: number
  fee: number
  deposit?: number
  reservation?: string
  status?: ParkingHistoryItemDTO['status']
}

const SEEDS: Seed[] = [
  { id: 9101, daysAgo: 1, minutes: 192, lot: ['Bitexco Financial Terminal', 'District 1', '2 Hai Trieu, Ben Nghe'], zone: 'Basement 1', slot: 'B1-09', vehicle: 0, fee: 80_000, deposit: 30_000, reservation: 'RSV-24101' },
  { id: 9102, daysAgo: 4, minutes: 105, lot: ['Landmark 81 Terminal', 'Binh Thanh', '720A Dien Bien Phu, Ward 22'], zone: 'Basement 2', slot: 'B2-30', vehicle: 1, fee: 45_000 },
  { id: 9103, daysAgo: 7, minutes: 250, lot: ['Saigon Centre Terminal', 'District 1', '65 Le Loi, Ben Nghe'], zone: 'Basement 3', slot: 'B3-04', vehicle: 0, fee: 110_000 },
  { id: 9104, daysAgo: 12, minutes: 12, lot: ['Saigon Centre Terminal', 'District 1', '65 Le Loi, Ben Nghe'], zone: 'Basement 2', slot: 'B2-17', vehicle: 0, fee: 0 },
  { id: 9105, daysAgo: 18, minutes: 320, lot: ['Bitexco Financial Terminal', 'District 1', '2 Hai Trieu, Ben Nghe'], zone: 'Basement 1', slot: 'B1-22', vehicle: 1, fee: 130_000, status: 'EmergencyExit' },
  { id: 9106, daysAgo: 26, minutes: 75, lot: ['Landmark 81 Terminal', 'Binh Thanh', '720A Dien Bien Phu, Ward 22'], zone: 'Basement 1', slot: 'B1-03', vehicle: 0, fee: 30_000 },
]

async function items(): Promise<ParkingHistoryItemDTO[]> {
  const vehicles = await profileMock.getVehicles()
  return SEEDS.map((s) => {
    const exit = loadedAt - s.daysAgo * DAY
    const vehicle = vehicles.length ? vehicles[s.vehicle % vehicles.length] : undefined
    const deposit = s.deposit ?? 0
    return {
      sessionId: s.id,
      sessionCode: `SES-${s.id}`,
      status: s.status ?? 'Completed',
      sessionType: s.reservation ? 'Reservation' : 'WalkIn',
      entryTime: new Date(exit - s.minutes * MINUTE).toISOString(),
      exitTime: new Date(exit).toISOString(),
      durationMinutes: s.minutes,
      parkingLotId: 1,
      lotName: s.lot[0],
      lotDistrict: s.lot[1],
      lotAddress: s.lot[2],
      zoneName: s.zone,
      slotCode: s.slot,
      vehicleId: vehicle?.vehicleId ?? null,
      plateNumber: vehicle?.licensePlate ?? null,
      vehicleTypeName: vehicle?.vehicleType ?? null,
      reservationCode: s.reservation ?? null,
      finalFee: s.fee,
      depositApplied: Math.min(deposit, s.fee),
      paidAmount: Math.max(0, s.fee - deposit),
      receiptNumber: s.fee > 0 ? `INV-${s.id}` : `SES-${s.id}`,
    }
  })
}

export const parkingHistoryMock = {
  async getHistory(query: ParkingHistoryQuery = {}): Promise<ParkingHistoryPageDTO> {
    const all = await items()
    return mockResponse(() => {
      const page = Math.max(1, query.page ?? 1)
      const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 10))
      const matching = all.filter(
        (i) =>
          (!query.vehicleId || i.vehicleId === query.vehicleId) &&
          (!query.from || (i.exitTime ?? i.entryTime) >= query.from) &&
          (!query.to || (i.exitTime ?? i.entryTime) < query.to),
      )
      return {
        items: matching.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageSize,
        totalCount: matching.length,
        totalSpent: matching.reduce((sum, i) => sum + i.finalFee, 0),
      }
    }, 300)
  },

  async getReceipt(sessionId: number): Promise<ParkingReceiptDTO> {
    const [all, profile] = await Promise.all([items(), profileMock.getProfile()])
    return mockResponse(() => {
      const item = all.find((i) => i.sessionId === sessionId)
      if (!item) mockFail(404, 'Parking session not found.')
      const exit = item.exitTime ?? item.entryTime
      return {
        ...item,
        customerName: profile.fullName,
        lotPhone: '028 3823 4567',
        originalFee: item.finalFee,
        discountAmount: 0,
        zeroFeeReason: item.finalFee === 0 ? 'Grace period (under 15 minutes)' : null,
        issuedAt: new Date().toISOString(),
        payments: [
          ...(item.depositApplied > 0
            ? [{ paymentCode: `PM-D${item.sessionId}`, purpose: 'Deposit', method: 'Online', provider: 'VNPay', amount: item.depositApplied, paidAt: item.entryTime }]
            : []),
          ...(item.paidAmount > 0
            ? [{ paymentCode: `PM-F${item.sessionId}`, purpose: 'ParkingFee', method: item.sessionId % 2 ? 'Online' : 'Cash', provider: item.sessionId % 2 ? 'MoMo' : null, amount: item.paidAmount, paidAt: exit }]
            : []),
        ],
      }
    }, 250)
  },
}
