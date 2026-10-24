import { useQuery } from '@tanstack/react-query'
import { paymentService } from '@/api/payment.service'
import { queryKeys } from '@/api/queryKeys'

/**
 * Whether "Simulate successful payment" buttons may be shown: only when the server allows simulated
 * payments (development / testing) or in demo mode. Production servers answer false.
 */
export function usePaymentSimulation(): boolean {
  const { data } = useQuery({
    queryKey: queryKeys.payments.simulation(),
    queryFn: paymentService.simulation,
    staleTime: Infinity,
    retry: false,
  })
  return data?.enabled ?? false
}
