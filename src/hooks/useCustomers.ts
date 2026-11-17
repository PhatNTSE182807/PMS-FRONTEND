import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { identityService } from '@/api/identity.service'
import { queryKeys } from '@/api/queryKeys'
import type { CustomerListQuery } from '@/types/identity.dto'

export function useCustomerList(query: CustomerListQuery) {
  return useQuery({
    queryKey: queryKeys.customers.list(query),
    queryFn: () => identityService.getCustomers(query),
    // Keep the current page on screen while the next one loads.
    placeholderData: keepPreviousData,
  })
}

/** Locks or unlocks a customer account (locking completes a pending deletion request). */
export function useSetCustomerActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => identityService.setCustomerActive(id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.customers.all }),
  })
}
