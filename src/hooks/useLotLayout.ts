import { useQuery } from '@tanstack/react-query'
import { ApiError } from '@/api/apiError'
import { layoutService } from '@/api/layout.service'
import { queryKeys } from '@/api/queryKeys'
import { planToGarageFloors } from '@/lib/lot-layout'
import type { Layout2DDetail } from '@/types/layout.dto'
import type { LotRealtimeState } from './useLotRealtime'

/** Bay statuses reach the model within 2 s of a change (SRS NFR-3D-03): the polling pace when there is no hub at all. */
const LAYOUT_STATUS_REFRESH_MS = 2_000
/** Safety net while SignalR patches the plan (useLotRealtime): pushes carry the changes themselves. */
const LAYOUT_PUSHED_REFRESH_MS = 5 * 60_000
/**
 * While the hub is down, polling slows down the longer it stays down: a dead hub used to make every open map
 * read the whole plan every 2 seconds for as long as the screen stayed open. [down for less than, poll every].
 */
const LAYOUT_DOWN_BACKOFF: [number, number][] = [
  [30_000, 2_000],
  [2 * 60_000, 5_000],
  [10 * 60_000, 10_000],
]
const LAYOUT_DOWN_MAX_REFRESH_MS = 30_000

/** A lot created before ready-made models has no published layout: the API answers 404. */
const isMissingLayout = (error: unknown) => error instanceof ApiError && error.status === 404

/** How often to re-read the plan for the given state of the lot's push channel. */
function planRefreshMs(realtime: LotRealtimeState | undefined): number {
  if (!realtime?.available) return LAYOUT_STATUS_REFRESH_MS
  if (realtime.connected) return LAYOUT_PUSHED_REFRESH_MS
  const down = Date.now() - (realtime.downSince ?? Date.now())
  return LAYOUT_DOWN_BACKOFF.find(([within]) => down < within)?.[1] ?? LAYOUT_DOWN_MAX_REFRESH_MS
}

/**
 * 2D fallback of the lot, already shaped as the levels the 3D model and LotPlan2D draw. Stops polling while the
 * lot has no layout or the API fails; while the lot's push channel is live the pushes patch it and it is only
 * re-read rarely. Pass the state from useLotRealtime; without it the plan polls at the 2 s pace.
 */
export function useLotPlan2D(lotId: string | undefined, detail: Layout2DDetail = 'slots', realtime?: LotRealtimeState) {
  return useQuery({
    queryKey: queryKeys.layout.plan2D(lotId ?? '', detail),
    queryFn: () => layoutService.getPlan2D(lotId!, detail),
    enabled: Boolean(lotId),
    retry: (count, error) => !isMissingLayout(error) && count < 2,
    refetchInterval: (query) => (query.state.status === 'error' ? false : planRefreshMs(realtime)),
    select: (plan) => ({ plan, floors: planToGarageFloors(plan) }),
  })
}
