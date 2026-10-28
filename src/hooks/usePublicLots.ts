import { useQuery } from '@tanstack/react-query'
import { publicLotService } from '@/api/publicLot.service'
import { queryKeys } from '@/api/queryKeys'

/** How often the homepage refreshes free bays (the endpoint allows 120 calls a minute per client). */
export const PUBLIC_LOTS_REFRESH_MS = 30_000

/** Public parking lots with live free bays; refreshed while the page is visible. */
export function usePublicLots() {
  return useQuery({
    queryKey: queryKeys.parking.publicLots(),
    queryFn: publicLotService.list,
    refetchInterval: PUBLIC_LOTS_REFRESH_MS,
    refetchIntervalInBackground: false,
  })
}
