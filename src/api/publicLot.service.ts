import { SERVICE_PATHS } from '@/config/env'
import type { PublicLotDTO } from '@/types/publicLot.dto'
import { http } from './axiosClient'

/**
 * Public parking lots with live free bays, for anonymous visitors (homepage).
 * Always read from the API, even in mock or demo mode: the homepage shows the system's real counts.
 */
export const publicLotService = {
  /** GET /public/lots: every open or maintenance lot, with free and total bays per vehicle family. */
  list(): Promise<PublicLotDTO[]> {
    return http.get<PublicLotDTO[]>(`${SERVICE_PATHS.parking}/public/lots`)
  },
}
