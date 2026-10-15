/** FR-LOT-01..04,06. These write DTOs are a proposed contract, not existing BE endpoints. */
export type LotState =
  | 'Active'
  | 'Inactive'
  | 'TemporarilyClosed'
  | 'Maintenance'
export type SlotState = 'Available' | 'Reserved' | 'Occupied' | 'Maintenance'
export type ZoneKind = 'Floor' | 'Row' | 'Area'
export interface ManagedSlot {
  id: string
  code: string
  vehicleTypeId: string
  status: SlotState
}
export interface ManagedZone {
  id: string
  code: string
  name: string
  zoneType: ZoneKind
  floorNo: number | null
  capacity: number
  vehicleCapacities: Record<string, number>
  reservationLimit: number
  isActive: boolean
  slots: ManagedSlot[]
}
export interface ManagedLot {
  id: string
  code: string
  name: string
  address: string
  latitude: number | null
  longitude: number | null
  is24Hours: boolean
  openTime: string
  closeTime: string
  capacity: number
  imageUrl: string
  description: string
  managerUserId: string
  status: LotState
  closedFrom: string
  closedUntil: string
  closureReason: string
  maintenanceNotice: string
  zones: ManagedZone[]
}
export type LotInput = Omit<ManagedLot, 'id' | 'zones'>
export type ZoneInput = Omit<ManagedZone, 'id' | 'slots'>
export type SlotInput = Omit<ManagedSlot, 'id'>
export const LOT_STATES: Record<LotState, string> = {
  Active: 'Đang hoạt động',
  Inactive: 'Ngừng hoạt động',
  TemporarilyClosed: 'Đóng tạm thời',
  Maintenance: 'Bảo trì',
}
export const SLOT_STATES: Record<SlotState, string> = {
  Available: 'Trống',
  Reserved: 'Giữ chỗ',
  Occupied: 'Đang đỗ',
  Maintenance: 'Bảo trì',
}
export const VEHICLE_TYPES = [
  { id: 'CAR_4', name: 'Ô tô 4–5 chỗ' },
  { id: 'CAR_7', name: 'Ô tô 7 chỗ' },
  { id: 'MOTORBIKE', name: 'Xe máy' },
  { id: 'BICYCLE', name: 'Xe đạp' },
] as const
