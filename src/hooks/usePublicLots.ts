import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { publicLotService } from '@/api/publicLot.service'
import { queryKeys } from '@/api/queryKeys'
import { lotRealtime } from '@/api/realtime'

/** Fallback refresh of free bays when no push arrives (the endpoint allows 120 calls a minute per client). */
export const PUBLIC_LOTS_REFRESH_MS = 30_000
/** Pushes that arrive close together (a busy gate) trigger one reload. */
const PUSH_DEBOUNCE_MS = 1_000

/**
 * Public parking lots with live free bays. Each lot's public real-time channel reloads the list as
 * soon as a vehicle enters or leaves, a bay is held or released, or the lot opens or closes;
 * polling stays on as a fallback.
 */
export function usePublicLots() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.parking.publicLots(),
    queryFn: publicLotService.list,
    refetchInterval: PUBLIC_LOTS_REFRESH_MS,
    refetchIntervalInBackground: false,
  })

  // Re-subscribe only when the set of lots changes, not on every count update
  const lotIdsKey = useMemo(() => (query.data ?? []).map((lot) => lot.id).sort((a, b) => a - b).join(','), [query.data])

  useEffect(() => {
    if (!lotIdsKey) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const reload = () => {
      clearTimeout(timer)
      timer = setTimeout(() => void queryClient.invalidateQueries({ queryKey: queryKeys.parking.publicLots() }), PUSH_DEBOUNCE_MS)
    }
    const stops = lotIdsKey.split(',').map((lotId) =>
      lotRealtime.watch(lotId, {
        onConnectionChange: () => undefined,
        onEvent: (event) => {
          if (event.type === 'ZoneCounterChanged' || event.type === 'LotStatusChanged') reload()
        },
      }),
    )
    return () => {
      clearTimeout(timer)
      stops.forEach((stop) => stop())
    }
  }, [lotIdsKey, queryClient])

  return query
}
