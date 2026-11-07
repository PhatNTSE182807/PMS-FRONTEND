import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { gateRequestService } from '@/api/gateRequest.service'
import { parkingOpsRealtime } from '@/api/parkingOpsRealtime'
import { queryKeys } from '@/api/queryKeys'
import type { ApproveGateRequestRequest, GateRequestKind } from '@/types/gateRequest.dto'
import { invalidateFromPush } from '@/lib/realtimeInvalidate'

/** Polling fallback when SignalR is not connected (demo mode, hub down). */
const CUSTOMER_REFRESH_MS = 4_000
const STAFF_REFRESH_MS = 4_000

/* ------------------------------------------------------------------ customer */

/**
 * The customer's check-in / check-out requests (newest first). A "GateRequestChanged" push refreshes
 * them and the parked-vehicle and booking cards; without a hub they refresh every few seconds.
 */
export function useMyGateRequests() {
  const queryClient = useQueryClient()
  const live = parkingOpsRealtime.isAvailable('booking')

  useEffect(() => {
    if (!live) return
    return parkingOpsRealtime.subscribe((event) => {
      if (event.type !== 'GateRequestChanged') return
      invalidateFromPush(queryClient, queryKeys.gateRequests.all)
      invalidateFromPush(queryClient, queryKeys.parkingSessions.all)
      invalidateFromPush(queryClient, queryKeys.reservations.all)
    })
  }, [live, queryClient])

  return useQuery({
    queryKey: queryKeys.gateRequests.mine(),
    queryFn: gateRequestService.getMine,
    refetchInterval: live ? false : CUSTOMER_REFRESH_MS,
  })
}

/** A request changes the cards: refresh the requests, the parked vehicles and the bookings. */
function useCustomerGateMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gateRequests.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.parkingSessions.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all })
    },
  })
}

export const useRequestCheckIn = () => useCustomerGateMutation(gateRequestService.requestCheckIn)

export const useRequestCheckOut = () => useCustomerGateMutation(gateRequestService.requestCheckOut)

export const useCancelGateRequest = () => useCustomerGateMutation(gateRequestService.cancel)

/* ------------------------------------------------------------------ Staff */

/** Waiting requests of one lane (CheckIn or CheckOut) of the lot, oldest first; live through SignalR. */
export function useGateRequestQueue(lotId: string | undefined, kind: GateRequestKind) {
  const queryClient = useQueryClient()
  const live = parkingOpsRealtime.isAvailable('gate')

  useEffect(() => {
    if (!live || !lotId) return
    return parkingOpsRealtime.subscribe((event) => {
      if (event.type === 'GateRequestChanged' || event.type === 'SessionChanged')
        invalidateFromPush(queryClient, queryKeys.gateRequests.all)
    }, lotId)
  }, [live, lotId, queryClient])

  return useQuery({
    queryKey: queryKeys.gateRequests.queue(lotId ?? '', kind),
    queryFn: () => gateRequestService.getQueue(lotId!, kind),
    enabled: Boolean(lotId),
    refetchInterval: live ? 30_000 : STAFF_REFRESH_MS,
  })
}

/** Staff decisions refresh both queues, the lot's sessions and counters (and the 3D model). */
function useStaffGateMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gateRequests.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.gate.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.layout.all })
    },
  })
}

export const useApproveGateRequest = () =>
  useStaffGateMutation(({ requestId, request }: { requestId: number; request?: ApproveGateRequestRequest }) =>
    gateRequestService.approve(requestId, request),
  )

export const useRefuseGateRequest = () =>
  useStaffGateMutation(({ requestId, reason }: { requestId: number; reason: string }) => gateRequestService.refuse(requestId, reason))
