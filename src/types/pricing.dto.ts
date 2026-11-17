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
  /** Paid into the customer's XXIV wallet when a walk-in took their booked bay and no other bay was free. */
  bookedBayCompensation: number
  /** Owed at check-out by a vehicle Staff towed out of a booked bay (a walk-in in the wrong bay, or an overstay). */
  penaltyFee?: number
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
  /** Not a price: changing it never tells customers the price changed. */
  bookedBayCompensation: number
  /** Not a price either; left out, a new rule gets the default of its vehicle type. */
  penaltyFee?: number
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


/** PricingRuleDraftModel: a price change saved for later. The gates keep charging the live prices until it is applied. */
export interface PricingRuleDraftDTO {
  id: number
  pricingRuleId: number
  /** The proposed values, in the same shape as a rule update. */
  values: PricingRuleInput
  note: string | null
  /** The rule version the draft was based on. */
  baseVersionNo: number
  /** The rule's live version now: newer than baseVersionNo means the prices changed after the draft was saved. */
  currentVersionNo: number
  status: 'Open' | 'Applied' | 'Discarded'
  createdBy: string | null
  createdByName: string | null
  createdAt: string
  updatedAt: string | null
}

/** Body of POST / PUT .../pricing-rules/{id}/drafts. */
export interface SavePricingRuleDraftInput {
  values: PricingRuleInput
  note?: string | null
}

/** PricingRuleHistoryModel change types: rule changes, and price drafts saved, edited or discarded. */
export type PricingHistoryChangeType =
  | 'Create'
  | 'Update'
  | 'StatusChange'
  | 'Delete'
  | 'DraftSaved'
  | 'DraftUpdated'
  | 'DraftDiscarded'

/** One changed field with its raw old and new values (numbers, "HH:mm:ss" times, text or null). */
export interface PricingFieldChangeDTO {
  /** camelCase rule field, e.g. "blockPrice", "maxDailyFee", "status". */
  field: string
  oldValue: string | number | null
  newValue: string | number | null
}

/** GET /manager/lots/{lotId}/pricing-rules/history: one entry, newest first. The lot's Manager and every Admin can read it. */
export interface PricingHistoryEntryDTO {
  id: number
  pricingRuleId: number
  ruleName: string | null
  vehicleTypeCode: string | null
  vehicleTypeName: string | null
  changeType: PricingHistoryChangeType | string
  versionNo: number | null
  /** Set on draft rows and on an Update that applied a draft. */
  draftId: number | null
  changedBy: string | null
  changedByName: string | null
  /** "Admin" or "Manager" when known. */
  changedByRole: string | null
  changedAt: string
  reason: string | null
  /** For a created rule its starting values (oldValue null); for a draft what it proposed. */
  changes: PricingFieldChangeDTO[]
}
