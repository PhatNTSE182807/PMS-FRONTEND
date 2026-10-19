import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/queryKeys'
import { lotRealtime } from '@/api/realtime'

/**
 * Subscribes to a lot's SignalR channel: slot, lot and layout changes refresh the cached layout
 * and lot data right away (SRS NFR-3D-03, ≤ 2 s). Returns whether the push channel is live, so
 * callers can poll less while it is.
 */
export function useLotRealtime(lotId: string | undefined) {
  const queryClient = useQueryClient()
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!lotId || !lotRealtime.isAvailable()) return
    const stop = lotRealtime.watch(lotId, {
      onConnectionChange: setConnected,
      onEvent: (event) => {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.layout.all,
          predicate: (q) => q.queryKey.includes(lotId),
        })
        if (event.type === 'LotStatusChanged') void queryClient.invalidateQueries({ queryKey: ['lot-management'] })
      },
    })
    return () => {
      stop()
      setConnected(false)
    }
  }, [lotId, queryClient])

  return { connected }
}
