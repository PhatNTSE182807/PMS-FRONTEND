import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { parkingService } from '@/api/parking.service'
import { queryKeys } from '@/api/queryKeys'

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

export function useParkingCapacity() {
  return useQuery({
    queryKey: queryKeys.parking.capacity(),
    queryFn: parkingService.getCapacityOverview,
    refetchInterval: CAPACITY_REFRESH_MS,
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
