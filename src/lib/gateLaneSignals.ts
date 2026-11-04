import { useSyncExternalStore } from 'react'
import type { LaneDirection, LaneVehicle, LaneVehicleKind } from '@/components/features/staff/GateLaneScene'

/**
 * What the Staff does at the lanes, for the 3D gate cameras: the vehicle the lane is handling drives up and
 * waits at the closed barrier, and drives through once the Staff opens it. The lane panels publish here;
 * the cameras read it.
 */
export interface LaneSignal {
  vehicle: LaneVehicle
  /** The Staff opened the barrier for this vehicle. */
  open: boolean
}

/** Vehicles the Staff let through are not replayed again when their session shows up in the lists. */
const RECENT_MS = 3 * 60_000

const state: Record<LaneDirection, LaneSignal | null> = { entry: null, exit: null }
const recent = new Map<string, number>()
const listeners = new Set<() => void>()

const plain = (plate: string) => plate.toUpperCase().replace(/[^0-9A-Z]/g, '')

function set(direction: LaneDirection, signal: LaneSignal | null) {
  state[direction] = signal
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Car or motorbike, from the vehicle type name the API sends. */
export const laneVehicleKind = (vehicleTypeName: string | null | undefined): LaneVehicleKind =>
  /motor|bike/i.test(vehicleTypeName ?? '') ? 'motorbike' : 'car'

export const gateLaneSignals = {
  /** The vehicle the lane handles now (null: none). A vehicle already let through keeps driving until it is out. */
  wait(direction: LaneDirection, vehicle: LaneVehicle | null) {
    const current = state[direction]
    if (!vehicle) {
      if (current && !current.open) set(direction, null)
      return
    }
    if (current?.vehicle.key === vehicle.key || current?.open) return
    set(direction, { vehicle, open: false })
  },

  /** The Staff opened the barrier for this vehicle: it drives through (after driving up, if it was not waiting). */
  open(direction: LaneDirection, vehicle: LaneVehicle) {
    if (vehicle.plate) recent.set(plain(vehicle.plate), Date.now())
    const current = state[direction]
    set(direction, { vehicle: current?.vehicle.key === vehicle.key ? current.vehicle : vehicle, open: true })
  },

  /** The vehicle has left the picture. */
  done(direction: LaneDirection, key: string) {
    if (state[direction]?.vehicle.key === key) set(direction, null)
  },

  /** The Staff let this plate through a moment ago (its session should not be replayed). */
  isRecent(plate: string) {
    const at = recent.get(plain(plate))
    return at != null && Date.now() - at < RECENT_MS
  },
}

/** The lane's vehicle handled by the Staff, if any. */
export function useLaneSignal(direction: LaneDirection): LaneSignal | null {
  return useSyncExternalStore(subscribe, () => state[direction])
}
