import { useState } from 'react'
import type { LaneDirection } from '@/components/features/staff/GateLaneScene'
import { useAnprStatus } from '@/hooks/useAnpr'
import { useLaneRead, useLaneSignal } from '@/lib/gateLaneSignals'

/** Plate text for comparing: upper case, without spaces, dots or dashes ("30r-464.62" → "30R46462"). */
export const normalisePlate = (plate: string | null | undefined) => (plate ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '')

/** Both plates are the same once normalised (an empty plate never matches). */
export const platesMatch = (a: string | null | undefined, b: string | null | undefined) => normalisePlate(a) !== '' && normalisePlate(a) === normalisePlate(b)

/**
 * The plate of the vehicle stopped at a lane's barrier: what the lane camera's plate reader read for it, and the
 * plate the Staff confirms. Every new camera read fills the Staff plate with exactly that text; the Staff can still
 * edit it. `resetKey` clears the Staff plate when the lane moves on to another vehicle.
 */
export function useLanePlate(direction: LaneDirection, resetKey: string) {
  const anpr = useAnprStatus()
  const signal = useLaneSignal(direction)
  const laneRead = useLaneRead(direction)
  // Only the read of the vehicle waiting at the closed barrier counts, not one already driving through
  const waitingKey = signal && !signal.open ? signal.vehicle.key : null
  const read = laneRead && laneRead.key === waitingKey ? laneRead : null

  const [plate, setPlate] = useState('')
  const [filledFrom, setFilledFrom] = useState<string | null>(null)
  const [resetFor, setResetFor] = useState(resetKey)
  // Adjusting state while rendering (not in an effect): a new vehicle clears the field, a new read fills it
  if (resetFor !== resetKey) {
    setResetFor(resetKey)
    setPlate('')
  }
  const readId = read?.state === 'read' && read.plate ? `${read.key}|${read.plate}` : null
  if (read?.state === 'read' && readId && readId !== filledFrom) {
    setFilledFrom(readId)
    setPlate(read.plate)
  }

  return {
    direction,
    anpr,
    read,
    /** A vehicle waits at the lane's closed barrier. */
    vehicleWaiting: Boolean(waitingKey),
    plate,
    setPlate,
    /** The camera's confidence when the Staff plate is still the plate it read; undefined when typed or changed. */
    confidence: read?.state === 'read' && platesMatch(plate, read.plate) ? read.confidence : undefined,
    /** Empties the Staff plate after the vehicle was let through (the same read does not fill it again). */
    clear: () => setPlate(''),
  }
}

export type LanePlate = ReturnType<typeof useLanePlate>
