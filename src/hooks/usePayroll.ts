import { useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { parkingOpsRealtime } from '@/api/parkingOpsRealtime'
import { useAuth } from './useAuth'
import { getErrorMessage } from '@/api/apiError'
export const payrollKeys = ['payroll'] as const
export function usePayrollRealtime(lotId?: string) {
  const client = useQueryClient(); const { user } = useAuth()
  useEffect(() => {
    if (!user?.userId || !parkingOpsRealtime.isAvailable('gate')) return
    return parkingOpsRealtime.subscribe(event => {
      if (event.type === 'ConnectionRestored' || (event.type === 'NotificationCreated' && event.notification.type === 'PayrollChanged')) void client.invalidateQueries({ queryKey: payrollKeys })
    }, lotId)
  }, [client, lotId, user?.userId])
}
export function usePayrollMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (operation: () => Promise<unknown>) => operation(),
    onSuccess: () => { toast.success('Payroll saved.'); void client.invalidateQueries({ queryKey: payrollKeys }) },
    onError: error => { toast.error(getErrorMessage(error)); void client.invalidateQueries({ queryKey: payrollKeys }) } })
}
