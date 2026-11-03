/*
 * Pricing rules of a lot: PMS.API ManagerPricingController (/manager/lots/{lotId}/pricing-rules).
 * The gates charge with the lot's Active rule for the vehicle type (the one valid at entry).
 * Only the fields the gate's fee calculator uses are edited in the UI.
 */

/** "Block": one price per block all day. "DayNight": block price depends on the hour the block starts. */
export type PricingChargeModel = 'Block' | 'DayNight' | 'Hourly' | 'PerEntry'
export type PricingRuleStatus = 'Draft' | 'Active' | 'Inactive' | 'Archived'

/**
 * What happened to the charging fields of a rule update. Only the PUT response carries it; the list and the
 * single-rule reads leave it null, so a rule that is waiting is recognised by `pendingPrice`.
 *  - Applied: the lot was empty, the new price is live.
 *  - Pending: vehicles are inside, the new price is saved and goes live when the last one leaves.
 *  - Unchanged: the request equals the live price; any waiting price was withdrawn.
 */
export type PriceUpdateStatus = 'Applied' | 'Pending' | 'Unchanged'

/** PricingRulePrices: the charging fields of a rule, i.e. what a price change replaces as a whole. */
export interface PendingPricesDTO {
  chargeModel: PricingChargeModel
  entryFee: number
  firstBlockMinutes: number | null
  firstBlockPrice: number | null
  blockMinutes: number | null
  blockPrice: number | null
  dayStartTime: string | null
  nightStartTime: string | null
  dayPrice: number | null
  nightPrice: number | null
  maxDailyFee: number | null
  graceMinutes: number
  overnightSurcharge: number
  overstayAfterHours: number | null
  overstaySurchargePerDay: number
  lostTicketFee: number
  noShowFee: number
}

/** PendingPriceModel: a price waiting for the lot to become empty. The rule's own fields stay the live price. */
export interface PendingPriceDTO {
  prices: PendingPricesDTO
  /** The same price in words, e.g. "25,000 VND per 60 min". */
  summary: string
  /** 1 for the first request; +1 each time the Manager replaced it before it was applied. */
  revisionNo: number
  requestedBy: string
  requestedAt: string
  updatedAt: string | null
}

/** PricingRuleModel */
export interface PricingRuleDTO {
  id: number
  code: string
  name: string
  parkingLotId: number | null
  zoneId: number | null
  vehicleTypeId: number
  vehicleTypeCode: string
  vehicleTypeName: string
  chargeModel: PricingChargeModel
  entryFee: number
  /** First block: billed once on the first day, past the grace period. */
  firstBlockMinutes: number | null
  firstBlockPrice: number | null
  /** Every later started block. */
  blockMinutes: number | null
  blockPrice: number | null
  /** "HH:mm:ss": DayNight blocks starting in [dayStartTime, nightStartTime) cost dayPrice, others nightPrice. */
  dayStartTime: string | null
  nightStartTime: string | null
  dayPrice: number | null
  nightPrice: number | null
  /** Cap per calendar day. */
  maxDailyFee: number | null
  graceMinutes: number
  overnightSurcharge: number
  overstayAfterHours: number | null
  overstaySurchargePerDay: number
  lostTicketFee: number
  noShowFee: number
  currency: string
  priority: number
  effectiveFrom: string
  effectiveTo: string | null
  status: PricingRuleStatus
  versionNo: number
  createdAt: string
  updatedAt: string | null
  /** Set on the PUT response only (see PriceUpdateStatus). */
  priceUpdateStatus?: PriceUpdateStatus | null
  /** The price waiting for an empty lot; null or missing when none. */
  pendingPrice?: PendingPriceDTO | null
}

/** The editable part of a rule (create and update share it). */
export interface PricingRuleInput {
  code?: string
  name: string
  vehicleTypeId: number
  chargeModel: PricingChargeModel
  graceMinutes: number
  firstBlockMinutes: number | null
  firstBlockPrice: number | null
  blockMinutes: number
  blockPrice: number
  dayStartTime: string | null
  nightStartTime: string | null
  dayPrice: number | null
  nightPrice: number | null
  maxDailyFee: number | null
  lostTicketFee: number
  status?: PricingRuleStatus
  /** Kept from the rule on update (the API requires it). */
  effectiveFrom?: string
  reason?: string
}

/** GET /public/lots/{id}/prices: what the gates charge now for one vehicle type (anonymous). */
export interface PublicLotPriceDTO {
  vehicleTypeId: number
  vehicleTypeCode: string
  vehicleTypeName: string
  chargeModel: 'Block' | 'DayNight'
  graceMinutes: number
  firstBlockMinutes: number | null
  firstBlockPrice: number | null
  blockMinutes: number
  blockPrice: number
  dayStartTime: string | null
  nightStartTime: string | null
  dayPrice: number | null
  nightPrice: number | null
  maxDailyFee: number | null
}

/** PricingSimulationRequestModel: with ruleId one rule is tried; without it the rule the gate would pick. */
export interface PricingSimulationRequest {
  ruleId?: number
  vehicleTypeId?: number
  entryTime: string
  exitTime: string
  depositAmount: number
  isLostTicket: boolean
}

/** FeeDayModel: one calendar day of the stay. */
export interface PricingFeeDay {
  date: string
  minutes: number
  blocks: number
  amount: number
  capped: boolean
}

/** PricingSimulationResultModel */
export interface PricingSimulationResult {
  durationMinutes: number
  withinGrace: boolean
  grossFee: number
  lostTicketFee: number
  exitWindowLateFee: number
  depositApplied: number
  depositRefund: number
  amountDue: number
  days: PricingFeeDay[]
  ruleId: number | null
  ruleVersion: number | null
  ruleName: string
}
