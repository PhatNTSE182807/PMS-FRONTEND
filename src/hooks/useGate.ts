import type { BanknoteCounts } from '@/types/cashDrawer.dto'
import { isCashAlert } from './useCashAlerts'
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
      // Several gate hooks of one page each subscribe, so every copy would raise the same popup: one id per
      // alert makes them share a single popup
      if (event.type === 'OpsAlert' && !isCashAlert(event.code))
        toast.warning(event.message, { id: `ops-alert-${event.lotId}-${event.code}-${event.sessionId ?? 'lot'}-${event.message}` })
      // A walk-in parked in a booked bay: the Exceptions screen lists the new case at once
      if (event.type === 'OpsAlert' && event.code === 'BOOKED_BAY_TAKEN')
        void queryClient.invalidateQueries({ queryKey: queryKeys.gate.all })
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

/**
 * The vehicle parked in one bay (Staff, Managers and Admins), for the 3D lot model's popup. The fee grows by
 * block, so it refreshes every 30 s; gate pushes refresh it at once.
 */
export function useBaySession(lotId: string | undefined, slotId: string | null) {
  useGateRealtime(lotId)
  return useQuery({
    queryKey: queryKeys.gate.baySession(lotId ?? '', slotId ?? ''),
    queryFn: () => gateService.getBaySession(lotId!, slotId!),
    enabled: Boolean(lotId && slotId),
    refetchInterval: 30_000,
    // An empty bay answers 404: show it, do not retry
    retry: false,
  })
}

/**
 * Booked bays a walk-in took in the lot (open ones first). Gate pushes (a walk-in parks or leaves) refresh it; the
 * server also settles cases that need no Staff when it is read.
 */
export function useBookedBayCases(lotId: string | undefined) {
  const live = useGateRealtime(lotId)
  return useQuery({
    queryKey: queryKeys.gate.bookedBayCases(lotId ?? ''),
    queryFn: () => gateService.getBookedBayCases(lotId!),
    enabled: Boolean(lotId),
    refetchInterval: live ? 30_000 : GATE_REFRESH_MS * 3,
  })
}

/** Moves a booking away from a taken bay, or cancels it with the refund and the compensation. */
export function useResolveBookedBay(lotId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: { caseId: number; kind: 'reassign'; slotId: number } | { caseId: number; kind: 'compensate'; note?: string }) =>
      action.kind === 'reassign'
        ? gateService.reassignBookedBay(action.caseId, action.slotId)
        : gateService.compensateBookedBay(action.caseId, action.note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gate.bookedBayCases(lotId ?? '') })
      void queryClient.invalidateQueries({ queryKey: queryKeys.layout.all })
    },
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

export function useGateHistory(lotId: string | undefined, page = 1, pageSize = 50) {
  const live = useGateRealtime(lotId)
  return useQuery({
    queryKey: queryKeys.gate.history(lotId ?? '', page),
    queryFn: () => gateService.getHistory(lotId!, page, undefined, pageSize),
    enabled: Boolean(lotId),
    refetchInterval: live ? 60_000 : GATE_REFRESH_MS,
  })
}

export function useLotPayments(lotId: string | undefined, method?: string, pageSize = 50) {
  const live = useGateRealtime(lotId)
  return useQuery({
    queryKey: queryKeys.gate.payments(lotId ?? '', method),
    queryFn: () => gateService.getPayments(lotId!, { method, page: 1, pageSize }),
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
export const usePayCash = () =>
  useGateMutation(
    ({ sessionId, amount, prepaid, received, change }: { sessionId: number; amount: number; prepaid?: boolean; received?: BanknoteCounts; change?: BanknoteCounts }) =>
      gateService.payCash(sessionId, amount, prepaid, received, change),
  )
export const usePayOnline = () => useGateMutation(({ sessionId, provider, prepaid }: { sessionId: number; provider: PaymentProvider; prepaid?: boolean }) => gateService.payOnline(sessionId, provider, prepaid))
export const useCheckout = () => useGateMutation(({ sessionId, request }: { sessionId: number; request: CheckoutRequest }) => gateService.checkout(sessionId, request))

/** Lost ticket desk: finds the open session of the plate, then reports its ticket as lost. */
/** A lost ticket was reported for a vehicle that came in with a booking. */
export class BookedVehicleError extends Error {
  constructor() {
    super('This vehicle came in with a booking, so it has no paper ticket to lose: find it by plate or booking code at the exit instead.')
    this.name = 'BookedVehicleError'
  }
}

export const useReportLostTicket = (lotId: string | undefined) =>
  useGateMutation(async ({ plate, request }: { plate: string; request: LostTicketRequest }) => {
    const session = await gateService.lookup(lotId!, { plate })
    // The API refuses it too; checking here keeps the message next to the plate field
    if (session.sessionType === 'Reservation') throw new BookedVehicleError()
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
