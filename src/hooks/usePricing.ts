import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { pricingService } from '@/api/pricing.service'
import { queryKeys } from '@/api/queryKeys'
import { ADMIN_TOAST, toastAdminError } from '@/lib/adminToasts'
import type { PricingRuleInput, PricingRuleStatus, SavePricingRuleDraftInput } from '@/types/pricing.dto'

/** The lot's pricing rules (not archived). */
export function usePricingRules(lotId: string) {
  return useQuery({
    queryKey: queryKeys.pricing.rules(lotId),
    queryFn: () => pricingService.list(lotId),
  })
}

/**
 * Any change to the pricing rules is a pricing policy update and can change what the gates charge:
 * refresh the rules and every simulation.
 */
function usePricingMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(ADMIN_TOAST.pricingUpdated)
      void queryClient.invalidateQueries({ queryKey: queryKeys.pricing.all })
    },
    onError: (error) => toastAdminError(error, { spec: ADMIN_TOAST.pricingFailed }),
  })
}

export const useCreatePricingRule = (lotId: string) => usePricingMutation((input: PricingRuleInput) => pricingService.create(lotId, input))

export const useUpdatePricingRule = (lotId: string) =>
  usePricingMutation(({ id, input }: { id: number; input: PricingRuleInput }) => pricingService.update(lotId, id, input))

export const useSetPricingRuleStatus = (lotId: string) =>
  usePricingMutation(({ id, status }: { id: number; status: PricingRuleStatus }) => pricingService.setStatus(lotId, id, status))

export const useArchivePricingRule = (lotId: string) => usePricingMutation((id: number) => pricingService.remove(lotId, id))

/** The lot's open price drafts. */
export function usePricingDrafts(lotId: string) {
  return useQuery({
    queryKey: queryKeys.pricing.drafts(lotId),
    queryFn: () => pricingService.drafts(lotId),
  })
}

/** Saving or discarding a draft changes no price: only the drafts list is refreshed. */
function useDraftMutation<TArgs>(lotId: string, fn: (args: TArgs) => Promise<unknown>, message: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(message)
      void queryClient.invalidateQueries({ queryKey: queryKeys.pricing.drafts(lotId) })
    },
    onError: (error) => toastAdminError(error, { fallback: 'The draft could not be saved.' }),
  })
}

/** Creates a draft, or replaces an existing one when draftId is set. */
export const useSavePricingDraft = (lotId: string) =>
  useDraftMutation(
    lotId,
    ({ ruleId, draftId, input }: { ruleId: number; draftId?: number; input: SavePricingRuleDraftInput }) =>
      draftId == null ? pricingService.createDraft(lotId, ruleId, input) : pricingService.updateDraft(lotId, ruleId, draftId, input),
    'Draft saved. The gates keep the current prices until you apply it.',
  )

export const useDiscardPricingDraft = (lotId: string) =>
  useDraftMutation(
    lotId,
    ({ ruleId, draftId }: { ruleId: number; draftId: number }) => pricingService.discardDraft(lotId, ruleId, draftId),
    'Draft discarded.',
  )

/**
 * Applies a draft (saving its latest values first when given): a pricing policy update like a direct save,
 * so it refreshes the rules and the drafts.
 */
export const useApplyPricingDraft = (lotId: string) =>
  usePricingMutation(async ({ ruleId, draftId, input }: { ruleId: number; draftId: number; input?: SavePricingRuleDraftInput }) => {
    if (input) await pricingService.updateDraft(lotId, ruleId, draftId, input)
    return pricingService.applyDraft(lotId, ruleId, draftId)
  })

/** Public prices of a lot for the customer map (what the gates charge now, per vehicle type). */
export function usePublicPrices(lotId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.pricing.publicPrices(lotId ?? ''),
    queryFn: () => pricingService.publicPrices(lotId!),
    enabled: Boolean(lotId),
    staleTime: 60_000,
  })
}
