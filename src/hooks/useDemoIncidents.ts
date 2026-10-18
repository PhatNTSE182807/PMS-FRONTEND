import { useSyncExternalStore } from 'react'
import { demoIncidents, type DemoIncident } from '@/mocks/staffOps.mock'

export type IncidentResolution = 'RESOLVED' | 'LOST_TICKET' | 'ESCALATED' | 'BLACKLISTED'

export interface TrackedIncident extends DemoIncident {
  resolution?: IncidentResolution
  resolvedAt?: number
  reason?: string
}

/*
 * The incident queue has no API yet: resolutions are kept in memory for this page view, shared by
 * the Staff nav badge, the Gate Dashboard and the Exceptions page.
 */
let items: TrackedIncident[] = demoIncidents.map((i) => ({ ...i }))
const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const snapshot = () => items

export function resolveIncident(id: string, resolution: IncidentResolution, reason: string) {
  items = items.map((i) => (i.id === id ? { ...i, resolution, reason, resolvedAt: Date.now() } : i))
  listeners.forEach((listener) => listener())
}

export function useDemoIncidents() {
  const all = useSyncExternalStore(subscribe, snapshot, snapshot)
  return { all, open: all.filter((i) => !i.resolution) }
}
