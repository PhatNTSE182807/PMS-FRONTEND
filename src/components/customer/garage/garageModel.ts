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
  /** "L1" (ground) up to the open-air rooftop. */
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

/* ------------------------------------------------------------------ */
/* Building templates the Admin picks when registering a lot            */
/* ------------------------------------------------------------------ */

export type GarageTemplateId = 'L3S20' | 'L3S50' | 'L4S30'

export interface GarageTemplate {
  id: GarageTemplateId
  name: string
  summary: string
  /** Kind of each level, ground first. Motorbikes always park on the ground level. */
  floors: FloorKind[]
  slotsPerFloor: number
}

export const GARAGE_TEMPLATES: GarageTemplate[] = [
  { id: 'L3S20', name: 'Compact deck', summary: '3 levels × 20 bays · 2 car levels, motorbikes on the ground', floors: ['motorbike', 'car', 'car'], slotsPerFloor: 20 },
  { id: 'L3S50', name: 'Wide deck', summary: '3 levels × 50 bays · 2 car levels, motorbikes on the ground', floors: ['motorbike', 'car', 'car'], slotsPerFloor: 50 },
  { id: 'L4S30', name: 'Tower', summary: '4 levels × 30 bays · 3 car levels, motorbikes on the ground', floors: ['motorbike', 'car', 'car', 'car'], slotsPerFloor: 30 },
]

export const findTemplate = (id: string | null | undefined) => GARAGE_TEMPLATES.find((t) => t.id === id)

export const templateCapacity = (t: GarageTemplate) => {
  const car = t.floors.filter((k) => k === 'car').length * t.slotsPerFloor
  const motorbike = t.floors.filter((k) => k === 'motorbike').length * t.slotsPerFloor
  return { car, motorbike, total: car + motorbike }
}

/** Up to 30 bays a level fits in two rows around one lane; bigger levels use two lanes and four rows. */
const rowsFor = (slots: number) => (slots > 30 ? 4 : 2)

/** Share of the free bays held by bookings that have not arrived yet. */
const RESERVED_SHARE = 0.12

const isCarZone = (z: ZoneCapacityDTO) => /\bcars?\b/i.test(z.zoneName)

/** Small seeded PRNG, so a floor keeps the same layout of parked vehicles between refreshes. */
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

export interface ZoneStats {
  label: string
  total: number
  occupied: number
  /** Bookings not yet arrived; estimated from RESERVED_SHARE when unknown. */
  reserved?: number
}

const stats = (zones: ZoneCapacityDTO[], label?: string): ZoneStats => ({
  label: label ?? zones.map((z) => z.zoneName).join(' + '),
  total: zones.reduce((s, z) => s + z.totalSlots, 0),
  occupied: zones.reduce((s, z) => s + z.occupiedSlots, 0),
})

function buildFloor(index: number, kind: FloorKind, slots: number, zone: ZoneStats, seed: string): GarageFloor {
  const level = `L${index + 1}`
  const rows = rowsFor(slots)
  const cols = Math.ceil(slots / rows)
  const ratio = zone.total > 0 ? zone.occupied / zone.total : 0
  const occupied = Math.min(slots, Math.round(slots * ratio))
  const reservedRatio = zone.reserved !== undefined && zone.total > 0 ? zone.reserved / zone.total : undefined
  // A level without live numbers (a template preview) shows every bay free.
  const reserved =
    zone.total > 0
      ? Math.min(slots - occupied, reservedRatio !== undefined ? Math.round(slots * reservedRatio) : Math.round((slots - occupied) * RESERVED_SHARE))
      : 0
  const order = fillOrder(slots, `${seed}:${level}`)
  const statusOf = new Map<number, BayStatus>()
  order.forEach((bayIndex, rank) => {
    statusOf.set(bayIndex, rank < occupied ? 'OCCUPIED' : rank < occupied + reserved ? 'RESERVED' : 'AVAILABLE')
  })

  const prefix = kind === 'car' ? level : `${level}M`
  const bays: Bay[] = Array.from({ length: slots }, (_, i) => ({
    id: `${seed}-${level}-${i}`,
    code: `${prefix}-${String(i + 1).padStart(2, '0')}`,
    floorIndex: index,
    row: Math.floor(i / cols),
    col: i % cols,
    status: statusOf.get(i) ?? 'AVAILABLE',
  }))

  return { index, level, kind, zoneLabel: zone.label, rows, cols, bays, liveFree: Math.max(0, zone.total - zone.occupied), liveTotal: zone.total }
}

/** Levels of a template, each mirroring the given stats (index-aligned with `template.floors`). */
export function buildTemplateGarage(template: GarageTemplate, floorStats: ZoneStats[], seed: string): GarageFloor[] {
  return template.floors.map((kind, i) => buildFloor(i, kind, template.slotsPerFloor, floorStats[i] ?? { label: '', total: 0, occupied: 0 }, seed))
}

/** The lot's own template, or a stable pick from its id until the backend stores one. */
export function templateForLot(lot: Pick<ParkingLotCapacityDTO, 'id'> & { layoutTemplate?: string | null }): GarageTemplate {
  const own = findTemplate(lot.layoutTemplate)
  if (own) return own
  const hash = [...lot.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)
  return GARAGE_TEMPLATES[hash % GARAGE_TEMPLATES.length]
}

/**
 * Levels for the customer 3D view: motorbikes on the ground, cars above. Each level mirrors the
 * live occupancy of the lot's zones, so its bays fill and empty as vehicles come and go.
 */
export function buildGarage(lot: ParkingLotCapacityDTO): GarageFloor[] {
  const template = templateForLot(lot)
  const carZones = lot.zones.filter(isCarZone)
  const bikeZones = lot.zones.filter((z) => !isCarZone(z))
  const carLevels = template.floors.filter((k) => k === 'car').length

  // One car zone per car level when there are enough, otherwise the car zones are shared.
  const carStats: ZoneStats[] = Array.from({ length: carLevels }, (_, i) => {
    if (carZones.length >= carLevels) {
      const per = Math.floor(carZones.length / carLevels)
      return stats(i === carLevels - 1 ? carZones.slice(i * per) : carZones.slice(i * per, (i + 1) * per))
    }
    if (carZones.length) return stats(carZones, `${carZones.map((z) => z.zoneName).join(' + ')} (deck ${i + 1})`)
    const car = lot.capacityByVehicle.find((d) => d.vehicleType === 'CAR')
    const total = Math.round((car?.totalSlots ?? 0) / carLevels)
    return { label: `Car deck ${i + 1}`, total, occupied: Math.round(total - (car?.availableSlots ?? 0) / carLevels) }
  })
  const bikeStats = bikeZones.length ? stats(bikeZones) : { label: 'Motorbike deck', total: 0, occupied: 0 }

  let car = 0
  return buildTemplateGarage(
    template,
    template.floors.map((kind) => (kind === 'car' ? carStats[car++] : bikeStats)),
    lot.id,
  )
}
