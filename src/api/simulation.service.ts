import { SERVICE_PATHS } from '@/config/env'
import type {
  BookedBayTakenDTO,
  DeployWalkInsCommand,
  DeployWalkInsResultDTO,
  ParkingSimulationDTO,
  SimulatedWalkInDTO,
  UpdateParkingSimulationCommand,
  WalkInCheckOutResultDTO,
  WalkInSimulationOverviewDTO,
} from '@/types/simulation.dto'
import { http } from './axiosClient'

/**
 * Admin parking simulation: fees and booking times in seconds, in every lot. Always the real API,
 * since the point is to drive the real gates and bookings.
 */
export const simulationService = {
  /** GET /admin/simulation */
  get(): Promise<ParkingSimulationDTO> {
    return http.get<ParkingSimulationDTO>(`${SERVICE_PATHS.staff}/simulation`)
  },

  /** PUT /admin/simulation: saves and applies at once. */
  update(command: UpdateParkingSimulationCommand): Promise<ParkingSimulationDTO> {
    return http.put<ParkingSimulationDTO>(`${SERVICE_PATHS.staff}/simulation`, command)
  },
}

const walkIns = `${SERVICE_PATHS.staff}/simulation/walk-ins`

/** Admin simulation: ends the business day now (one lot or all); open cash drawers must close within the grace seconds. */
export function endBusinessDay(lotId: number | undefined, graceSeconds: number): Promise<{ drawersToClose: number; closeDueAt: string }> {
  return http.post<{ drawersToClose: number; closeDueAt: string }>(`${SERVICE_PATHS.staff}/simulation/end-business-day`, { lotId, graceSeconds })
}

/** Admin walk-in simulation: random-plate vehicles through the real entry and exit lanes. */
export const walkInSimulationService = {
  /** GET /admin/simulation/walk-ins: simulated vehicles inside, how many left and what they paid. */
  overview(lotId?: number): Promise<WalkInSimulationOverviewDTO> {
    return http.get<WalkInSimulationOverviewDTO>(walkIns, { params: lotId ? { lotId } : undefined })
  },

  /** POST /admin/simulation/walk-ins: send a batch in. */
  deploy(command: DeployWalkInsCommand): Promise<DeployWalkInsResultDTO> {
    return http.post<DeployWalkInsResultDTO>(walkIns, command)
  },

  /** One vehicle pays cash at the exit lane and leaves now. */
  checkOut(sessionId: number): Promise<SimulatedWalkInDTO | null> {
    return http.post<SimulatedWalkInDTO | null>(`${walkIns}/${sessionId}/check-out`)
  },

  /** Every simulated vehicle (of one lot, or all) pays and leaves now. */
  checkOutAll(lotId?: number): Promise<WalkInCheckOutResultDTO> {
    return http.post<WalkInCheckOutResultDTO>(`${walkIns}/check-out-all`, undefined, { params: lotId ? { lotId } : undefined })
  },

  /** The driver reports a lost ticket: approved on the spot (conditions met) or sent to the lot's Manager. */
  reportLostTicket(sessionId: number, conditionsMet: boolean): Promise<SimulatedWalkInDTO | null> {
    return http.post<SimulatedWalkInDTO | null>(`${walkIns}/${sessionId}/lost-ticket`, { conditionsMet })
  },

  /** A walk-in parks in the bay of the lot's next confirmed booking. */
  occupyBookedBay(lotId: number): Promise<BookedBayTakenDTO> {
    return http.post<BookedBayTakenDTO>(`${walkIns}/occupy-booked-bay`, undefined, { params: { lotId } })
  },
}
