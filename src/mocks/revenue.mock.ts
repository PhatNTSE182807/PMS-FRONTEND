import { toIsoDate } from '@/lib/format'
import { granularityFor, splitRange, type RevenueGranularity } from '@/lib/revenuePeriods'
import type {
  AdminRevenueQuery,
  AdminRevenueReportDTO,
  AdminRevenueTimeSeriesDTO,
  ParkingLotRevenueDTO,
  PaymentMethod,
  RevenueTimeSeriesLotDTO,
} from '@/types/report.dto'
import { mockFail, mockResponse } from './mockApi'
import { MOCK_PARKING_LOTS, type MockParkingLot } from './parkingLots.mock'
import { createRandom, hashString, jitter } from './random'

const DAY_MS = 24 * 60 * 60 * 1000
/** Order of `MockParkingLot.paymentMix`. */
const MIX_ORDER: PaymentMethod[] = ['CASH', 'QR_BANKING', 'RFID_WALLET']
/** Order the backend sends the methods in. */
const REPORT_ORDER: PaymentMethod[] = ['QR_BANKING', 'RFID_WALLET', 'CASH']

interface DayMetrics {
  cars: number
  motorbikes: number
  carRevenue: number
  motorbikeRevenue: number
  /** Share of the day's revenue per method, in MIX_ORDER (sums to 1). */
  methodShares: number[]
}

/** The day's figures kept by the vehicle filter. */
interface Totals {
  revenue: number
  sessions: number
  cars: number
  motorbikes: number
  carRevenue: number
  motorbikeRevenue: number
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
  const roundFee = (value: number) => Math.ceil(value / 1000) * 1000
  const weights = lot.paymentMix.map((share) => share * jitter(random, 0.1))
  const weightTotal = weights.reduce((a, b) => a + b, 0)
  const metrics: DayMetrics = {
    cars,
    motorbikes,
    carRevenue: roundFee(cars * lot.carFee * jitter(random, 0.05)),
    motorbikeRevenue: roundFee(motorbikes * lot.motorbikeFee * jitter(random, 0.05)),
    methodShares: weights.map((w) => w / weightTotal),
  }

  // Today's figures keep growing, so only closed days are cached.
  if (date < today) metricsCache.set(key, metrics)
  return metrics
}

function totalsOf(m: DayMetrics, vehicleType: AdminRevenueQuery['vehicleType']): Totals {
  const cars = vehicleType === 'MOTORBIKE' ? 0 : m.cars
  const motorbikes = vehicleType === 'CAR' ? 0 : m.motorbikes
  const carRevenue = vehicleType === 'MOTORBIKE' ? 0 : m.carRevenue
  const motorbikeRevenue = vehicleType === 'CAR' ? 0 : m.motorbikeRevenue
  return { cars, motorbikes, carRevenue, motorbikeRevenue, sessions: cars + motorbikes, revenue: carRevenue + motorbikeRevenue }
}

/** Same validation as the backend. */
function lotsFor(query: AdminRevenueQuery): MockParkingLot[] {
  if (query.endDate < query.startDate) mockFail(400, "'endDate' cannot be before 'startDate'.")
  const lots = query.parkingLotId
    ? MOCK_PARKING_LOTS.filter((lot) => lot.id === query.parkingLotId || String(numericLotId(lot)) === query.parkingLotId)
    : MOCK_PARKING_LOTS
  if (lots.length === 0) mockFail(404, 'Parking lot not found.')
  return lots
}

const share = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0)
const byName = <T extends { parkingLotName: string }>(a: T, b: T) => a.parkingLotName.localeCompare(b.parkingLotName, 'en')

export const revenueMock = {
  /** Same shape and validation as GET /admin/reports/revenue. */
  getAdminRevenue: (query: AdminRevenueQuery): Promise<AdminRevenueReportDTO> =>
    mockResponse(() => {
      const lots = lotsFor(query)
      const days = splitRange(query, 'DAY')
      const byMethod = MIX_ORDER.map(() => 0)
      const vehicles = { cars: 0, motorbikes: 0, carRevenue: 0, motorbikeRevenue: 0 }

      const byLot = lots
        .map<ParkingLotRevenueDTO>((lot) => {
          let totalRevenue = 0
          let totalSessions = 0
          for (const { startDate } of days) {
            const metrics = dayMetrics(lot, startDate)
            const t = totalsOf(metrics, query.vehicleType)
            totalRevenue += t.revenue
            totalSessions += t.sessions
            vehicles.cars += t.cars
            vehicles.motorbikes += t.motorbikes
            vehicles.carRevenue += t.carRevenue
            vehicles.motorbikeRevenue += t.motorbikeRevenue
            metrics.methodShares.forEach((s, i) => (byMethod[i] += t.revenue * s))
          }
          return {
            parkingLotId: numericLotId(lot),
            parkingLotName: lot.name,
            totalRevenue,
            totalSessions,
            managerUserId: lot.managerUserId ?? null,
          }
        })
        .sort(byName)

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
        byVehicleType: [
          { vehicleType: 'CAR', totalRevenue: vehicles.carRevenue, totalSessions: vehicles.cars },
          { vehicleType: 'MOTORBIKE', totalRevenue: vehicles.motorbikeRevenue, totalSessions: vehicles.motorbikes },
        ],
      }
    }),

  /** Same shape and validation as GET /admin/reports/revenue/timeseries (automatic granularity). */
  getAdminRevenueTimeSeries: (query: AdminRevenueQuery): Promise<AdminRevenueTimeSeriesDTO> =>
    mockResponse(() => {
      const lots = lotsFor(query)
      const granularity: RevenueGranularity = granularityFor(query)
      const points = splitRange(query, granularity).map((period) => {
        const days = splitRange(period, 'DAY')
        const point = {
          ...period,
          totalRevenue: 0,
          totalSessions: 0,
          carRevenue: 0,
          carSessions: 0,
          motorbikeRevenue: 0,
          motorbikeSessions: 0,
          byLot: [] as RevenueTimeSeriesLotDTO[],
        }
        for (const lot of lots) {
          const row: RevenueTimeSeriesLotDTO = {
            parkingLotId: numericLotId(lot),
            parkingLotName: lot.name,
            totalRevenue: 0,
            totalSessions: 0,
            carSessions: 0,
            motorbikeSessions: 0,
          }
          for (const { startDate } of days) {
            const t = totalsOf(dayMetrics(lot, startDate), query.vehicleType)
            row.totalRevenue += t.revenue
            row.totalSessions += t.sessions
            row.carSessions += t.cars
            row.motorbikeSessions += t.motorbikes
            point.carRevenue += t.carRevenue
            point.motorbikeRevenue += t.motorbikeRevenue
          }
          point.totalRevenue += row.totalRevenue
          point.totalSessions += row.totalSessions
          point.carSessions += row.carSessions
          point.motorbikeSessions += row.motorbikeSessions
          if (row.totalSessions > 0) point.byLot.push(row)
        }
        point.byLot.sort(byName)
        return point
      })
      return { startDate: query.startDate, endDate: query.endDate, granularity, points }
    }),
}
