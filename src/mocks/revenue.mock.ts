import { toIsoDate } from '@/lib/format'
import { splitRange } from '@/lib/revenuePeriods'
import type { AdminRevenueReportDTO, ParkingLotRevenueDTO, PaymentMethod, RevenueReportQuery } from '@/types/report.dto'
import { mockFail, mockResponse } from './mockApi'
import { MOCK_PARKING_LOTS, type MockParkingLot } from './parkingLots.mock'
import { createRandom, hashString, jitter } from './random'

const DAY_MS = 24 * 60 * 60 * 1000
/** Order of `MockParkingLot.paymentMix`. */
const MIX_ORDER: PaymentMethod[] = ['CASH', 'QR_BANKING', 'RFID_WALLET']
/** Order the backend sends the methods in. */
const REPORT_ORDER: PaymentMethod[] = ['QR_BANKING', 'RFID_WALLET', 'CASH']

interface DayMetrics {
  revenue: number
  sessions: number
  /** Revenue per method, in MIX_ORDER. */
  byMethod: number[]
}

const parseDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** "lot-03" → 3, so mock rows carry a numeric id like the backend. */
const numericLotId = (lot: MockParkingLot) => Number(lot.id.replace(/\D/g, ''))

const metricsCache = new Map<string, DayMetrics>()

/** Settled sessions of one lot on one day: deterministic for a given date. */
function dayMetrics(lot: MockParkingLot, date: string): DayMetrics {
  const key = `${lot.id}|${date}`
  const cached = metricsCache.get(key)
  if (cached) return cached

  const random = createRandom(hashString(key))
  const day = parseDate(date)
  const today = toIsoDate(new Date())

  // Future days have no revenue; today only counts the hours elapsed so far.
  let dayFraction = 1
  if (date > today) dayFraction = 0
  else if (date === today) {
    const now = new Date()
    dayFraction = (now.getHours() * 60 + now.getMinutes()) / (24 * 60)
  }

  const isWeekend = day.getDay() === 0 || day.getDay() === 6
  const weekday = isWeekend ? lot.weekendFactor : 1
  // Slow business growth (~12%/year), so period-over-period comparisons are meaningful.
  const trend = 1 + ((day.getTime() - Date.UTC(2025, 0, 1)) / (365 * DAY_MS)) * 0.12
  const volume = weekday * trend * dayFraction

  const motorbikes = Math.round(lot.dailyMotorbikes * volume * jitter(random, 0.12))
  const cars = Math.round(lot.dailyCars * volume * jitter(random, 0.15))
  // Fees are rounded up to 1,000 VND, like the gates do.
  const revenue = Math.ceil((cars * lot.carFee * jitter(random, 0.05) + motorbikes * lot.motorbikeFee * jitter(random, 0.05)) / 1000) * 1000

  const weights = lot.paymentMix.map((share) => share * jitter(random, 0.1))
  const weightTotal = weights.reduce((a, b) => a + b, 0)
  const metrics = { revenue, sessions: motorbikes + cars, byMethod: weights.map((w) => (revenue * w) / weightTotal) }

  // Today's figures keep growing, so only closed days are cached.
  if (date < today) metricsCache.set(key, metrics)
  return metrics
}

const share = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0)

export const revenueMock = {
  /** Same shape and validation as GET /admin/reports/revenue. */
  getAdminRevenue: (query: RevenueReportQuery): Promise<AdminRevenueReportDTO> =>
    mockResponse(() => {
      if (query.endDate < query.startDate) mockFail(400, "'endDate' cannot be before 'startDate'.")
      const lots = query.parkingLotId
        ? MOCK_PARKING_LOTS.filter((lot) => lot.id === query.parkingLotId || String(numericLotId(lot)) === query.parkingLotId)
        : MOCK_PARKING_LOTS
      if (lots.length === 0) mockFail(404, 'Parking lot not found.')

      const days = splitRange(query, 'DAY')
      const byMethod = MIX_ORDER.map(() => 0)
      const byLot = lots
        .map<ParkingLotRevenueDTO>((lot) => {
          let totalRevenue = 0
          let totalSessions = 0
          for (const { startDate } of days) {
            const metrics = dayMetrics(lot, startDate)
            totalRevenue += metrics.revenue
            totalSessions += metrics.sessions
            metrics.byMethod.forEach((amount, i) => (byMethod[i] += amount))
          }
          return {
            parkingLotId: numericLotId(lot),
            parkingLotName: lot.name,
            totalRevenue,
            totalSessions,
            managerUserId: lot.managerUserId ?? null,
          }
        })
        .sort((a, b) => a.parkingLotName.localeCompare(b.parkingLotName, 'en'))

      const systemTotalRevenue = byLot.reduce((sum, lot) => sum + lot.totalRevenue, 0)
      return {
        startDate: query.startDate,
        endDate: query.endDate,
        systemTotalRevenue,
        systemTotalSessions: byLot.reduce((sum, lot) => sum + lot.totalSessions, 0),
        activeLotsCount: lots.length,
        byLot,
        paymentMethods: REPORT_ORDER.map((method) => {
          const amount = Math.round(byMethod[MIX_ORDER.indexOf(method)])
          return { method, amount, percentage: share(amount, systemTotalRevenue) }
        }),
      }
    }),
}
