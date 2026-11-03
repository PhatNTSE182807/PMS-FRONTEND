import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '@/api/apiError'
import { cashDrawerService } from '@/api/cashDrawer.service'
import { queryKeys } from '@/api/queryKeys'
import type { BanknoteCounts } from '@/types/cashDrawer.dto'

/** The signed-in Staff's drawer of today at the lot; refreshed every 10 s and after every cash payment. */
export function useCashDrawer(lotId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cashDrawer.current(lotId ?? ''),
    queryFn: () => cashDrawerService.current(lotId!),
    enabled: Boolean(lotId),
    refetchInterval: 10_000,
  })
}

export function useOpenCashDrawer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ lotId, float }: { lotId: string; float: BanknoteCounts }) => cashDrawerService.open(lotId, float),
    onSuccess: () => {
      toast.success('Cash drawer opened.')
      void queryClient.invalidateQueries({ queryKey: queryKeys.cashDrawer.all })
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not open the cash drawer.')),
  })
}

/** Errors are left to the page: a missing reason is shown next to the count, not as a toast. */
export function useCloseCashDrawer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ lotId, counted, reason }: { lotId: string; counted: BanknoteCounts; reason?: string }) =>
      cashDrawerService.close(lotId, counted, reason),
    onSuccess: () => {
      toast.success('Cash drawer closed and sent to your Manager.')
      void queryClient.invalidateQueries({ queryKey: queryKeys.cashDrawer.all })
    },
  })
}

/** Manager: the lot's closed drawers waiting for confirmation. */
export function useCashCloses(lotId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cashDrawer.closes(lotId ?? ''),
    queryFn: () => cashDrawerService.forLot(lotId!),
    enabled: Boolean(lotId),
    refetchInterval: 15_000,
  })
}

export function useConfirmCashClose() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) => cashDrawerService.confirm(id, note),
    onSuccess: () => {
      toast.success('Cash close confirmed.')
      void queryClient.invalidateQueries({ queryKey: queryKeys.cashDrawer.all })
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not confirm the cash close.')),
  })
}
