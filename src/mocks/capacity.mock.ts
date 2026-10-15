import { occupancyRate, parkingSlots, zoneStatusFor } from '@/lib/occupancy'
import { toSearchable } from '@/lib/text'
import type {
  CapacityVehicleType,
  HourlyFlowDTO,
  ParkingLotCapacityDTO,
  ParkingLotStatus,
  ParkingLotSummaryDTO,
  VehicleCapacityDetail,
} from '@/types/parking.dto'
import { mockResponse } from './mockApi'
import { MOCK_PARKING_LOTS, toLotSummary, type MockParkingLot } from './parkingLots.mock'
import { createRandom, hashString, jitter, randomInt } from './random'
import { staffMock } from './users.mock'

type SlotType = Exclude<CapacityVehicleType, 'EV_CHARGING'>

interface ZoneState {
  zoneId: string
  zoneName: string
  vehicleType: SlotType
  totalSlots: number
  occupiedSlots: number
  maintenanceSlots: number
  /** Level the simulation drifts back towards, so lots do not all end up full. */
  targetSlots: number
}

interface LotState {
  lot: MockParkingLot
  status: ParkingLotStatus
  zones: ZoneState[]
  evOccupied: number
  flow: HourlyFlowDTO[]
  lastUpdated: number
}

/** Starting occupancy per lot (car, motorbike) — picked to show every colour band. */
const INITIAL_FILL: Record<string, [number, number]> = {
  'lot-01': [0.82, 0.64],
  'lot-02': [0.55, 0.48],
  'lot-03': [0.93, 0.71],
  'lot-04': [1, 0.99],
  'lot-05': [0.35, 0.42],
  'lot-06': [0.6, 0.88],
}
const MAINTENANCE_LOT_ID = 'lot-05'
const FLOW_HOURS = 6

/** Share of daily traffic arriving in each hour (morning and evening peaks). */
const HOURLY_PROFILE = [
  0.005, 0.003, 0.002, 0.002, 0.004, 0.012, 0.035, 0.075, 0.09, 0.07, 0.055, 0.05,
  0.055, 0.05, 0.048, 0.05, 0.06, 0.08, 0.085, 0.07, 0.05, 0.03, 0.015, 0.009,
]

const zoneType = (name: string): SlotType => (toSearchable(name).includes('o to') ? 'CAR' : 'MOTORBIKE')

/** Splits `total` into `parts` integer chunks with mild random weights. */
function split(total: number, parts: number, random: () => number): number[] {
  const weights = Array.from({ length: parts }, () => 0.75 + random() * 0.5)
  const sum = weights.reduce((a, b) => a + b, 0)
  const chunks = weights.map((w) => Math.floor((total * w) / sum))
  chunks[0] += total - chunks.reduce((a, b) => a + b, 0)
  return chunks
}

function buildFlow(lot: MockParkingLot, random: () => number): HourlyFlowDTO[] {
  const daily = lot.dailyCars + lot.dailyMotorbikes
  const currentHour = new Date().getHours()
  return Array.from({ length: FLOW_HOURS }, (_, i) => {
    const hour = (currentHour - (FLOW_HOURS - 1 - i) + 24) % 24
    const arrivals = daily * HOURLY_PROFILE[hour]
    // Departures lag arrivals by a few hours.
    const departures = daily * HOURLY_PROFILE[(hour + 20) % 24]
    return {
      hour: `${String(hour).padStart(2, '0')}:00`,
      checkIns: Math.round(arrivals * jitter(random, 0.15)),
      checkOuts: Math.round(departures * jitter(random, 0.15)),
    }
  })
}

function buildLotState(lot: MockParkingLot): LotState {
  const random = createRandom(hashString(lot.id))
  const [carFill, motorbikeFill] = INITIAL_FILL[lot.id] ?? [0.5, 0.5]
  const isMaintenance = lot.id === MAINTENANCE_LOT_ID

  const zones: ZoneState[] = []
  for (const type of ['CAR', 'MOTORBIKE'] as const) {
    const names = lot.zones.filter((name) => zoneType(name) === type)
    const total = type === 'CAR' ? lot.carSlots : lot.motorbikeSlots
    const fill = type === 'CAR' ? carFill : motorbikeFill
    split(total, names.length, random).forEach((slots, i) => {
      const maintenanceSlots = isMaintenance && i === 0 ? Math.round(slots * 0.4) : random() < 0.5 ? 0 : randomInt(random, 1, 3)
      const usable = slots - maintenanceSlots
      const occupiedSlots = Math.min(usable, Math.round(slots * fill * jitter(random, 0.06)))
      zones.push({
        zoneId: `${lot.id}-z${zones.length + 1}`,
        zoneName: names[i],
        vehicleType: type,
        totalSlots: slots,
        maintenanceSlots,
        occupiedSlots,
        targetSlots: occupiedSlots,
      })
    })
  }

  return {
    lot,
    status: isMaintenance ? 'MAINTENANCE' : 'OPEN',
    zones,
    evOccupied: Math.round(lot.evChargers * (0.4 + random() * 0.5)),
    flow: buildFlow(lot, random),
    lastUpdated: Date.now(),
  }
}

