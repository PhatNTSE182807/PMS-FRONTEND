import type {
  LotInput,
  LotState,
  ManagedLot,
  ManagedSlot,
  ManagedZone,
  SlotInput,
  SlotState,
  ZoneInput,
  ZoneKind,
} from '@/types/lot-management.dto'
import { http } from './axiosClient'

/*
 * REST side of lot management: PMS.API LotsController, ZonesController and SlotsController.
 * Ids are integers on the backend and strings on the client.
 */

interface LotResponse {
  id: number
  code: string
  name: string
  address: string
  latitude: number | null
  longitude: number | null
  openTime: string | null
  closeTime: string | null
  is24Hours: boolean
  capacity: number
  imageUrl: string | null
  description: string | null
  status: string
  closedFrom: string | null
  closedUntil: string | null
  closureReason: string | null
  maintenanceNotice: string | null
  managerUserId: string | null
  /** Proposed field: the 3D building template id. */
  layoutTemplate?: string | null
}

interface ZoneResponse {
  id: number
  parkingLotId: number
  code: string
  name: string
  zoneType: string
  floorNo: number | null
  capacity: number
  maxReservationSlots: number | null
  layoutJson: string | null
  isActive: boolean
}

interface SlotResponse {
  id: number
  zoneId: number
  vehicleTypeCode: string
  code: string
  status: string
  isActive: boolean
}

interface VehicleTypeResponse {
  id: number
  code: string
}

/** The backend has no per-vehicle-type zone capacity, so the client keeps it in LayoutJson. */
interface ZoneLayout {
  vehicleCapacities?: Record<string, number>
}

function parseLayout(json: string | null): ZoneLayout {
  if (!json) return {}
  try {
    const parsed: unknown = JSON.parse(json)
    return typeof parsed === 'object' && parsed !== null ? (parsed as ZoneLayout) : {}
  } catch {
    return {}
  }
}

/** "07:00:00" -> "07:00" for <input type="time">. */
const toTimeInput = (time: string | null) => (time ? time.slice(0, 5) : '')
/** "07:00" -> "07:00:00" (System.TimeOnly). */
const toTimeOnly = (time: string) => (time ? `${time.length === 5 ? `${time}:00` : time}` : null)
/** ISO date-time -> "YYYY-MM-DDTHH:mm" for <input type="datetime-local">. */
const toDateTimeInput = (value: string | null) => (value ? value.slice(0, 16) : '')
const toDateTime = (value: string) => (value ? new Date(value).toISOString() : null)

function toSlot(slot: SlotResponse): ManagedSlot {
  return {
    id: String(slot.id),
    code: slot.code,
    vehicleTypeId: slot.vehicleTypeCode,
    status: slot.status as SlotState,
  }
}

function toZone(zone: ZoneResponse, slots: SlotResponse[]): ManagedZone {
  return {
    id: String(zone.id),
    code: zone.code,
    name: zone.name,
    zoneType: zone.zoneType as ZoneKind,
    floorNo: zone.floorNo,
    capacity: zone.capacity,
    vehicleCapacities: parseLayout(zone.layoutJson).vehicleCapacities ?? {},
    reservationLimit: zone.maxReservationSlots ?? 0,
    isActive: zone.isActive,
    slots: slots.filter((s) => s.zoneId === zone.id && s.isActive).map(toSlot),
  }
}

function toLot(lot: LotResponse, zones: ZoneResponse[], slots: SlotResponse[]): ManagedLot {
  return {
    id: String(lot.id),
    code: lot.code,
    name: lot.name,
    address: lot.address,
    latitude: lot.latitude,
    longitude: lot.longitude,
    is24Hours: lot.is24Hours,
    openTime: toTimeInput(lot.openTime),
    closeTime: toTimeInput(lot.closeTime),
    capacity: lot.capacity,
    imageUrl: lot.imageUrl ?? '',
    description: lot.description ?? '',
    managerUserId: lot.managerUserId ?? '',
    layoutTemplate: lot.layoutTemplate ?? '',
    status: lot.status as LotState,
    closedFrom: toDateTimeInput(lot.closedFrom),
    closedUntil: toDateTimeInput(lot.closedUntil),
    closureReason: lot.closureReason ?? '',
    maintenanceNotice: lot.maintenanceNotice ?? '',
    zones: zones.filter((z) => z.parkingLotId === lot.id).map((z) => toZone(z, slots)),
  }
}

