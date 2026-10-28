import type {
  LotInput,
  LotState,
  ManagedLot,
  ManagedSlot,
  ManagedZone,
  SlotState,
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
  openTime: string | null
  closeTime: string | null
  is24Hours: boolean
  capacity: number
  imageUrl: string | null
  description: string | null
  /** What customers see: Maintenance while the lot has no active Manager and Staff. */
  status: string
  /** The status the Admin set. */
  storedStatus?: string
  isStaffed?: boolean
  closedFrom: string | null
  closedUntil: string | null
  closureReason: string | null
  maintenanceNotice: string | null
  managerUserId: string | null
  /** Ready-made building model (L3S20, L3S50, L4S30) the zones, slots and 3D layout come from. */
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

/** Older zones kept their per-vehicle-type capacity in LayoutJson; generated zones count their slots. */
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
    vehicleCapacities: parseLayout(zone.layoutJson).vehicleCapacities ?? countByVehicleType(slots.filter((s) => s.zoneId === zone.id && s.isActive)),
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
    is24Hours: lot.is24Hours,
    openTime: toTimeInput(lot.openTime),
    closeTime: toTimeInput(lot.closeTime),
    capacity: lot.capacity,
    imageUrl: lot.imageUrl ?? '',
    description: lot.description ?? '',
    managerUserId: lot.managerUserId ?? '',
    layoutTemplate: lot.layoutTemplate ?? '',
    status: (lot.storedStatus ?? lot.status) as LotState,
    isStaffed: lot.isStaffed ?? true,
    closedFrom: toDateTimeInput(lot.closedFrom),
    closedUntil: toDateTimeInput(lot.closedUntil),
    closureReason: lot.closureReason ?? '',
    maintenanceNotice: lot.maintenanceNotice ?? '',
    zones: zones.filter((z) => z.parkingLotId === lot.id).map((z) => toZone(z, slots)),
  }
}

function countByVehicleType(slots: SlotResponse[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const slot of slots) counts[slot.vehicleTypeCode] = (counts[slot.vehicleTypeCode] ?? 0) + 1
  return counts
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

  /**
   * POST /lots builds the zones, slots and 3D layout from the chosen ready-made model. An older lot
   * without zones gets its model through PUT /lots/{id}/template; afterwards the model is fixed.
   */
  async saveLot(input: LotInput, id?: string, hasZones = false): Promise<string> {
    const body = {
      name: input.name.trim(),
      address: input.address.trim(),
      is24Hours: input.is24Hours,
      openTime: input.is24Hours ? null : toTimeOnly(input.openTime),
      closeTime: input.is24Hours ? null : toTimeOnly(input.closeTime),
      imageUrl: input.imageUrl || null,
      description: input.description || null,
      managerUserId: input.managerUserId || null,
    }
    if (id) {
      await http.put<LotResponse>(`/lots/${id}`, body)
      if (!hasZones) await http.put<LotResponse>(`/lots/${id}/template`, { layoutTemplate: input.layoutTemplate })
      return id
    }
    const created = await http.post<LotResponse>('/lots', {
      ...body,
      code: input.code.trim(),
      layoutTemplate: input.layoutTemplate,
    })
    return String(created.id)
  },

  deleteLot(id: string): Promise<boolean> {
    return http.delete<boolean>(`/lots/${id}`)
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
