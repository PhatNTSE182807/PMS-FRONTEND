import type {
  PublicLotPriceDTO,
  PricingRuleDTO,
  PricingRuleInput,
  PricingRuleStatus,
  PricingSimulationRequest,
  PricingSimulationResult,
} from '@/types/pricing.dto'
import { mockFail, mockResponse } from './mockApi'

/*
 * Demo-mode pricing rules: one store per lot, seeded with the API's default tariffs (SRS fee example
 * for cars). simulate() mirrors the backend FeeCalculator so the demo calculator matches the gates.
 */

/** Same ids and codes as profile.mock vehicle types. */
const TYPES = [
  { id: 1, code: 'CAR_4', name: '4-Seat Car' },
  { id: 2, code: 'CAR_7', name: '7-Seat Car' },
  { id: 3, code: 'MOTORBIKE', name: 'Motorbike' },
]

/** Fees are rounded up to 1,000 VND, like the gates. */
const ROUNDING_STEP = 1_000


const stores = new Map<string, PricingRuleDTO[]>()
let nextId = 100

function seed(lotId: string): PricingRuleDTO[] {
  const now = new Date().toISOString()
  const base = (id: number, typeId: number, code: string, name: string, block: number, price: number, cap: number, lost: number): PricingRuleDTO => {
    const type = TYPES.find((t) => t.id === typeId)!
    return {
      id, code, name, parkingLotId: Number(lotId) || null, zoneId: null,
      vehicleTypeId: type.id, vehicleTypeCode: type.code, vehicleTypeName: type.name,
      chargeModel: 'Block', entryFee: 0, firstBlockMinutes: null, firstBlockPrice: null,
      blockMinutes: block, blockPrice: price, dayStartTime: null, nightStartTime: null, dayPrice: null, nightPrice: null,
      maxDailyFee: cap, graceMinutes: 0, overnightSurcharge: 0, overstayAfterHours: null, overstaySurchargePerDay: 0,
      lostTicketFee: lost, noShowFee: 0, bookedBayCompensation: type.code === 'MOTORBIKE' ? 50_000 : 100_000, currency: 'VND', priority: 0, effectiveFrom: '2026-01-01T00:00:00Z', effectiveTo: null,
      status: 'Active', versionNo: 1, createdAt: now, updatedAt: null,
    }
  }
  return [
    base(1, 1, 'CAR4-STD', '4-seat cars', 60, 20_000, 150_000, 100_000),
    base(2, 2, 'CAR7-STD', '7-seat cars', 60, 20_000, 150_000, 100_000),
    base(3, 3, 'MOTO-STD', 'Motorbikes', 240, 5_000, 20_000, 50_000),
  ]
}

function store(lotId: string): PricingRuleDTO[] {
  if (!stores.has(lotId)) stores.set(lotId, seed(lotId))
  return stores.get(lotId)!
}

function find(lotId: string, id: number): PricingRuleDTO {
  const rule = store(lotId).find((r) => r.id === id && r.status !== 'Archived')
  if (!rule) mockFail(404, 'Pricing rule not found.')
  return rule
}

function apply(rule: PricingRuleDTO, input: PricingRuleInput) {
  const type = TYPES.find((t) => t.id === input.vehicleTypeId)
  if (!type) mockFail(400, 'This vehicle type does not exist or is inactive.')
  Object.assign(rule, {
    name: input.name.trim(),
    vehicleTypeId: type.id,
    vehicleTypeCode: type.code,
    vehicleTypeName: type.name,
    chargeModel: input.chargeModel,
    entryFee: input.entryFee,
    graceMinutes: input.graceMinutes,
    firstBlockMinutes: input.firstBlockMinutes,
    firstBlockPrice: input.firstBlockPrice,
    blockMinutes: input.blockMinutes,
    blockPrice: input.blockPrice,
    dayStartTime: input.dayStartTime,
    nightStartTime: input.nightStartTime,
    dayPrice: input.dayPrice,
    nightPrice: input.nightPrice,
    maxDailyFee: input.maxDailyFee,
    lostTicketFee: input.lostTicketFee,
    bookedBayCompensation: input.bookedBayCompensation,
  })
}

/** Minutes since midnight of an "HH:mm(:ss)" time. */
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Price of one block starting at `start` (local time), like FeeCalculator.BlockPrice. */
function blockPrice(rule: PricingRuleDTO, start: Date): number {
  const fallback = rule.blockPrice ?? 0
  if (rule.chargeModel !== 'DayNight' || !rule.dayStartTime || !rule.nightStartTime) return fallback
  const t = start.getHours() * 60 + start.getMinutes()
  const day = toMinutes(rule.dayStartTime)
  const night = toMinutes(rule.nightStartTime)
  const isDay = day <= night ? t >= day && t < night : t >= day || t < night
  return (isDay ? rule.dayPrice : rule.nightPrice) ?? fallback
}

/** The rule the gate would use for a vehicle type: the Active one (latest version first). */
function activeFor(lotId: string, vehicleTypeId: number | undefined) {
  return store(lotId)
    .filter((r) => r.status === 'Active' && r.vehicleTypeId === vehicleTypeId)
    .sort((a, b) => b.priority - a.priority || b.versionNo - a.versionNo)[0]
}

