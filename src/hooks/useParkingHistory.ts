import { useEffect } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { parkingOpsRealtime } from '@/api/parkingOpsRealtime'
import { parkingHistoryService } from '@/api/parkingHistory.service'
import { queryKeys } from '@/api/queryKeys'
import type { ParkingHistoryQuery } from '@/types/parkingHistory.dto'

/**
 * One page of the customer's parking history. A session that ends or a payment that settles
 * (SignalR) refreshes it; the previous page stays on screen while the next one loads.
 */
export function useParkingHistory(query: ParkingHistoryQuery) {
  const queryClient = useQueryClient()
  const live = parkingOpsRealtime.isAvailable('booking')

  useEffect(() => {
    if (!live) return
    return parkingOpsRealtime.subscribe((event) => {
      if (event.type === 'SessionChanged' || event.type === 'PaymentChanged')
        void queryClient.invalidateQueries({ queryKey: queryKeys.parkingHistory.all })
    })
  }, [live, queryClient])

  return useQuery({
    queryKey: queryKeys.parkingHistory.page(query),
    queryFn: () => parkingHistoryService.getHistory(query),
    placeholderData: keepPreviousData,
  })
}
