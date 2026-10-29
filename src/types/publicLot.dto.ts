/**
 * Public parking lot list (PMS.API LotsController, GET /public/lots, anonymous and rate limited).
 * Mirrors PublicParkingLotResponseModel. Counts only: public endpoints never send plates.
 */

/** Vehicle family of a group of bays: 4- and 7-seat cars share bays. */
export type PublicBayVehicleType = 'CAR' | 'MOTORBIKE'

/** PublicLotBaysModel: free and total bays of one vehicle family in a lot. */
export interface PublicLotBaysDTO {
  vehicleType: PublicBayVehicleType
  totalBays: number
  freeBays: number
}

/** PublicParkingLotResponseModel */
export interface PublicLotDTO {
  id: number
  code: string
  name: string
  address: string
  city: string | null
  district: string | null
  layoutTemplate: string | null
  /** Active, or Maintenance (also while the lot has no Manager and Staff on duty). */
  status: string
  /** False while the lot is under maintenance: customers can look at it but not book it. */
  isBookable: boolean
  /** Why it cannot be booked, in plain words; null when it can. */
  maintenanceNotice: string | null
  /** Bays in the lot's active zones. */
  totalBays: number
  /** Bays free right now (live zone counters). */
  freeBays: number
  baysByVehicle: PublicLotBaysDTO[]
}
