import type { ParkingLotCapacityDTO, ZoneCapacityDTO } from '@/types/parking.dto'

export type BayStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED'
export type FloorKind = 'car' | 'motorbike'

export interface Bay {
  id: string
  code: string
  floorIndex: number
  row: number
  col: number
  status: BayStatus
}

export interface GarageFloor {
  index: number
  /** "L1" (ground) to "L3" (open-air rooftop) */
  level: string
  kind: FloorKind
  /** Zone(s) of the lot this floor stands for. */
  zoneLabel: string
  rows: number
  cols: number
  bays: Bay[]
  /** Live numbers of the underlying zone(s). */
  liveFree: number
  liveTotal: number
}

/** Bays drawn per floor: enough to read the floor at a glance, not one mesh per real space. */
const LAYOUT: Record<FloorKind, { rows: number; cols: number }> = {
  car: { rows: 2, cols: 12 },
  motorbike: { rows: 2, cols: 20 },
}

/** Share of the free bays held by bookings that have not arrived yet. */
const RESERVED_SHARE = 0.12

const isCarZone = (z: ZoneCapacityDTO) => /\bcars?\b/i.test(z.zoneName)

/** Small seeded PRNG, so a floor keeps the same layout of parked cars between refreshes. */
function seeded(seedText: string) {
  let h = 1779033703 ^ seedText.length
  for (let i = 0; i < seedText.length; i++) {
    h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

/** Fixed order in which a floor's bays fill up: the first N are occupied, the next ones reserved. */
function fillOrder(count: number, seed: string) {
  const random = seeded(seed)
  const order = Array.from({ length: count }, (_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

interface ZoneStats {
  label: string
  total: number
  occupied: number
}

const stats = (zones: ZoneCapacityDTO[], label?: string): ZoneStats => ({
  label: label ?? zones.map((z) => z.zoneName).join(' + '),
  total: zones.reduce((s, z) => s + z.totalSlots, 0),
  occupied: zones.reduce((s, z) => s + z.occupiedSlots, 0),
})

function buildFloor(index: number, level: string, kind: FloorKind, zone: ZoneStats, lotId: string): GarageFloor {
  const { rows, cols } = LAYOUT[kind]
  const count = rows * cols
  const ratio = zone.total > 0 ? zone.occupied / zone.total : 0
  const occupied = Math.min(count, Math.round(count * ratio))
  const reserved = Math.min(count - occupied, Math.round((count - occupied) * RESERVED_SHARE))
  const order = fillOrder(count, `${lotId}:${level}`)
  const statusOf = new Map<number, BayStatus>()
  order.forEach((bayIndex, rank) => {
    statusOf.set(bayIndex, rank < occupied ? 'OCCUPIED' : rank < occupied + reserved ? 'RESERVED' : 'AVAILABLE')
  })

  const prefix = kind === 'car' ? level : `${level}M`
  const bays: Bay[] = Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / cols)
    const col = i % cols
    return {
      id: `${lotId}-${level}-${i}`,
      code: `${prefix}-${String(i + 1).padStart(2, '0')}`,
      floorIndex: index,
      row,
      col,
      status: statusOf.get(i) ?? 'AVAILABLE',
    }
  })

  return { index, level, kind, zoneLabel: zone.label, rows, cols, bays, liveFree: Math.max(0, zone.total - zone.occupied), liveTotal: zone.total }
}

/**
 * Three levels for the 3D view: L1 (ground) for motorbikes, L2 and the open-air rooftop L3 for
 * cars. Each level mirrors the
 * live occupancy of the lot's zones, so its bays fill and empty as vehicles come and go.
 */
export function buildGarage(lot: ParkingLotCapacityDTO): GarageFloor[] {
  const carZones = lot.zones.filter(isCarZone)
  const bikeZones = lot.zones.filter((z) => !isCarZone(z))

  // Two car floors: one per car zone, or the single car zone shared between both floors.
  const carStats: ZoneStats[] =
    carZones.length >= 2
      ? [stats([carZones[0]]), stats(carZones.slice(1))]
      : carZones.length === 1
        ? [stats(carZones, `${carZones[0].zoneName} (north)`), stats(carZones, `${carZones[0].zoneName} (south)`)]
        : [0, 1].map((i) => {
            const car = lot.capacityByVehicle.find((d) => d.vehicleType === 'CAR')
            const total = Math.round((car?.totalSlots ?? 0) / 2)
            return { label: `Car deck ${i + 1}`, total, occupied: Math.round(total - (car?.availableSlots ?? 0) / 2) }
          })
  const bikeStats = bikeZones.length ? stats(bikeZones) : { label: 'Motorbike deck', total: 0, occupied: 0 }

  return [
    buildFloor(0, 'L1', 'motorbike', bikeStats, lot.id),
    buildFloor(1, 'L2', 'car', carStats[0], lot.id),
    buildFloor(2, 'L3', 'car', carStats[1], lot.id),
  ]
}
