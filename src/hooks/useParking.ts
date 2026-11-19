import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { parkingService } from '@/api/parking.service'
import { parkingOpsRealtime } from '@/api/parkingOpsRealtime'
import { queryKeys } from '@/api/queryKeys'
import { invalidateFromPush } from '@/lib/realtimeInvalidate'
import { useAuth } from './useAuth'

/** Near real-time polling interval for occupancy (to be replaced by a SignalR push). */
export const CAPACITY_REFRESH_MS = 15_000
export const SIMULATION_TICK_MS = 3_000

export function useParkingLots() {
  return useQuery({
    queryKey: queryKeys.parking.lots(),
    queryFn: parkingService.getParkingLots,
    staleTime: 10 * 60 * 1000,
  })
}

/** The lot(s) the signed-in Staff works at (Managers use useManagerLot). */
export function useMyStaffLots() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.parking.staffLots(user?.userId),
    queryFn: parkingService.getMyStaffLots,
    enabled: !!user,
  })
}

/** Occupancy polling without SignalR (demo mode, hub down). */
const OCCUPANCY_REFRESH_MS = 10_000
/** Safety net while the zone counter pushes refresh the occupancy. */
const OCCUPANCY_PUSHED_MS = 60_000
/** A busy gate moves the counters many times a minute: re-read the occupancy at most this often. */
const OCCUPANCY_PUSH_WINDOW_MS = 3_000

/** Live occupancy of one lot for its Manager: every zone counter push of the lot refreshes it. */
export function useLotOccupancy(lotId: string | undefined) {
  const queryClient = useQueryClient()
  const live = parkingOpsRealtime.isAvailable('gate')

  useEffect(() => {
    if (!live || !lotId) return
    return parkingOpsRealtime.subscribe((event) => {
      if (event.type === 'ZoneCounterChanged' || event.type === 'ConnectionRestored')
        invalidateFromPush(queryClient, queryKeys.parking.occupancy(lotId), { windowMs: OCCUPANCY_PUSH_WINDOW_MS })
    }, lotId)
  }, [live, lotId, queryClient])

  return useQuery({
    queryKey: queryKeys.parking.occupancy(lotId ?? ''),
    queryFn: () => parkingService.getLotOccupancy(lotId!),
    enabled: Boolean(lotId),
    refetchInterval: live ? OCCUPANCY_PUSHED_MS : OCCUPANCY_REFRESH_MS,
    refetchIntervalInBackground: false,
  })
}

/**
 * Capacity overview of every lot (Admin and Manager). `enabled: false` skips it on screens that only need it for
 * demo data; `poll: false` reads it once, for screens that get the live numbers elsewhere.
 */
export function useParkingCapacity({ enabled = true, poll = true }: { enabled?: boolean; poll?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.parking.capacity(),
    queryFn: parkingService.getCapacityOverview,
    enabled,
    refetchInterval: poll ? CAPACITY_REFRESH_MS : false,
    refetchIntervalInBackground: false,
  })
}

/**
 * Demo-only: while enabled, vehicles arrive and leave every few seconds. Snapshots are
 * written straight into the query cache — the same path a SignalR push will use.
 */
export function useCapacitySimulation(enabled: boolean) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!enabled || !parkingService.canSimulate()) return
    const timer = window.setInterval(() => {
      queryClient.setQueryData(queryKeys.parking.capacity(), parkingService.simulateCapacityTick())
    }, SIMULATION_TICK_MS)
    return () => window.clearInterval(timer)
  }, [enabled, queryClient])
}
