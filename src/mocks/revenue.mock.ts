import { toIsoDate } from '@/lib/format'
import type { PaginatedResponse } from '@/types/common.dto'
import type {
  PaymentMethod,
  PaymentMethodBreakdownDTO,
  RevenueBreakdownQuery,
  RevenueBreakdownRowDTO,
  RevenueByParkingLotDTO,
  RevenueFilterQuery,
  RevenueKpiSummaryDTO,
  RevenueTimeSeriesDTO,
  RevenueTimeSeriesResultDTO,
} from '@/types/report.dto'
import { mockFail, mockResponse } from './mockApi'
import { MOCK_PARKING_LOTS, type MockParkingLot } from './parkingLots.mock'
import { createRandom, hashString, jitter } from './random'

const DAY_MS = 24 * 60 * 60 * 1000
const BICYCLE_FEE = 2_000
/** Blended monthly pass price per subscriber (mostly motorbikes, some cars). */
const MONTHLY_PASS_PRICE = 400_000
/** How subscription revenue splits across vehicle types (car passes cost ~12× more). */
const SUBSCRIPTION_SHARE = { car: 0.6, motorbike: 0.38, bicycle: 0.02 }
/** Ranges longer than this are charted per month instead of per day. */
const MAX_DAILY_POINTS = 62
const MAX_RANGE_DAYS = 400
const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'QR_BANKING', 'RFID_WALLET']

interface DailyMetrics {
  date: string
  lot: MockParkingLot
  motorbikeCount: number
  carCount: number
  bicycleCount: number
  carRevenue: number
  motorbikeRevenue: number
  bicycleRevenue: number
  walkInRevenue: number
  subscriptionRevenue: number
  totalRevenue: number
  transactions: number
}

const parseDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Calendar arithmetic (not +24h), so DST changes never skip or repeat a day. */
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

const daysBetween = (start: string, end: string) =>
  Math.round((parseDate(end).getTime() - parseDate(start).getTime()) / DAY_MS) + 1

function eachDate(start: string, end: string): string[] {
  const dates: string[] = []
  for (let d = parseDate(start); d <= parseDate(end); d = addDays(d, 1)) {
    dates.push(toIsoDate(d))
  }
  return dates
}

const metricsCache = new Map<string, Omit<DailyMetrics, 'lot'>>()

/** Raw (unfiltered) metrics of one lot on one day — deterministic for a given date. */
function rawDailyMetrics(lot: MockParkingLot, date: string) {
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

  const motorbikeCount = Math.round(lot.dailyMotorbikes * volume * jitter(random, 0.12))
  const carCount = Math.round(lot.dailyCars * volume * jitter(random, 0.15))
  const bicycleCount = Math.round(lot.dailyBicycles * volume * jitter(random, 0.2))
  const subscriptionRevenue = Math.round(((lot.monthlySubscribers * MONTHLY_PASS_PRICE) / 30) * dayFraction * jitter(random, 0.08))

  const carWalkIn = Math.round(carCount * lot.carFee * jitter(random, 0.05))
  const motorbikeWalkIn = Math.round(motorbikeCount * lot.motorbikeFee * jitter(random, 0.05))
  const bicycleWalkIn = bicycleCount * BICYCLE_FEE

  const metrics = {
    date,
    motorbikeCount,
    carCount,
    bicycleCount,
    carRevenue: carWalkIn + Math.round(subscriptionRevenue * SUBSCRIPTION_SHARE.car),
    motorbikeRevenue: motorbikeWalkIn + Math.round(subscriptionRevenue * SUBSCRIPTION_SHARE.motorbike),
    bicycleRevenue: bicycleWalkIn + Math.round(subscriptionRevenue * SUBSCRIPTION_SHARE.bicycle),
    walkInRevenue: carWalkIn + motorbikeWalkIn + bicycleWalkIn,
    subscriptionRevenue,
    totalRevenue: 0,
    // Every walk-in exit is a transaction, plus the day's share of pass renewals.
    transactions: motorbikeCount + carCount + bicycleCount + Math.round((lot.monthlySubscribers / 30) * dayFraction),
  }
  metrics.totalRevenue = metrics.walkInRevenue + subscriptionRevenue
  // Today's figures keep growing, so only closed days are cached.
  if (date < today) metricsCache.set(key, metrics)
  return metrics
}

/** Metrics restricted to the vehicle type in the filter. */
function dailyMetrics(lot: MockParkingLot, date: string, vehicleType: RevenueFilterQuery['vehicleType']): DailyMetrics {
  const raw = rawDailyMetrics(lot, date)
  if (!vehicleType || vehicleType === 'ALL') return { ...raw, lot }

  const keep = { CAR: 'car', MOTORBIKE: 'motorbike', BICYCLE: 'bicycle' } as const
  const kind = keep[vehicleType]
  const count = kind === 'car' ? raw.carCount : kind === 'motorbike' ? raw.motorbikeCount : raw.bicycleCount
  const revenue = kind === 'car' ? raw.carRevenue : kind === 'motorbike' ? raw.motorbikeRevenue : raw.bicycleRevenue
  const subscriptionRevenue = Math.round(raw.subscriptionRevenue * SUBSCRIPTION_SHARE[kind])

  return {
    ...raw,
    lot,
    carCount: kind === 'car' ? raw.carCount : 0,
    motorbikeCount: kind === 'motorbike' ? raw.motorbikeCount : 0,
    bicycleCount: kind === 'bicycle' ? raw.bicycleCount : 0,
    carRevenue: kind === 'car' ? revenue : 0,
    motorbikeRevenue: kind === 'motorbike' ? revenue : 0,
    bicycleRevenue: kind === 'bicycle' ? revenue : 0,
    walkInRevenue: revenue - subscriptionRevenue,
    subscriptionRevenue,
    totalRevenue: revenue,
    transactions: count,
  }
}

