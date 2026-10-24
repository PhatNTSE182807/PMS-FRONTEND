import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '@/api/apiError'
import { pricingService } from '@/api/pricing.service'
import { queryKeys } from '@/api/queryKeys'
import type { PricingRuleInput, PricingRuleStatus, PricingSimulationRequest } from '@/types/pricing.dto'

/** The lot's pricing rules (not archived). */
export function usePricingRules(lotId: string) {
  return useQuery({
    queryKey: queryKeys.pricing.rules(lotId),
    queryFn: () => pricingService.list(lotId),
  })
}

/** Any change can change what the gates charge: refresh the rules and every simulation. */
function usePricingMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>, success: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(success)
      void queryClient.invalidateQueries({ queryKey: queryKeys.pricing.all })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export const useCreatePricingRule = (lotId: string) =>
  usePricingMutation((input: PricingRuleInput) => pricingService.create(lotId, input), 'Pricing rule created.')

export const useUpdatePricingRule = (lotId: string) =>
  usePricingMutation(
    ({ id, input }: { id: number; input: PricingRuleInput }) => pricingService.update(lotId, id, input),
    'Prices saved. The gates use them from the next checkout.',
  )

export const useSetPricingRuleStatus = (lotId: string) =>
  usePricingMutation(
    ({ id, status }: { id: number; status: PricingRuleStatus }) => pricingService.setStatus(lotId, id, status),
    'Rule status updated.',
  )

export const useArchivePricingRule = (lotId: string) =>
  usePricingMutation((id: number) => pricingService.remove(lotId, id), 'Pricing rule archived.')

/** Public prices of a lot for the customer map (what the gates charge now, per vehicle type). */
export function usePublicPrices(lotId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.pricing.publicPrices(lotId ?? ''),
    queryFn: () => pricingService.publicPrices(lotId!),
    enabled: Boolean(lotId),
    staleTime: 60_000,
  })
}

/** What the gate would charge for one stay; keeps the last result while a new one loads. */
export function usePricingSimulation(lotId: string, request: PricingSimulationRequest | null) {
  return useQuery({
    queryKey: queryKeys.pricing.simulation(lotId, request ?? {}),
    queryFn: () => pricingService.simulate(lotId, request!),
    enabled: request !== null,
    placeholderData: keepPreviousData,
    retry: false,
  })
}
