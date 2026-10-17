import { useSyncExternalStore } from 'react'
import { demoApprovals, type DemoApproval } from '@/mocks/managerOps.mock'

export type ApprovalDecision = 'APPROVED' | 'REJECTED'

export interface DecidedApproval extends DemoApproval {
  decision?: ApprovalDecision
  decidedAt?: number
  remarks?: string
}

/*
 * The approval queue has no API yet: decisions are kept in memory for this page view, shared by
 * the Overview Console and the Approval Queue page.
 */
let items: DecidedApproval[] = demoApprovals.map((a) => ({ ...a }))
const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const snapshot = () => items

export function decideApproval(id: string, decision: ApprovalDecision, remarks: string) {
  items = items.map((a) => (a.id === id ? { ...a, decision, remarks, decidedAt: Date.now() } : a))
  listeners.forEach((listener) => listener())
}

export function useDemoApprovals() {
  const all = useSyncExternalStore(subscribe, snapshot, snapshot)
  return { all, pending: all.filter((a) => !a.decision) }
}
