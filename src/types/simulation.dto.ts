/* Mirrors PMS.Application.Models.Operations.ParkingSimulation* (AdminSimulationController, /admin/simulation). */

/** The simulated durations, all in seconds (1–3600). */
export interface ParkingSimulationTimes {
  /** Length of one pricing block: the block price is charged every N seconds instead of every hour. */
  blockSeconds: number
  /** Hold after arrival for a booking with a paid deposit. */
  depositHoldSeconds: number
  /** Hold after arrival for a booking without a deposit. */
  holdSeconds: number
  /** Time to pay the deposit after booking. */
  depositPaymentSeconds: number
  /** Check-in opens this long before arrival. */
  earlyArrivalSeconds: number
  /** Cancel (full refund) or change a booking until this long before arrival. */
  cancelRefundSeconds: number
  /** Time to leave after paying at the counter or in the app. */
  exitWindowSeconds: number
}

export interface UpdateParkingSimulationCommand extends ParkingSimulationTimes {
  enabled: boolean
}

/** The normal values the simulation replaces, in minutes. */
export interface ParkingSimulationNormalDTO {
  depositHoldMinutes: number
  holdMinutes: number
  depositPaymentMinutes: number
  earlyArrivalMinutes: number
  cancelRefundMinutes: number
  exitWindowMinutes: number
}

export interface ParkingSimulationDTO extends UpdateParkingSimulationCommand {
  normal: ParkingSimulationNormalDTO
  updatedAt?: string | null
  updatedBy?: string | null
}

export const SIMULATION_MIN_SECONDS = 1
export const SIMULATION_MAX_SECONDS = 3600

/* Walk-in simulation (WalkInSimulationModels, /admin/simulation/walk-ins). */

/** DeployWalkInsModel: a batch of walk-ins with random plates sent through the lot's entry lane. */
export interface DeployWalkInsCommand {
  lotId: number
  /** From 1 up to the lot's free bays; the batch stops early when a zone is full. Ignored when filling the lot. */
  count: number
  /** Fill the lot: one vehicle for every bay a walk-in may take (car bays get cars, motorbike bays motorbikes). */
  fillLot?: boolean
  /** Share of 4-seat cars, 0–100. */
  carPercent: number
  /** Share of 7-seat cars, 0–100; with the 4-seat share at most 100, the rest are motorbikes. */
  car7Percent: number
  /** Stay bounds in hours (at most 72). While the simulation is on, one hour lasts one pricing block. */
  minStayHours: number
  maxStayHours: number
}

export const WALK_IN_MAX_STAY_HOURS = 72

export interface DeployWalkInsResultDTO {
  requested: number
  entered: number
  /** Why the batch stopped early, in plain words; null when every vehicle entered. */
  stoppedReason: string | null
}

/** SimulatedWalkInModel: one simulated vehicle still inside. */
export interface SimulatedWalkInDTO {
  sessionId: number
  sessionCode: string
  lotId: number
  lotName: string
  /** Empty when the vehicle has no readable plate. */
  plate: string
  hasPlate: boolean
  vehicleTypeName: string | null
  zoneName: string | null
  entryTime: string
  plannedExitAt: string | null
  status: string
  lostTicket: boolean
}

export interface WalkInSimulationOverviewDTO {
  inside: SimulatedWalkInDTO[]
  completedCount: number
  revenue: number
  /** Bays of the chosen lot in active zones; null when no lot is chosen. */
  totalBays?: number | null
  /** Bays a vehicle can park in now: the most one batch can send; null when no lot is chosen. */
  freeBays?: number | null
}

export interface WalkInCheckOutResultDTO {
  checkedOut: number
  skipped: number
}

/**
 * BookedBayTakenModel: a simulated walk-in now stands in a booked bay. A case is open for the lot's Staff and the
 * booking's customer was told their bay is taken.
 */
export interface BookedBayTakenDTO {
  sessionId: number
  plate: string
  bayCode: string
  reservationId: number
  reservationCode: string
  /** The case opened for the lot's Staff; null when one was already open for that booking. */
  caseId: number | null
}
