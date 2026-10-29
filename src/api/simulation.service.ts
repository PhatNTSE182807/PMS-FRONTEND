import { SERVICE_PATHS } from '@/config/env'
import type { ParkingSimulationDTO, UpdateParkingSimulationCommand } from '@/types/simulation.dto'
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