let state: LotState[] | null = null
const getState = () => (state ??= MOCK_PARKING_LOTS.map(buildLotState))

function capacityOf(lotState: LotState, type: SlotType): VehicleCapacityDetail {
  const zones = lotState.zones.filter((z) => z.vehicleType === type)
  const totalSlots = zones.reduce((s, z) => s + z.totalSlots, 0)
  const occupiedSlots = zones.reduce((s, z) => s + z.occupiedSlots, 0)
  const maintenanceSlots = zones.reduce((s, z) => s + z.maintenanceSlots, 0)
  return {
    vehicleType: type,
    totalSlots,
    occupiedSlots,
    maintenanceSlots,
    availableSlots: Math.max(0, totalSlots - occupiedSlots - maintenanceSlots),
  }
}

function toDto(lotState: LotState): ParkingLotCapacityDTO {
  const { lot } = lotState
  const capacityByVehicle: VehicleCapacityDetail[] = [capacityOf(lotState, 'CAR'), capacityOf(lotState, 'MOTORBIKE')]
  if (lot.evChargers > 0) {
    capacityByVehicle.push({
      vehicleType: 'EV_CHARGING',
      totalSlots: lot.evChargers,
      occupiedSlots: lotState.evOccupied,
      maintenanceSlots: 0,
      availableSlots: lot.evChargers - lotState.evOccupied,
    })
  }
  const slots = parkingSlots(capacityByVehicle)

  return {
    ...toLotSummary(lot),
    managerOnDuty: staffMock.managerOf(lot.id) ?? 'Unassigned',
    status: lotState.status,
    lastUpdated: new Date(lotState.lastUpdated).toISOString(),
    overallOccupancyPercentage: Math.round(occupancyRate(slots.occupied, slots.total) * 10) / 10,
    capacityByVehicle,
    zones: lotState.zones.map((z) => ({
      zoneId: z.zoneId,
      zoneName: z.zoneName,
      totalSlots: z.totalSlots,
      occupiedSlots: z.occupiedSlots,
      status: zoneStatusFor(occupancyRate(z.occupiedSlots, z.totalSlots - z.maintenanceSlots)),
    })),
    recentHourlyFlow: lotState.flow,
  }
}

/** One step of the demo "live updates": vehicles arrive and leave at random. */
function simulateTick() {
  const random = Math.random
  for (const lotState of getState()) {
    if (lotState.status === 'CLOSED') continue
    let arrivals = 0
    let departures = 0

    for (const zone of lotState.zones) {
      const usable = zone.totalSlots - zone.maintenanceSlots
      // Random walk of up to ±4% of the zone per tick, pulled back towards its usual level.
      const step = Math.max(1, Math.round(zone.totalSlots * 0.04))
      const pull = (zone.targetSlots - zone.occupiedSlots) * 0.12
      const delta = Math.round((random() * 2 - 1) * step + pull)
      const next = Math.min(usable, Math.max(0, zone.occupiedSlots + delta))
      const applied = next - zone.occupiedSlots
      if (applied > 0) arrivals += applied
      else departures -= applied
      zone.occupiedSlots = next
    }

    if (lotState.lot.evChargers > 0) {
      const ev = lotState.evOccupied + Math.round(random() * 2 - 1)
      lotState.evOccupied = Math.min(lotState.lot.evChargers, Math.max(0, ev))
    }

    const current = lotState.flow[lotState.flow.length - 1]
    current.checkIns += arrivals
    current.checkOuts += departures

    if (lotState.status !== 'MAINTENANCE') {
      const isFull = lotState.zones.every((z) => z.occupiedSlots >= z.totalSlots - z.maintenanceSlots)
      lotState.status = isFull ? 'FULL' : 'OPEN'
    }
    if (arrivals > 0 || departures > 0) lotState.lastUpdated = Date.now()
  }
}

export const capacityMock = {
  getParkingLots: (): Promise<ParkingLotSummaryDTO[]> => mockResponse(() => MOCK_PARKING_LOTS.map(toLotSummary), 200),

  getCapacityOverview: (): Promise<ParkingLotCapacityDTO[]> => mockResponse(() => getState().map(toDto)),

  /** Advances the simulation and returns the new snapshot immediately (no latency). */
  simulateTick(): ParkingLotCapacityDTO[] {
    simulateTick()
    return structuredClone(getState().map(toDto))
  },
}
