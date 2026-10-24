import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { getErrorMessage } from '@/api/apiError'
import { parkingOpsRealtime } from '@/api/parkingOpsRealtime'
import { paymentService } from '@/api/payment.service'
import { queryKeys } from '@/api/queryKeys'
import { reservationService } from '@/api/reservation.service'
import type { CreateReservationRequest, PaymentProvider, ReservationDTO, UpdateReservationRequest } from '@/types/operations.dto'

/** Polling fallback: deposit deadlines are minutes long, so 15 s is enough without SignalR. */
const RESERVATIONS_REFRESH_MS = 15_000

/** The signed-in customer's reservations; refreshed by ReservationChanged / PaymentChanged pushes. */
export function useMyReservations() {
  const queryClient = useQueryClient()
  const live = parkingOpsRealtime.isAvailable('booking')

  useEffect(() => {
    if (!live) return
    return parkingOpsRealtime.subscribe((event) => {
      if (event.type === 'ReservationChanged' || event.type === 'PaymentChanged')
        void queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all })
      if (event.type === 'ReservationReminder')
        toast.info(event.kind === 'Arrival' ? 'Your parking arrival time is coming up.' : 'Your bay hold ends soon.', {
          description: new Date(event.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        })
    })
  }, [live, queryClient])

  return useQuery({
    queryKey: queryKeys.reservations.mine(),
    queryFn: reservationService.getMine,
    refetchInterval: live ? false : RESERVATIONS_REFRESH_MS,
  })
}

/** The next booking that has not started (dashboard card); refreshed with the other reservation queries. */
export function useUpcomingReservation() {
  const live = parkingOpsRealtime.isAvailable('booking')
  return useQuery({
    queryKey: queryKeys.reservations.upcoming(),
    queryFn: reservationService.getUpcoming,
    refetchInterval: live ? false : RESERVATIONS_REFRESH_MS,
  })
}

export function useReservationQr(reservation: ReservationDTO | undefined) {
  return useQuery({
    queryKey: queryKeys.reservations.qr(reservation?.id ?? 0),
    queryFn: () => reservationService.getQr(reservation!.id),
    enabled: reservation?.status === 'Confirmed',
    staleTime: 5 * 60_000,
  })
}

/** Lots a customer can book on the 3D map. */
export function useBookableLots() {
  return useQuery({
    queryKey: queryKeys.reservations.lots(),
    queryFn: reservationService.getBookableLots,
    staleTime: 5 * 60_000,
  })
}

function useInvalidateReservations() {
  const queryClient = useQueryClient()
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all }),
    // The held slot changes colour on the 3D model
    queryClient.invalidateQueries({ queryKey: queryKeys.layout.all }),
  ])
}

export function useCreateReservation() {
  const invalidate = useInvalidateReservations()
  return useMutation({
    mutationFn: (request: CreateReservationRequest) => reservationService.create(request),
    onSettled: invalidate,
  })
}

export function useUpdateReservation() {
  const invalidate = useInvalidateReservations()
  return useMutation({
    mutationFn: ({ id, request }: { id: number; request: UpdateReservationRequest }) => reservationService.update(id, request),
    onSuccess: () => toast.success('Reservation updated.'),
    onError: (error) => toast.error(getErrorMessage(error)),
    onSettled: invalidate,
  })
}

export function useCancelReservation() {
  const invalidate = useInvalidateReservations()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => reservationService.cancel(id, reason),
    onSuccess: (r) =>
      toast.success(`Reservation ${r.code} cancelled`, {
        description: r.refundAmount > 0 ? `${r.refundAmount.toLocaleString('en-US')} VND is refunded to your payment source.` : 'The deposit is not refunded.',
      }),
    onError: (error) => toast.error(getErrorMessage(error)),
    onSettled: invalidate,
  })
}

/** Starts the deposit payment and sends the browser to the gateway (or the demo return page). */
/**
 * Development / testing only: opens a VNPay deposit payment and completes it as if the gateway confirmed
 * it, so the booking is confirmed without typing sandbox card details. Returns the updated reservation.
 */
export function useSimulateDeposit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const payment = await reservationService.payDeposit(id, 'VNPay')
      await paymentService.simulateSuccess(payment.id)
      return reservationService.get(id)
    },
    onSuccess: (reservation) => {
      toast.success(`Deposit paid (simulated): bay ${reservation.slotCode} is confirmed.`)
      void queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function usePayDeposit() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, provider }: { id: number; provider: PaymentProvider }) => reservationService.payDeposit(id, provider),
    onSuccess: (payment, { provider }) => {
      // VNPay / MoMo without keys on a test server: the payment exists but has no pay page
      if (!payment.payUrl && provider !== 'Wallet') {
        toast.error(`${provider} is not set up on this server. Use "Simulate successful payment" to test the booking.`)
        return
      }
      if (!payment.payUrl) {
        toast.success('Deposit successfully paid using XXIV Wallet!')
        window.dispatchEvent(new Event('xxiv-wallet-updated'))
        void queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all })
        return
      }
      // The demo gateway is this app's own return page: stay in the SPA so the in-memory demo data survives
      const url = new URL(payment.payUrl, window.location.href)
      if (url.origin === window.location.origin) navigate(`${url.pathname}${url.search}`)
      else window.location.assign(payment.payUrl)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}
