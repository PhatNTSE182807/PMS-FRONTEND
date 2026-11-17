import type {
  PublicLotPriceDTO,
  PricingHistoryEntryDTO,
  PricingRuleDraftDTO,
  PricingRuleDTO,
  PricingRuleInput,
  PricingRuleStatus,
  SavePricingRuleDraftInput,
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

const stores = new Map<string, PricingRuleDTO[]>()
let nextId = 100

/** Demo price drafts per lot; like the API, applied or discarded drafts are kept but no longer listed. */
const draftStores = new Map<string, PricingRuleDraftDTO[]>()
let nextDraftId = 1
const drafts = (lotId: string) => {
  if (!draftStores.has(lotId)) draftStores.set(lotId, [])
  return draftStores.get(lotId)!
}

/** Demo pricing history per lot, newest first, written like the API does on every change. */
const historyStores = new Map<string, PricingHistoryEntryDTO[]>()
let nextHistoryId = 1
const HISTORY_FIELDS = [
  'name', 'chargeModel', 'entryFee', 'firstBlockMinutes', 'firstBlockPrice', 'blockMinutes', 'blockPrice', 'dayStartTime',
  'nightStartTime', 'dayPrice', 'nightPrice', 'maxDailyFee', 'lostTicketFee', 'bookedBayCompensation', 'penaltyFee', 'status',
] as const

function log(lotId: string, rule: PricingRuleDTO, changeType: string, before: object | null, after: object | null, reason: string, draftId: number | null = null) {
  const b = (before ?? {}) as Record<string, string | number | null>
  const a = (after ?? {}) as Record<string, string | number | null>
  const changes = HISTORY_FIELDS.flatMap((field) => {
    if (changeType === 'Create') return a[field] != null && field !== 'status' ? [{ field, oldValue: null, newValue: a[field] }] : []
    if (!(field in b) || !(field in a) || b[field] === a[field]) return []
    return [{ field, oldValue: b[field] ?? null, newValue: a[field] ?? null }]
  })
  if (!historyStores.has(lotId)) historyStores.set(lotId, [])
  historyStores.get(lotId)!.unshift({
    id: nextHistoryId++,
    pricingRuleId: rule.id,
    ruleName: (a.name as string) ?? rule.name,
    vehicleTypeCode: rule.vehicleTypeCode,
    vehicleTypeName: rule.vehicleTypeName,
    changeType,
    versionNo: changeType === 'Update' || changeType === 'Create' ? rule.versionNo : null,
    draftId,
    changedBy: null,
    changedByName: 'Demo Manager',
    changedByRole: 'Manager',
    changedAt: new Date().toISOString(),
    reason,
    changes,
  })
}

function openDraft(lotId: string, ruleId: number, draftId: number) {
  const draft = drafts(lotId).find((d) => d.id === draftId && d.pricingRuleId === ruleId)
  if (!draft) mockFail(404, 'Price draft not found.')
  if (draft.status !== 'Open') mockFail(400, draft.status === 'Applied' ? 'This draft has already been applied.' : 'This draft has been discarded.')
  return draft
}

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

/** The rule the gate would use for a vehicle type: the Active one (latest version first). */
function activeFor(lotId: string, vehicleTypeId: number | undefined) {
  return store(lotId)
    .filter((r) => r.status === 'Active' && r.vehicleTypeId === vehicleTypeId)
    .sort((a, b) => b.priority - a.priority || b.versionNo - a.versionNo)[0]
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
      log(lotId, rule, 'Create', null, { ...rule }, 'Created initial pricing rule')
      return rule
    }),

  update: (lotId: string, id: number, input: PricingRuleInput) =>
    mockResponse(() => {
      const rule = find(lotId, id)
      const before = { ...rule }
      apply(rule, input)
      rule.versionNo++
      rule.updatedAt = new Date().toISOString()
      log(lotId, rule, 'Update', before, { ...rule }, 'Updated pricing rule parameters')
      return rule
    }),

  setStatus: (lotId: string, id: number, status: PricingRuleStatus) =>
    mockResponse(() => {
      const rule = find(lotId, id)
      log(lotId, rule, 'StatusChange', { status: rule.status }, { status }, `Status changed from ${rule.status} to ${status}`)
      rule.status = status
      rule.updatedAt = new Date().toISOString()
      return rule
    }),

  remove: (lotId: string, id: number) =>
    mockResponse(() => {
      // Like the API: archived, never deleted (pricing history is kept)
      const rule = find(lotId, id)
      log(lotId, rule, 'Delete', { status: rule.status }, { status: 'Archived' }, 'Pricing rule archived')
      rule.status = 'Archived'
      return true
    }),

  history: (lotId: string, ruleId: number | null, take: number) =>
    mockResponse(() => (historyStores.get(lotId) ?? []).filter((h) => ruleId == null || h.pricingRuleId === ruleId).slice(0, take)),

  drafts: (lotId: string) =>
    mockResponse(() =>
      drafts(lotId)
        .filter((d) => d.status === 'Open' && store(lotId).some((r) => r.id === d.pricingRuleId && r.status !== 'Archived'))
        .map((d) => ({ ...d, currentVersionNo: find(lotId, d.pricingRuleId).versionNo })),
    ),

  createDraft: (lotId: string, ruleId: number, input: SavePricingRuleDraftInput) =>
    mockResponse(() => {
      const rule = find(lotId, ruleId)
      const draft: PricingRuleDraftDTO = {
        id: nextDraftId++,
        pricingRuleId: ruleId,
        values: input.values,
        note: input.note?.trim() || null,
        baseVersionNo: rule.versionNo,
        currentVersionNo: rule.versionNo,
        status: 'Open',
        createdBy: null,
        createdByName: 'Demo Manager',
        createdAt: new Date().toISOString(),
        updatedAt: null,
      }
      drafts(lotId).unshift(draft)
      log(lotId, rule, 'DraftSaved', { ...rule }, { ...input.values }, `Saved price draft #${draft.id}`, draft.id)
      return draft
    }),

  updateDraft: (lotId: string, ruleId: number, draftId: number, input: SavePricingRuleDraftInput) =>
    mockResponse(() => {
      const draft = openDraft(lotId, ruleId, draftId)
      draft.values = input.values
      draft.note = input.note?.trim() || null
      draft.baseVersionNo = find(lotId, ruleId).versionNo
      draft.updatedAt = new Date().toISOString()
      log(lotId, find(lotId, ruleId), 'DraftUpdated', { ...find(lotId, ruleId) }, { ...input.values }, `Edited price draft #${draft.id}`, draft.id)
      return { ...draft, currentVersionNo: draft.baseVersionNo }
    }),

  /** Like the API: only the prices and name come from the draft, the rule keeps its status. */
  applyDraft: (lotId: string, ruleId: number, draftId: number) =>
    mockResponse(() => {
      const draft = openDraft(lotId, ruleId, draftId)
      const rule = find(lotId, ruleId)
      const before = { ...rule }
      apply(rule, { ...draft.values, vehicleTypeId: rule.vehicleTypeId, status: rule.status })
      rule.versionNo++
      rule.updatedAt = new Date().toISOString()
      draft.status = 'Applied'
      log(lotId, rule, 'Update', before, { ...rule }, `Applied price draft #${draft.id}`, draft.id)
      return rule
    }),

  discardDraft: (lotId: string, ruleId: number, draftId: number) =>
    mockResponse(() => {
      const draft = openDraft(lotId, ruleId, draftId)
      draft.status = 'Discarded'
      log(lotId, find(lotId, ruleId), 'DraftDiscarded', null, null, `Discarded price draft #${draft.id}`, draft.id)
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
}
