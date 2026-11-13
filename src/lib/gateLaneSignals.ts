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

/** What the plate reader (ANPR) made of the vehicle stopped at a lane's rear camera. */
export type LanePlateRead =
  | { key: string; state: 'reading' }
  | { key: string; state: 'read'; plate: string; confidence: number }
  | { key: string; state: 'failed'; message: string }

const state: Record<LaneDirection, LaneSignal | null> = { entry: null, exit: null }
/** The latest plate read of each lane's camera; `key` says which vehicle it belongs to. */
const reads: Record<LaneDirection, LanePlateRead | null> = { entry: null, exit: null }
/** The next vehicle of a lane, held while the one let through is still driving out. */
const pending: Record<LaneDirection, LaneVehicle | null> = { entry: null, exit: null }
const recent = new Map<string, number>()
/** The lane whose tab the Staff has open on the lane panel. */
let activeLane: LaneDirection | null = null
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

/** Motorbike, 7-seat car or 4-seat car, from the vehicle type name the API sends ("7-Seat Car"). */
export const laneVehicleKind = (vehicleTypeName: string | null | undefined): LaneVehicleKind =>
  /motor|bike/i.test(vehicleTypeName ?? '') ? 'motorbike' : /7|seven|suv/i.test(vehicleTypeName ?? '') ? 'suv' : 'car'

export const gateLaneSignals = {
  /** The vehicle the lane handles now (null: none). A vehicle already let through keeps driving until it is out. */
  wait(direction: LaneDirection, vehicle: LaneVehicle | null) {
    const current = state[direction]
    if (current?.open) {
      // Still driving out: this one drives up once it has gone
      pending[direction] = vehicle && vehicle.key !== current.vehicle.key ? vehicle : null
      return
    }
    pending[direction] = null
    if (!vehicle) {
      if (current) set(direction, null)
      return
    }
    if (current?.vehicle.key === vehicle.key) return
    set(direction, { vehicle, open: false })
  },

  /** The Staff opened the barrier for this vehicle: it drives through (after driving up, if it was not waiting). */
  open(direction: LaneDirection, vehicle: LaneVehicle) {
    if (vehicle.plate) recent.set(plain(vehicle.plate), Date.now())
    const current = state[direction]
    if (pending[direction]?.key === vehicle.key) pending[direction] = null
    set(direction, { vehicle: current?.vehicle.key === vehicle.key ? current.vehicle : vehicle, open: true })
  },

  /** The vehicle has left the picture: the next vehicle waiting at this lane, if any, drives up. */
  done(direction: LaneDirection, key: string) {
    if (state[direction]?.vehicle.key !== key) return
    const next = pending[direction]
    pending[direction] = null
    set(direction, next ? { vehicle: next, open: false } : null)
  },

  /** The lane camera's plate reader has a new result (published by the 3D camera, read by the lane panel). */
  setRead(direction: LaneDirection, read: LanePlateRead) {
    if (reads[direction] === read) return
    reads[direction] = read
    listeners.forEach((listener) => listener())
  },

  /** The Staff switched the lane panel to this lane's tab (null: the panel is closed). */
  setActive(direction: LaneDirection | null) {
    if (activeLane === direction) return
    activeLane = direction
    listeners.forEach((listener) => listener())
  },

  /** The Staff let this plate through a moment ago (its session should not be replayed). */
  isRecent(plate: string) {
    const at = recent.get(plain(plate))
    return at != null && Date.now() - at < RECENT_MS
  },
}

/** The lane whose tab the Staff has open, if any. */
export function useActiveLane(): LaneDirection | null {
  return useSyncExternalStore(subscribe, () => activeLane)
}

/** The lane's vehicle handled by the Staff, if any. */
export function useLaneSignal(direction: LaneDirection): LaneSignal | null {
  return useSyncExternalStore(subscribe, () => state[direction])
}

/** The latest plate read of the lane's camera, for whichever vehicle it was. */
export function useLaneRead(direction: LaneDirection): LanePlateRead | null {
  return useSyncExternalStore(subscribe, () => reads[direction])
}
