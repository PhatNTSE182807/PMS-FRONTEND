/*
 * Pricing rules of a lot: PMS.API ManagerPricingController (/manager/lots/{lotId}/pricing-rules).
 * The gates charge with the lot's Active rule for the vehicle type (the one valid at entry).
 * Only the fields the gate's fee calculator uses are edited in the UI.
 */

/** "Block": one price per block all day. "DayNight": block price depends on the hour the block starts. "PerEntry": one flat fee per calendar day. */
export type PricingChargeModel = 'Block' | 'DayNight' | 'Hourly' | 'PerEntry'
export type PricingRuleStatus = 'Draft' | 'Active' | 'Inactive' | 'Archived'

/**
 * What happened to the charging fields of a rule update. Only the PUT response carries it.
 *  - Applied: the new price is live for every vehicle entering from now on.
 *  - Unchanged: the request equals the live price.
 */
export type PriceUpdateStatus = 'Applied' | 'Unchanged'

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
}

/** The editable part of a rule (create and update share it). */
export interface PricingRuleInput {
  code?: string
  name: string
  vehicleTypeId: number
  chargeModel: PricingChargeModel
  /** "PerEntry": the flat fee per calendar day. Other models: added once on top of the blocks. */
  entryFee: number
  graceMinutes: number
  /** Not edited in the UI: an update sends the rule's own values so a save does not reset them. */
  overnightSurcharge?: number
  overstayAfterHours?: number | null
  overstaySurchargePerDay?: number
  noShowFee?: number
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
  chargeModel: 'Block' | 'DayNight' | 'PerEntry'
  /** "PerEntry": the fee per calendar day. Other models: added once on top of the blocks. */
  entryFee: number
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
