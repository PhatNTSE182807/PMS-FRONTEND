import { useCallback, useEffect, useRef, useState } from 'react'
import type { LaneVehicle, LaneVehicleKind } from '@/components/features/staff/GateLaneScene'
import type { ParkingSessionDTO } from '@/types/operations.dto'

/** Vehicles waiting to be shown in a lane; older ones are dropped when a busy lot sends many at once. */
const MAX_WAITING = 4

const kindOf = (session: ParkingSessionDTO): LaneVehicleKind => (/motor|bike/i.test(session.vehicleTypeName ?? '') ? 'motorbike' : 'car')

/**
 * Turns the lot's live sessions into vehicles for one 3D gate lane, one at a time.
 * `timeOf` picks the moment that counts (entry time for the entry lane, exit time for the exit lane);
 * sessions without it are ignored. On first load the latest vehicle is replayed so the lane is not empty;
 * after that only vehicles that pass the gate while the screen is open are added.
 */
export function useGateLaneQueue(sessions: ParkingSessionDTO[] | undefined, timeOf: (session: ParkingSessionDTO) => string | null) {
  const seen = useRef<Set<number> | null>(null)
  const [queue, setQueue] = useState<LaneVehicle[]>([])

  useEffect(() => {
    if (!sessions) return
    const passed = sessions
      .filter((s) => s.hasPlate && s.plateNumber && timeOf(s))
      .sort((a, b) => Date.parse(timeOf(a)!) - Date.parse(timeOf(b)!))
    const toVehicle = (s: ParkingSessionDTO): LaneVehicle => ({ key: `${s.id}-${timeOf(s)}`, plate: s.plateNumber, kind: kindOf(s) })

    if (!seen.current) {
      seen.current = new Set(passed.map((s) => s.id))
      const latest = passed.at(-1)
      if (latest) setQueue([toVehicle(latest)])
      return
    }
    const known = seen.current
    const fresh = passed.filter((s) => !known.has(s.id))
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