let vehicleTypeIds: Promise<Map<string, number>> | undefined

/** Slots reference vehicle types by integer id; the client uses the codes (CAR_4, MOTORBIKE…). */
function vehicleTypeId(code: string): Promise<number> {
  vehicleTypeIds ??= http
    .get<VehicleTypeResponse[]>('/Users/profile/vehicle-types')
    .then((types) => new Map(types.map((t) => [t.code, t.id])))
    .catch((error: unknown) => {
      vehicleTypeIds = undefined
      throw error
    })
  return vehicleTypeIds.then((ids) => {
    const id = ids.get(code)
    if (id === undefined) throw new Error('Invalid vehicle type.')
    return id
  })
}

export const lotManagementApi = {
  async list(): Promise<ManagedLot[]> {
    const [lots, zones, slots] = await Promise.all([
      http.get<LotResponse[]>('/lots'),
      http.get<ZoneResponse[]>('/zones'),
      http.get<SlotResponse[]>('/slots'),
    ])
    return lots.map((lot) => toLot(lot, zones, slots))
  },

  async saveLot(input: LotInput, id?: string): Promise<string> {
    const body = {
      name: input.name.trim(),
      address: input.address.trim(),
      latitude: input.latitude,
      longitude: input.longitude,
      is24Hours: input.is24Hours,
      openTime: input.is24Hours ? null : toTimeOnly(input.openTime),
      closeTime: input.is24Hours ? null : toTimeOnly(input.closeTime),
      capacity: input.capacity,
      imageUrl: input.imageUrl || null,
      description: input.description || null,
      managerUserId: input.managerUserId || null,
      layoutTemplate: input.layoutTemplate || null,
    }
    if (id) {
      await http.put<LotResponse>(`/lots/${id}`, body)
      return id
    }
    const created = await http.post<LotResponse>('/lots', { ...body, code: input.code.trim() })
    return String(created.id)
  },

  deleteLot(id: string): Promise<boolean> {
    return http.delete<boolean>(`/lots/${id}`)
  },

  async saveZone(lotId: string, input: ZoneInput, id?: string): Promise<void> {
    const body = {
      name: input.name.trim(),
      zoneType: input.zoneType,
      floorNo: input.floorNo,
      capacity: input.capacity,
      maxReservationSlots: input.reservationLimit,
      layoutJson: JSON.stringify({ vehicleCapacities: input.vehicleCapacities } satisfies ZoneLayout),
    }
    if (id) {
      await http.put<ZoneResponse>(`/zones/${id}`, { ...body, isActive: input.isActive })
      return
    }
    const created = await http.post<ZoneResponse>(`/lots/${lotId}/zones`, {
      ...body,
      parkingLotId: Number(lotId),
      code: input.code.trim(),
    })
    // New zones start active on the backend.
    if (!input.isActive) await http.put<ZoneResponse>(`/zones/${created.id}`, { ...body, isActive: false })
  },

  deleteZone(id: string): Promise<boolean> {
    return http.delete<boolean>(`/zones/${id}`)
  },

  async saveSlot(zoneId: string, input: SlotInput, current?: ManagedSlot): Promise<void> {
    const typeId = await vehicleTypeId(input.vehicleTypeId)
    if (!current) {
      await http.post<SlotResponse>(`/zones/${zoneId}/slots`, {
        zoneId: Number(zoneId),
        vehicleTypeId: typeId,
        code: input.code.trim(),
        status: input.status,
      })
      return
    }
    await http.put<SlotResponse>(`/slots/${current.id}`, { vehicleTypeId: typeId, code: input.code.trim() })
    if (current.status !== input.status) {
      await http.patch<SlotResponse>(`/slots/${current.id}/status`, { status: input.status })
    }
  },

  deleteSlot(id: string): Promise<boolean> {
    return http.delete<boolean>(`/slots/${id}`)
  },

  setOperation(
    lotId: string,
    patch: Pick<ManagedLot, 'status' | 'closedFrom' | 'closedUntil' | 'closureReason' | 'maintenanceNotice'>,
  ): Promise<boolean> {
    return http.patch<boolean>(`/lots/${lotId}/status`, {
      status: patch.status,
      closureReason: patch.closureReason || null,
      maintenanceNotice: patch.maintenanceNotice || null,
      closedFrom: toDateTime(patch.closedFrom),
      closedUntil: toDateTime(patch.closedUntil),
    })
  },
}
