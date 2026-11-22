import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '@/api/apiError'
import { cashDrawerService } from '@/api/cashDrawer.service'
import { parkingOpsRealtime } from '@/api/parkingOpsRealtime'
import { queryKeys } from '@/api/queryKeys'
import { invalidateFromPush } from '@/lib/realtimeInvalidate'
import { t } from '@/i18n'

/**
 * The signed-in Staff's open drawer at the lot (else their latest of today). A payment push refreshes it (cash moves the
 * drawer); polling is the fallback: every minute while pushes arrive, every 10 s in demo mode.
 */
export function useCashDrawer(lotId: string | undefined) {
  const queryClient = useQueryClient()
  const live = parkingOpsRealtime.isAvailable('gate')

  useEffect(() => {
    if (!live || !lotId) return
    return parkingOpsRealtime.subscribe((event) => {
      if (event.type === 'PaymentChanged') invalidateFromPush(queryClient, queryKeys.cashDrawer.current(lotId), { windowMs: 3_000 })
    }, lotId)
  }, [live, lotId, queryClient])

  return useQuery({
    queryKey: queryKeys.cashDrawer.current(lotId ?? ''),
    queryFn: () => cashDrawerService.current(lotId!),
    enabled: Boolean(lotId),
    refetchInterval: live ? 60_000 : 10_000,
  })
}

export function useOpenCashDrawer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ lotId, float }: { lotId: string; float: number }) => cashDrawerService.open(lotId, float),
    onSuccess: () => {
      toast.success(t('Cash drawer opened.'))
      void queryClient.invalidateQueries({ queryKey: queryKeys.cashDrawer.all })
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not open the cash drawer.')),
  })
}

/** Hands the drawer in with the cash total the system kept. */
export function useCloseCashDrawer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ lotId }: { lotId: string }) => cashDrawerService.close(lotId),
    onSuccess: () => {
      toast.success(t('Cash drawer handed in to your Manager. A new drawer is open with the standard float.'))
      void queryClient.invalidateQueries({ queryKey: queryKeys.cashDrawer.all })
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not hand in the cash drawer.')),
  })
}

/**
 * The Manager's queues follow the lot's cash alerts (a drawer closed, cash requested, cancelled or decided:
 * useCashAlerts in the console layout refreshes them); the timer is a safety net, 15 s in demo mode.
 */
const CASH_QUEUE_PUSHED_MS = 2 * 60_000

/** Manager: the lot's closed drawers waiting for confirmation. */
export function useCashCloses(lotId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cashDrawer.closes(lotId ?? ''),
    queryFn: () => cashDrawerService.forLot(lotId!),
    enabled: Boolean(lotId),
    refetchInterval: parkingOpsRealtime.isAvailable('gate') ? CASH_QUEUE_PUSHED_MS : 15_000,
  })
}

export function useConfirmCashClose() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) => cashDrawerService.confirm(id, note),
    onSuccess: () => {
      toast.success(t('Cash close confirmed.'))
      void queryClient.invalidateQueries({ queryKey: queryKeys.cashDrawer.all })
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not confirm the cash close.')),
  })
}

/** Staff: asks the Manager for an amount of cash; errors are left to the dialog so the Staff can fix it. */
export function useRequestCashTopUp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ lotId, amount, reason }: { lotId: string; amount: number; reason?: string }) =>
      cashDrawerService.requestTopUp(lotId, amount, reason),
    onSuccess: () => {
      toast.success(t('Cash request sent to your Manager.'))
      void queryClient.invalidateQueries({ queryKey: queryKeys.cashDrawer.all })
    },
  })
}

export function useCancelCashTopUp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ lotId, id }: { lotId: string; id: number }) => cashDrawerService.cancelTopUp(lotId, id),
    onSuccess: () => {
      toast.info(t('Cash request cancelled.'))
      void queryClient.invalidateQueries({ queryKey: queryKeys.cashDrawer.all })
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not cancel the cash request.')),
  })
}

/** Manager: the lot's requests for more cash waiting for a decision. */
export function useCashTopUps(lotId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cashDrawer.topUps(lotId ?? ''),
    queryFn: () => cashDrawerService.topUpsForLot(lotId!),
    enabled: Boolean(lotId),
    refetchInterval: parkingOpsRealtime.isAvailable('gate') ? CASH_QUEUE_PUSHED_MS : 15_000,
  })
}

export function useDecideCashTopUp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, approve, note }: { id: number; approve: boolean; note?: string }) =>
      approve ? cashDrawerService.approveTopUp(id, note) : cashDrawerService.rejectTopUp(id, note ?? ''),
    onSuccess: (request) => {
      toast.success(request.status === 'Approved' ? 'Cash request approved: hand the cash to the Staff.' : 'Cash request rejected.')
      void queryClient.invalidateQueries({ queryKey: queryKeys.cashDrawer.all })
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not decide on the cash request.')),
  })
}
