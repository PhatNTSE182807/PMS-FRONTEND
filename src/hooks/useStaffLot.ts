import { useSyncExternalStore } from 'react'
import { useMyStaffLots } from './useParking'

const KEY = 'pms_staff_lot'
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
 * The facility / parking lot a Staff member is currently working at.
 * Reads the lot(s) assigned to the signed-in Staff. If multiple lots are assigned,
 * the choice is remembered in localStorage and synchronized across all staff screens.
 */
export function useStaffLot() {
  const lots = useMyStaffLots()
  const selectedId = useSyncExternalStore(subscribe, readSelected, () => null)
  const lot = lots.data?.find((l) => l.id === selectedId) ?? lots.data?.[0]

  return { lots, lot, setLotId: writeSelected }
}
