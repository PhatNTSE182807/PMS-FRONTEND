import { useCallback, useEffect, useRef, useState } from 'react'
import type { LaneVehicle } from '@/components/features/staff/GateLaneScene'
import { gateLaneSignals, laneVehicleKind } from '@/lib/gateLaneSignals'
import type { ParkingSessionDTO } from '@/types/operations.dto'

/** Vehicles waiting to be shown in a lane; older ones are dropped when a busy lot sends many at once. */
const MAX_WAITING = 4


/**
 * Turns the lot's live sessions into vehicles for one 3D gate lane, one at a time.
 * `timeOf` picks the moment that counts (entry time for the entry lane, exit time for the exit lane);
 * sessions without it are ignored. On first load the latest vehicle is replayed so the lane is not empty;
 * after that only vehicles that pass the gate while the screen is open are added, except those the Staff opened
 * the barrier for here (the lane already showed them, see gateLaneSignals).
 */
export function useGateLaneQueue(sessions: ParkingSessionDTO[] | undefined, timeOf: (session: ParkingSessionDTO) => string | null) {
  const seen = useRef<Set<number> | null>(null)
  const [queue, setQueue] = useState<LaneVehicle[]>([])

  useEffect(() => {
    if (!sessions) return
    const passed = sessions
      .filter((s) => s.hasPlate && s.plateNumber && timeOf(s))
      .sort((a, b) => Date.parse(timeOf(a)!) - Date.parse(timeOf(b)!))
    const toVehicle = (s: ParkingSessionDTO): LaneVehicle => ({
      key: `${s.id}-${timeOf(s)}`,
      plate: s.plateNumber,
      kind: laneVehicleKind(s.vehicleTypeName),
      paint: s.paintColor,
    })

    if (!seen.current) {
      seen.current = new Set(passed.map((s) => s.id))
      const latest = passed.at(-1)
      if (latest) setQueue([toVehicle(latest)])
      return
    }
    const known = seen.current
    // Vehicles the Staff let through on this screen were already shown driving through the barrier
    const fresh = passed.filter((s) => !known.has(s.id) && !gateLaneSignals.isRecent(s.plateNumber))
    if (fresh.length === 0) return
    fresh.forEach((s) => known.add(s.id))
    setQueue((current) => {
      // Keep the vehicle on screen, then the newest arrivals
      const [playing, ...waiting] = current
      const next = [...waiting, ...fresh.map(toVehicle)].slice(-MAX_WAITING)
      return playing ? [playing, ...next] : next
    })
  }, [sessions, timeOf])

  /** The vehicle on screen has left: show the next one. */
  const next = useCallback(() => setQueue((current) => current.slice(1)), [])

  return { vehicle: queue[0] ?? null, waiting: Math.max(0, queue.length - 1), next }
}