function validate(query: RevenueFilterQuery) {
  if (query.startDate > query.endDate) mockFail(400, 'The start date must be before the end date.')
  if (daysBetween(query.startDate, query.endDate) > MAX_RANGE_DAYS) {
    mockFail(400, `The maximum range is ${MAX_RANGE_DAYS} days.`)
  }
}

function collect(query: RevenueFilterQuery): DailyMetrics[] {
  validate(query)
  const lots = query.parkingLotId ? MOCK_PARKING_LOTS.filter((l) => l.id === query.parkingLotId) : MOCK_PARKING_LOTS
  const dates = eachDate(query.startDate, query.endDate)
  return dates.flatMap((date) => lots.map((lot) => dailyMetrics(lot, date, query.vehicleType)))
}

/** The period of equal length right before the selected one. */
function previousPeriod(query: RevenueFilterQuery): RevenueFilterQuery {
  const start = parseDate(query.startDate)
  const days = daysBetween(query.startDate, query.endDate)
  return {
    ...query,
    startDate: toIsoDate(addDays(start, -days)),
    endDate: toIsoDate(addDays(start, -1)),
  }
}

const sum = (rows: DailyMetrics[], pick: (row: DailyMetrics) => number) => rows.reduce((total, row) => total + pick(row), 0)
const growth = (current: number, previous: number) => (previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : 0)

export const revenueMock = {
  getKpiSummary: (query: RevenueFilterQuery): Promise<RevenueKpiSummaryDTO> =>
    mockResponse(() => {
      const current = collect(query)
      const previous = collect(previousPeriod(query))
      const totalRevenue = sum(current, (r) => r.totalRevenue)
      const totalTransactions = sum(current, (r) => r.transactions)
      return {
        totalRevenue,
        revenueGrowthPercent: growth(totalRevenue, sum(previous, (r) => r.totalRevenue)),
        totalTransactions,
        transactionGrowthPercent: growth(totalTransactions, sum(previous, (r) => r.transactions)),
        walkInRevenue: sum(current, (r) => r.walkInRevenue),
        subscriptionRevenue: sum(current, (r) => r.subscriptionRevenue),
      }
    }),

  getTimeSeries: (query: RevenueFilterQuery): Promise<RevenueTimeSeriesResultDTO> =>
    mockResponse(() => {
      const rows = collect(query)
      const granularity = daysBetween(query.startDate, query.endDate) > MAX_DAILY_POINTS ? 'MONTH' : 'DAY'

      const buckets = new Map<string, RevenueTimeSeriesDTO>()
      for (const row of rows) {
        const key = granularity === 'MONTH' ? `${row.date.slice(0, 7)}-01` : row.date
        const point = buckets.get(key) ?? { date: key, carRevenue: 0, motorbikeRevenue: 0, totalRevenue: 0 }
        point.carRevenue += row.carRevenue
        point.motorbikeRevenue += row.motorbikeRevenue
        point.totalRevenue += row.totalRevenue
        buckets.set(key, point)
      }
      return { granularity, points: [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date)) }
    }),

  getPaymentMethods: (query: RevenueFilterQuery): Promise<PaymentMethodBreakdownDTO[]> =>
    mockResponse(() => {
      const amounts = [0, 0, 0]
      for (const row of collect(query)) {
        const random = createRandom(hashString(`${row.lot.id}|${row.date}|pay`))
        const weights = row.lot.paymentMix.map((share) => share * jitter(random, 0.1))
        const total = weights.reduce((a, b) => a + b, 0)
        weights.forEach((w, i) => (amounts[i] += (row.totalRevenue * w) / total))
      }
      const grandTotal = amounts.reduce((a, b) => a + b, 0)
      return PAYMENT_METHODS.map((method, i) => ({
        method,
        amount: Math.round(amounts[i]),
        percentage: grandTotal > 0 ? Math.round((amounts[i] / grandTotal) * 1000) / 10 : 0,
      }))
    }),

  getRevenueByParkingLot: (query: RevenueFilterQuery): Promise<RevenueByParkingLotDTO[]> =>
    mockResponse(() => {
      const byLot = new Map<string, RevenueByParkingLotDTO>()
      for (const row of collect(query)) {
        const entry = byLot.get(row.lot.id) ?? {
          parkingLotId: row.lot.id,
          parkingLotName: row.lot.name,
          totalRevenue: 0,
          totalTransactions: 0,
        }
        entry.totalRevenue += row.totalRevenue
        entry.totalTransactions += row.transactions
        byLot.set(row.lot.id, entry)
      }
      return [...byLot.values()].sort((a, b) => b.totalRevenue - a.totalRevenue)
    }),

  getBreakdown: (query: RevenueBreakdownQuery): Promise<PaginatedResponse<RevenueBreakdownRowDTO>> =>
    mockResponse(() => {
      const rows = collect(query)
        .sort((a, b) => b.date.localeCompare(a.date) || a.lot.name.localeCompare(b.lot.name, 'en'))
        .map<RevenueBreakdownRowDTO>((r) => ({
          date: r.date,
          parkingLotId: r.lot.id,
          parkingLotName: r.lot.name,
          motorbikeCount: r.motorbikeCount,
          carCount: r.carCount,
          walkInRevenue: r.walkInRevenue,
          subscriptionRevenue: r.subscriptionRevenue,
          totalRevenue: r.totalRevenue,
        }))

      const pageSize = Math.max(1, query.pageSize)
      const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
      const pageNumber = Math.min(Math.max(1, query.pageNumber), totalPages)
      return {
        items: rows.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
        pageNumber,
        pageSize,
        totalCount: rows.length,
        totalPages,
      }
    }),
}
