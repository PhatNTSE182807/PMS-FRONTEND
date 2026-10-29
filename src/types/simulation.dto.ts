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
