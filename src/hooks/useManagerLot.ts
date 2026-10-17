import { useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { lotManagementService } from '@/api/lot-management.service'
import { useAuth } from './useAuth'

const KEY = 'pms_manager_lot'
const listeners = new Set<() => void>()

function readSelected(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

function writeSelected(id: string) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // Storage unavailable: the choice only lasts for this page view.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * The parking lot a Manager is working on. Managers see only their assigned lots; the choice
 * is remembered in this browser and shared by every page of the console.
 */
export function useManagerLot() {
  const { user } = useAuth()
  // Same query key as the Parking Lots page, so both share one cache entry.
  const lots = useQuery({
    queryKey: ['lot-management', user?.userId],
    queryFn: () => lotManagementService.list(),
  })
  const selectedId = useSyncExternalStore(subscribe, readSelected, () => null)
  const lot = lots.data?.find((l) => l.id === selectedId) ?? lots.data?.[0]

  return { lots, lot, setLotId: writeSelected }
}
