import { useQuery } from '@tanstack/react-query'
import { ANPR_SERVICE_URL, anprService } from '@/api/anpr.service'
import { queryKeys } from '@/api/queryKeys'

/** Below this the gate asks the Staff to confirm the plate (backend Parking:Gate:AnprConfidenceThreshold). */
export const ANPR_CONFIDENCE_THRESHOLD = 0.85

export type AnprStatus = 'off' | 'offline' | 'untrained' | 'ready'

/** Whether the plate reader service answers and has its trained models (checked every 30 s). */
export function useAnprStatus(): AnprStatus {
  const health = useQuery({
    queryKey: queryKeys.gate.anprHealth(),
    queryFn: anprService.health,
    enabled: Boolean(ANPR_SERVICE_URL),
    refetchInterval: 30_000,
    retry: false,
  })
  if (!ANPR_SERVICE_URL) return 'off'
  if (!health.data) return 'offline'
  return health.data.ready ? 'ready' : 'untrained'
}