/** Mirror of the backend FeeCalculator.Calculate + Settle for one stay. */
function simulate(rule: PricingRuleDTO, request: PricingSimulationRequest): PricingSimulationResult {
  const entry = new Date(request.entryTime)
  const exit = new Date(request.exitTime)
  const duration = Math.max(0, Math.ceil((exit.getTime() - entry.getTime()) / 60_000))
  const days: PricingSimulationResult['days'] = []
  let gross = 0
  // No free period: the first block is owed from entry, even for a stay of one minute
  const withinGrace = false
  const end = exit > entry ? exit : new Date(entry.getTime() + 60_000)
  {
    // Split the stay at local midnights; the daily cap applies per calendar day
    let dayStart = entry
    let first = true
    while (dayStart < end) {
      const midnight = new Date(dayStart)
      midnight.setHours(24, 0, 0, 0)
      const dayEnd = end < midnight ? end : midnight
      let remaining = Math.ceil((dayEnd.getTime() - dayStart.getTime()) / 60_000)
      const minutes = remaining
      let cursor = new Date(dayStart)
      let blocks = 0
      let amount = 0
      if (rule.chargeModel === 'PerEntry') {
        blocks = 1
        amount = rule.entryFee
        remaining = 0
      } else if (first && rule.firstBlockMinutes && rule.firstBlockPrice != null) {
        blocks++
        amount += rule.firstBlockPrice
        remaining -= rule.firstBlockMinutes
        cursor = new Date(cursor.getTime() + rule.firstBlockMinutes * 60_000)
      }
      const size = rule.blockMinutes && rule.blockMinutes > 0 ? rule.blockMinutes : 60
      while (remaining > 0) {
        blocks++
        amount += blockPrice(rule, cursor)
        remaining -= size
        cursor = new Date(cursor.getTime() + size * 60_000)
      }
      const capped = rule.maxDailyFee != null && amount > rule.maxDailyFee
      if (capped) amount = rule.maxDailyFee!
      days.push({ date: dayStart.toISOString().slice(0, 10), minutes, blocks, amount, capped })
      gross += amount
      dayStart = dayEnd
      first = false
    }
    if (rule.chargeModel !== 'PerEntry') gross += rule.entryFee
  }
  const fee = gross <= 0 ? 0 : Math.ceil(gross / ROUNDING_STEP) * ROUNDING_STEP
  const lost = request.isLostTicket ? rule.lostTicketFee : 0
  const total = fee + lost
  const depositApplied = Math.min(request.depositAmount, total)
  return {
    durationMinutes: duration,
    withinGrace,
    grossFee: fee,
    lostTicketFee: lost,
    // The calculator never misses the exit window
    exitWindowLateFee: 0,
    depositApplied,
    depositRefund: request.depositAmount - depositApplied,
    amountDue: Math.max(0, total - request.depositAmount),
    days,
    ruleId: rule.id,
    ruleVersion: rule.versionNo,
    ruleName: rule.name,
  }
}

export const pricingMock = {
  list: (lotId: string) => mockResponse(() => store(lotId).filter((r) => r.status !== 'Archived')),

  create: (lotId: string, input: PricingRuleInput) =>
    mockResponse(() => {
      const code = (input.code ?? '').trim() || `RULE-${nextId}`
      if (store(lotId).some((r) => r.code === code && r.status !== 'Archived'))
        mockFail(409, `A pricing rule with code '${code}' already exists for this lot.`)
      const rule = { ...seed(lotId)[0], id: nextId++, code, status: input.status ?? 'Draft', versionNo: 1, createdAt: new Date().toISOString() } as PricingRuleDTO
      apply(rule, input)
      store(lotId).push(rule)
      return rule
    }),

  update: (lotId: string, id: number, input: PricingRuleInput) =>
    mockResponse(() => {
      const rule = find(lotId, id)
      apply(rule, input)
      rule.versionNo++
      rule.updatedAt = new Date().toISOString()
      return rule
    }),

  setStatus: (lotId: string, id: number, status: PricingRuleStatus) =>
    mockResponse(() => {
      const rule = find(lotId, id)
      rule.status = status
      rule.updatedAt = new Date().toISOString()
      return rule
    }),

  remove: (lotId: string, id: number) =>
    mockResponse(() => {
      // Like the API: archived, never deleted (pricing history is kept)
      find(lotId, id).status = 'Archived'
      return true
    }),

  /** Like GET /public/lots/{id}/prices: the Active rule of each vehicle type. */
  publicPrices: (lotId: string) =>
    mockResponse<PublicLotPriceDTO[]>(() =>
      TYPES.flatMap((type) => {
        const rule = activeFor(lotId, type.id)
        if (!rule) return []
        const dayNight = rule.chargeModel === 'DayNight'
        return [{
          vehicleTypeId: type.id,
          vehicleTypeCode: type.code,
          vehicleTypeName: type.name,
          chargeModel: dayNight ? 'DayNight' : rule.chargeModel === 'PerEntry' ? 'PerEntry' : 'Block',
          entryFee: rule.entryFee,
          graceMinutes: rule.graceMinutes,
          firstBlockMinutes: rule.firstBlockMinutes,
          firstBlockPrice: rule.firstBlockPrice,
          blockMinutes: rule.blockMinutes ?? 60,
          blockPrice: rule.blockPrice ?? 0,
          dayStartTime: dayNight ? rule.dayStartTime : null,
          nightStartTime: dayNight ? rule.nightStartTime : null,
          dayPrice: dayNight ? rule.dayPrice : null,
          nightPrice: dayNight ? rule.nightPrice : null,
          maxDailyFee: rule.maxDailyFee,
        } satisfies PublicLotPriceDTO]
      }),
    ),

  simulate: (lotId: string, request: PricingSimulationRequest) =>
    mockResponse(() => {
      if (new Date(request.exitTime) < new Date(request.entryTime)) mockFail(400, 'Exit time must be after the entry time.')
      const rule = request.ruleId ? find(lotId, request.ruleId) : activeFor(lotId, request.vehicleTypeId)
      if (!rule) mockFail(404, 'No active pricing rule for this vehicle type.')
      return simulate(rule, request)
    }),
}
