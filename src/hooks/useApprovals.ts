import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { approvalService } from '@/api/approval.service'
import { queryKeys } from '@/api/queryKeys'
import type { ApprovalDecision } from '@/types/approval.dto'

/** The queue is polled: a Staff member can raise a request at any moment. */
const APPROVALS_REFRESH_MS = 10_000

/** Lost-ticket reports of a lot waiting for the Manager, oldest first. */
export function usePendingLostTickets(lotId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.approvals.lostTickets(lotId ?? ''),
    queryFn: async () => (await approvalService.getPendingLostTickets(lotId!)).sort((a, b) => Date.parse(a.entryTime) - Date.parse(b.entryTime)),
    enabled: Boolean(lotId),
    refetchInterval: APPROVALS_REFRESH_MS,
  })
}

/** Approves or rejects a lost-ticket report, then refreshes the queue and the lot's sessions. */
export function useDecideLostTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionId, decision, reason }: { sessionId: number; decision: ApprovalDecision; reason: string }) =>
      decision === 'APPROVED' ? approvalService.approveLostTicket(sessionId, { reason }) : approvalService.rejectLostTicket(sessionId, { reason }),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.gate.all }),
      ]),
  })
}
