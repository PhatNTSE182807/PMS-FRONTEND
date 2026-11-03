import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { parkingOpsRealtime } from '@/api/parkingOpsRealtime'
import { queryKeys } from '@/api/queryKeys'

/** Real-time cash drawer alerts of a lot: the day ended, a drawer was closed, a drawer is overdue. */
export const isCashAlert = (code: string) => code.startsWith('CASH_')

/**
 * Shows the lot's cash drawer alerts on every page of the Staff and Manager consoles (not only the gate
 * screens) and refreshes the drawers they are about.
 */
export function useCashAlerts(lotId: string | undefined) {
  const queryClient = useQueryClient()
  const live = parkingOpsRealtime.isAvailable('gate')

  useEffect(() => {
    if (!live || !lotId) return
    return parkingOpsRealtime.subscribe((event) => {
      if (event.type !== 'OpsAlert' || !isCashAlert(event.code)) return
      void queryClient.invalidateQueries({ queryKey: queryKeys.cashDrawer.all })
      // The id stops a second mounted listener from showing the same alert twice
      const show = event.code === 'CASH_OVERDUE' || event.code === 'CASH_DAY_END' ? toast.warning : toast.info
      show(event.message, { id: `${event.code}-${event.message}`, duration: 10_000 })
    }, lotId)
  }, [live, lotId, queryClient])
}
