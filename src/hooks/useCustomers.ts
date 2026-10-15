import { keepPreviousData, useQuery } from '@tanstack/react-query'
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
