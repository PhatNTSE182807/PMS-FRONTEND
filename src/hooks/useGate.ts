import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { gateService } from '@/api/gate.service'
import { parkingOpsRealtime } from '@/api/parkingOpsRealtime'
import { queryKeys } from '@/api/queryKeys'
import type { CheckInRequest, CheckoutRequest, LostTicketRequest, PaymentProvider } from '@/types/operations.dto'

/** Polling fallback for the lane console when SignalR is not connected (demo, hub down). */
const GATE_REFRESH_MS = 5_000

/** Live gate data of one lot: SignalR pushes refresh it, polling covers demo mode. */
function useGateRealtime(lotId: string | undefined) {
  const queryClient = useQueryClient()
  const live = parkingOpsRealtime.isAvailable('gate')
  useEffect(() => {
    if (!live || !lotId) return
    return parkingOpsRealtime.subscribe((event) => {
      if (event.type === 'SessionChanged' || event.type === 'ZoneCounterChanged' || event.type === 'PaymentChanged')
        void queryClient.invalidateQueries({ queryKey: queryKeys.gate.all })
      if (event.type === 'OpsAlert') toast.warning(event.message)
    }, lotId)
  }, [live, lotId, queryClient])
  return live
}

export function useGates(lotId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.gate.gates(lotId ?? ''),
    queryFn: () => gateService.getGates(lotId!),
    enabled: Boolean(lotId),
    staleTime: Infinity,
  })
}

export function useOpenSessions(lotId: string | undefined) {
  const live = useGateRealtime(lotId)
  return useQuery({
    queryKey: queryKeys.gate.sessions(lotId ?? ''),
    queryFn: () => gateService.getSessions(lotId!),
    enabled: Boolean(lotId),
    refetchInterval: live ? 60_000 : GATE_REFRESH_MS,
  })
}

export function useZoneCounters(lotId: string | undefined) {
  const live = useGateRealtime(lotId)
  return useQuery({
    queryKey: queryKeys.gate.counters(lotId ?? ''),
    queryFn: () => gateService.getZoneCounters(lotId!),
    enabled: Boolean(lotId),
    refetchInterval: live ? 60_000 : GATE_REFRESH_MS,
  })
}

/** Every lane action refreshes the lot's sessions and counters (and the 3D model). */
function useGateMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.gate.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.layout.all }),
      ]),
  })
}

export const useCheckIn = (lotId: string | undefined) => useGateMutation((request: CheckInRequest) => gateService.checkIn(lotId!, request))
export const useConfirmEntry = () => useGateMutation((sessionId: number) => gateService.confirmEntry(sessionId))
export const useCancelEntry = () => useGateMutation((sessionId: number) => gateService.cancelEntry(sessionId))
export const useQuote = () => useGateMutation(({ sessionId, plateNumber }: { sessionId: number; plateNumber?: string }) => gateService.quote(sessionId, plateNumber))
export const useCancelPaymentRequest = () => useGateMutation((sessionId: number) => gateService.cancelPayment(sessionId))
export const usePayCash = () => useGateMutation(({ sessionId, amount, prepaid }: { sessionId: number; amount: number; prepaid?: boolean }) => gateService.payCash(sessionId, amount, prepaid))
export const usePayOnline = () => useGateMutation(({ sessionId, provider, prepaid }: { sessionId: number; provider: PaymentProvider; prepaid?: boolean }) => gateService.payOnline(sessionId, provider, prepaid))
export const useCheckout = () => useGateMutation(({ sessionId, request }: { sessionId: number; request: CheckoutRequest }) => gateService.checkout(sessionId, request))

/** Lost ticket desk: finds the open session of the plate, then reports its ticket as lost. */
export const useReportLostTicket = (lotId: string | undefined) =>
  useGateMutation(async ({ plate, request }: { plate: string; request: LostTicketRequest }) => {
    const session = await gateService.lookup(lotId!, { plate })
    return gateService.reportLostTicket(session.id, request)
  })

/** Entry lane: the customer has no code, so find the booking of the typed plate (gives back its RSV code). */
export function useFindReservationByPlate(lotId: string | undefined) {
  return useMutation({
    mutationFn: (plate: string) => gateService.lookupReservation(lotId!, { plate }),
  })
}

/**
 * Entry lane: looks the reservation up as soon as a QR is scanned or a code typed. Anything starting
 * with "RSV" is a code; anything else is the signed QR payload.
 */
export function useReservationLookup(lotId: string | undefined, entry: string) {
  const value = entry.trim()
  const isCode = /^RSV/i.test(value)
  return useQuery({
    queryKey: queryKeys.gate.reservation(lotId ?? '', value),
    queryFn: () => gateService.lookupReservation(lotId!, isCode ? { code: value } : { qr: value }),
    enabled: Boolean(lotId) && value.length >= 6,
    retry: false,
    staleTime: 10_000,
  })
}
