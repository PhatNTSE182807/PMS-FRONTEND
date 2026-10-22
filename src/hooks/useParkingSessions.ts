import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { getErrorMessage } from '@/api/apiError'
import { parkingOpsRealtime } from '@/api/parkingOpsRealtime'
import { parkingSessionService } from '@/api/parkingSession.service'
import { queryKeys } from '@/api/queryKeys'
import type { PaymentProvider } from '@/types/operations.dto'

/** The fee grows by block, so a minute is fine-grained enough; pushes refresh it at once. */
const CURRENT_REFRESH_MS = 60_000

/**
 * The customer's parked vehicles with the running fee and the exit pass. A session or payment push
 * (check-in, prepayment, check-out) refreshes it; otherwise it refreshes every minute.
 */
export function useCurrentSessions() {
  const queryClient = useQueryClient()
  const live = parkingOpsRealtime.isAvailable('booking')

  useEffect(() => {
    if (!live) return
    return parkingOpsRealtime.subscribe((event) => {
      if (event.type === 'SessionChanged' || event.type === 'PaymentChanged')
        void queryClient.invalidateQueries({ queryKey: queryKeys.parkingSessions.all })
    })
  }, [live, queryClient])

  return useQuery({
    queryKey: queryKeys.parkingSessions.current(),
    queryFn: parkingSessionService.getCurrent,
    refetchInterval: CURRENT_REFRESH_MS,
  })
}

/** Starts a VNPay / MoMo prepayment of the fee so far and sends the browser to the gateway. */
export function usePrepaySession() {
  const navigate = useNavigate()
  return useMutation({
    mutationFn: ({ sessionId, provider }: { sessionId: number; provider: PaymentProvider }) =>
      parkingSessionService.prepay(sessionId, provider),
    onSuccess: (payment) => {
      if (!payment.payUrl) return
      // The demo gateway is this app's own return page: stay in the SPA so the in-memory demo data survives
      const url = new URL(payment.payUrl, window.location.href)
      if (url.origin === window.location.origin) navigate(`${url.pathname}${url.search}`)
      else window.location.assign(payment.payUrl)
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not start the payment.')),
  })
}
