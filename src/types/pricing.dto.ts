/*
 * Pricing rules of a lot: PMS.API ManagerPricingController (/manager/lots/{lotId}/pricing-rules).
 * The gates charge with the lot's Active rule for the vehicle type (the one valid at entry).
 * Only the fields the gate's fee calculator uses are edited in the UI.
 */

/** "Block": one price per block all day. "DayNight": block price depends on the hour the block starts. */
export type PricingChargeModel = 'Block' | 'DayNight' | 'Hourly' | 'PerEntry'
export type PricingRuleStatus = 'Draft' | 'Active' | 'Inactive' | 'Archived'

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
