import { useEffect, useState } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/queryKeys'
import { lotRealtime, type LotEvent } from '@/api/realtime'
import { applyLiveChanges, applySlotStatus, applyZoneCounter } from '@/lib/lotPlanPatch'
import { invalidateFromPush } from '@/lib/realtimeInvalidate'
import type { LotPlan2DDTO, SlotStatus } from '@/types/layout.dto'

export interface LotRealtimeState {
  /** The push channel is live: the plan only needs a rare safety-net reload. */
  connected: boolean
  /** The hub exists for this session (not mock or demo data). */
  available: boolean
  /** Since when the channel has been down (ms), to space out the fallback polling; null while connected. */
  downSince: number | null
}

/** Reloads the lot's cached plans, coalesced with other pushes. */
function reloadPlans(queryClient: QueryClient, lotId: string) {
  invalidateFromPush(queryClient, queryKeys.layout.all, { scope: lotId, predicate: (key) => key.includes(lotId) })
}

/**
 * Patches the cached bay plan with the push itself, so a vehicle entering or leaving costs no request. Returns false
 * when the push cannot be applied (no plan cached yet, unknown bay or zone): the caller reloads instead.
 */
function patchPlan(queryClient: QueryClient, lotId: string, event: LotEvent): boolean {
  const key = queryKeys.layout.plan2D(lotId, 'slots')
  const plan = queryClient.getQueryData<LotPlan2DDTO>(key)
  if (!plan) return false
  let next: LotPlan2DDTO | null
  switch (event.type) {
    case 'LotLiveChanged':
      next = applyLiveChanges(plan, event)
      break
    case 'SlotStatusChanged':
      next = applySlotStatus(plan, event.slotId, event.status as SlotStatus)
      break
    case 'ZoneCounterChanged':
      next = applyZoneCounter(plan, event.zoneId, event.totalCapacity, event.availableSpaces)
      break
    default:
      return false
  }
  if (!next) return false
  if (next !== plan) queryClient.setQueryData(key, next)
  return true
}

/**
 * Subscribes to a lot's SignalR channel and keeps the cached 2D plan live within the 2 s the map allows
 * (SRS NFR-3D-03). Bay and zone pushes patch the cache directly; only a layout or lot status change, a push the
 * cache cannot take, or a reconnect (pushes may have been missed) reloads the plan.
 */
export function useLotRealtime(lotId: string | undefined): LotRealtimeState {
  const queryClient = useQueryClient()
  const available = lotRealtime.isAvailable()
  const [state, setState] = useState<{ connected: boolean; downSince: number }>(() => ({ connected: false, downSince: Date.now() }))

  useEffect(() => {
    if (!lotId || !available) return
    let connected = false
    const stop = lotRealtime.watch(lotId, {
      onConnectionChange: (now) => {
        // Joined (again): anything pushed while away is missed, so read the plan once
        if (now && !connected) reloadPlans(queryClient, lotId)
        if (now !== connected) setState({ connected: now, downSince: Date.now() })
        connected = now
      },
      onEvent: (event) => {
        if (!patchPlan(queryClient, lotId, event)) reloadPlans(queryClient, lotId)
        if (event.type === 'LotStatusChanged') invalidateFromPush(queryClient, ['lot-management'])
      },
    })
    return () => {
      stop()
      setState({ connected: false, downSince: Date.now() })
    }
  }, [lotId, available, queryClient])

  return { connected: state.connected, available, downSince: state.connected ? null : state.downSince }
}
