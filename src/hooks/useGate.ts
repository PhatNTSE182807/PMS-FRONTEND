import { isCashAlert } from './useCashAlerts'
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { gateService } from '@/api/gate.service'
import { parkingOpsRealtime } from '@/api/parkingOpsRealtime'
import { queryKeys } from '@/api/queryKeys'
import type { CheckInRequest, PaymentProvider } from '@/types/operations.dto'
import { invalidateFromPush } from '@/lib/realtimeInvalidate'

/** Polling fallback for the lane console when SignalR is not connected (demo, hub down). */
const GATE_REFRESH_MS = 5_000

/** While SignalR is live the session and payment pushes refresh the gate lists; this only covers a missed push. */
const GATE_PUSHED_SAFETY_NET_MS = 60_000

/** A burst of session pushes (a busy lane, the Admin simulation) refreshes the gate lists at most this often. */
const SESSION_PUSH_WINDOW_MS = 3_000

/** Gate data a session push never changes: the lanes, the plate reader's health, and the counters (pushed on their own). */
const PUSH_SKIPPED_GATE_KEYS = new Set(['gates', 'anpr-health', 'counters'])

/** Live gate data of one lot: SignalR pushes refresh it, polling covers demo mode. */
function useGateRealtime(lotId: string | undefined) {
  const queryClient = useQueryClient()
  const live = parkingOpsRealtime.isAvailable('gate')
  useEffect(() => {
    if (!live || !lotId) return
    return parkingOpsRealtime.subscribe((event) => {
      // A counter push only moves the zone counters
      if (event.type === 'ZoneCounterChanged') invalidateFromPush(queryClient, queryKeys.gate.counters(lotId), { windowMs: SESSION_PUSH_WINDOW_MS })
      // A session or payment push refreshes the session lists of the lot, never the lanes or the plate reader's health
      // (they used to be re-read on every push, many times a minute while the simulation runs)
      if (event.type === 'SessionChanged' || event.type === 'PaymentChanged')
        invalidateFromPush(queryClient, queryKeys.gate.all, {
          scope: `sessions-${lotId}`,
          predicate: (key) => !PUSH_SKIPPED_GATE_KEYS.has(String(key[1])),
          windowMs: SESSION_PUSH_WINDOW_MS,
        })
      // Several gate hooks of one page each subscribe, so every copy would raise the same popup: one id per
      // alert makes them share a single popup
      if (event.type === 'OpsAlert' && !isCashAlert(event.code))
        toast.warning(event.message, { id: `ops-alert-${event.lotId}-${event.code}-${event.sessionId ?? 'lot'}-${event.message}` })
      // A walk-in parked in a booked bay: the Exceptions screen lists the new case at once
      if (event.type === 'OpsAlert' && event.code === 'BOOKED_BAY_TAKEN')
        invalidateFromPush(queryClient, queryKeys.gate.bookedBayCases(lotId))
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
export function useBaySession(lotId: string | undefined, slotId: string | null, sessionId: number | null = null) {
  useGateRealtime(lotId)
  // A counted walk-in has no bay: it is looked up by its session instead
  const bySession = sessionId != null
  return useQuery({
    queryKey: bySession ? queryKeys.gate.parkedSession(lotId ?? '', sessionId) : queryKeys.gate.baySession(lotId ?? '', slotId ?? ''),
    queryFn: () => (bySession ? gateService.getParkedSession(lotId!, sessionId) : gateService.getBaySession(lotId!, slotId!)),
    enabled: Boolean(lotId && (bySession || slotId)),
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

/** Tows the vehicle out of a taken bay, moves the booking away from it, or cancels it with the refund and the compensation. */
export function useResolveBookedBay(lotId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (
      action:
        | { caseId: number; kind: 'tow'; slotId: number }
        | { caseId: number; kind: 'reassign'; slotId: number }
        | { caseId: number; kind: 'compensate'; note?: string },
    ) =>
      action.kind === 'tow'
        ? gateService.towFromBookedBay(action.caseId, action.slotId)
        : action.kind === 'reassign'
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

/**
 * The vehicles that left the lot last, newest exit first, whenever they came in: the exit lane cameras show each
 * one driving out (the entry-ordered history misses a vehicle that came in before the latest 50 entries).
 */
export function useGateExits(lotId: string | undefined) {
  const live = useGateRealtime(lotId)
  return useQuery({
    queryKey: queryKeys.gate.exits(lotId ?? ''),
    queryFn: () => gateService.getHistory(lotId!, 1, undefined, 20, 'exit'),
    enabled: Boolean(lotId),
    // Every exit is a session push, so the list is refreshed by the push; the timer is only a safety net
    refetchInterval: live ? GATE_PUSHED_SAFETY_NET_MS : GATE_REFRESH_MS,
  })
}

/**
 * Lost tickets of the lot waiting for the Staff's decision. Reporting or deciding one is a session push, so the
 * list follows the pushes (it used to be re-read every 10 s whether or not anything changed).
 */
export function useLostTicketSessions(lotId: string | undefined) {
  const live = useGateRealtime(lotId)
  return useQuery({
    queryKey: queryKeys.gate.lostTickets(lotId ?? ''),
    queryFn: () => gateService.getSessions(lotId!, 'LostTicketPending'),
    enabled: Boolean(lotId),
    refetchInterval: live ? GATE_PUSHED_SAFETY_NET_MS : GATE_REFRESH_MS * 2,
  })
}

export interface GatePaymentFilter {
  page: number
  plate: string
  method: string
}

/**
 * One page of the payments taken at the lot. A payment push refreshes it; without a hub it is re-read every 10 s.
 */
export function useGatePayments(lotId: string | undefined, filter: GatePaymentFilter) {
  const live = useGateRealtime(lotId)
  return useQuery({
    queryKey: queryKeys.gate.payments(lotId ?? '', filter),
    queryFn: () => gateService.getPayments(lotId!, { page: filter.page, plate: filter.plate, method: filter.method || undefined }),
    enabled: Boolean(lotId),
    refetchInterval: live ? false : GATE_REFRESH_MS * 2,
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
export const useQuote = () => useGateMutation(({ sessionId, plateNumber }: { sessionId: number; plateNumber?: string }) => gateService.quote(sessionId, plateNumber))
export const useCancelPaymentRequest = () => useGateMutation((sessionId: number) => gateService.cancelPayment(sessionId))
export const usePayCash = () =>
  useGateMutation(
    ({ sessionId, amount, prepaid }: { sessionId: number; amount: number; prepaid?: boolean }) =>
      gateService.payCash(sessionId, amount, prepaid),
  )
export const usePayOnline = () => useGateMutation(({ sessionId, provider, prepaid }: { sessionId: number; provider: PaymentProvider; prepaid?: boolean }) => gateService.payOnline(sessionId, provider, prepaid))

/** A lost ticket was reported for a vehicle that came in with a booking. */
export class BookedVehicleError extends Error {
  constructor() {
    super('This vehicle came in with a booking, so it has no paper ticket to lose: find it by plate or booking code at the exit instead.')
    this.name = 'BookedVehicleError'
  }
}

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
