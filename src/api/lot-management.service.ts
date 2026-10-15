import { isMockService } from '@/config/env'
import { session } from '@/lib/session'
import {
  validateLot,
  validateSlot,
  validateZone,
  protectedSlot,
} from '@/lib/lot-rules'
import { MOCK_PARKING_LOTS } from '@/mocks/parkingLots.mock'
import { staffMock } from '@/mocks/users.mock'
import type {
  LotInput,
  ManagedLot,
  SlotInput,
  ZoneInput,
} from '@/types/lot-management.dto'
import { VEHICLE_TYPES } from '@/types/lot-management.dto'

const KEY = 'pms_lot_management_demo_v1'
const newId = () => crypto.randomUUID()
let memory: ManagedLot[] | undefined
function read(): ManagedLot[] {
  if (memory) return structuredClone(memory)
  const raw = localStorage.getItem(KEY)
  if (raw) {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed))
      throw new Error(
        'Dữ liệu demo không hợp lệ. Không tự ghi đè dữ liệu đã lưu.',
      )
    memory = parsed as ManagedLot[]
    return structuredClone(memory)
  }
  memory = MOCK_PARKING_LOTS.map((l) => ({
    id: l.id,
    code: l.code,
    name: l.name,
    address: l.address,
    latitude: null,
    longitude: null,
    is24Hours: true,
    openTime: '',
    closeTime: '',
    capacity: l.carSlots + l.motorbikeSlots,
    imageUrl: '',
    description: '',
    managerUserId: l.id === 'lot-01' ? 'usr-0001' : '',
    status: 'Active',
    closedFrom: '',
    closedUntil: '',
    closureReason: '',
    maintenanceNotice: '',
    zones: [],
  }))
  return structuredClone(memory)
}
function save(lots: ManagedLot[]) {
  localStorage.setItem(KEY, JSON.stringify(lots))
  memory = structuredClone(lots)
}
function actor() {
  // No guessed live endpoints: this FE deliverable intentionally runs on demo data only.
  if (!isMockService('parking'))
    throw new Error(
      'API quản lý bãi chưa được tích hợp. Bật mock parking để dùng bản FE demo.',
    )
  const user = session.getUser()
  if (!user || !['ADMIN', 'MANAGER'].includes(user.role))
    throw new Error('Bạn không có quyền quản lý bãi.')
  return user
}
function getLot(lots: ManagedLot[], id: string) {
  const user = actor()
  const lot = lots.find((l) => l.id === id)
  if (!lot || (user.role === 'MANAGER' && lot.managerUserId !== user.userId))
    throw new Error('Không tìm thấy bãi trong phạm vi được giao.')
  return lot
}
function requireAdmin() {
  if (actor().role !== 'ADMIN')
    throw new Error('Chỉ Admin được thay đổi thông tin bãi và gán Manager.')
}
function requireManager(lot: ManagedLot) {
  const user = actor()
  if (user.role !== 'MANAGER' || user.userId !== lot.managerUserId)
    throw new Error(
      'Chỉ Manager được giao bãi có quyền cấu hình zone/slot và trạng thái vận hành.',
    )
}
export const lotManagementService = {
  async list() {
    const user = actor()
    return read().filter(
      (l) => user.role === 'ADMIN' || l.managerUserId === user.userId,
    )
  },
  async managers() {
    requireAdmin()
    return (
      await staffMock.list({
        role: 'MANAGER',
        status: 'ACTIVE',
        pageNumber: 1,
        pageSize: 1000,
      })
    ).items
  },
  async saveLot(input: LotInput, id?: string) {
    requireAdmin()
    const lots = read()
    const current = id ? getLot(lots, id) : undefined
    validateLot(input, lots, current)
    if (
      input.managerUserId &&
      !(await this.managers()).some((m) => m.id === input.managerUserId)
    )
      throw new Error('Manager không tồn tại hoặc không hoạt động.')
    // Status is not an editable admin field; it is managed through the separate operational command.
    const next: ManagedLot = {
      ...input,
      code: input.code.trim(),
      name: input.name.trim(),
      address: input.address.trim(),
      id: id ?? newId(),
      zones: current?.zones ?? [],
      status: current?.status ?? 'Inactive',
    }
    if (current) lots[lots.findIndex((l) => l.id === id)] = next
    else lots.push(next)
    save(lots)
    return next
  },
  async deleteLot(id: string) {
    requireAdmin()
    const lots = read()
    const lot = getLot(lots, id)
    if (lot.status === 'Active' || lot.zones.length)
      throw new Error(
        'Chỉ xóa bãi ngừng hoạt động và chưa có zone. Bãi đã vận hành cần lưu lịch sử ở BE.',
      )
    save(lots.filter((l) => l.id !== id))
  },
  async saveZone(lotId: string, input: ZoneInput, id?: string) {
    const lots = read()
    const lot = getLot(lots, lotId)
    requireManager(lot)
    const current = id ? lot.zones.find((z) => z.id === id) : undefined
    if (id && !current) throw new Error('Zone không còn tồn tại.')
    validateZone(input, lot, current)
    const next = {
      ...input,
      code: input.code.trim(),
      name: input.name.trim(),
      id: id ?? newId(),
      slots: current?.slots ?? [],
    }
    if (current) lot.zones[lot.zones.findIndex((z) => z.id === id)] = next
    else lot.zones.push(next)
    save(lots)
  },
  async deleteZone(lotId: string, id: string) {
    const lots = read()
    const lot = getLot(lots, lotId)
    requireManager(lot)
    const zone = lot.zones.find((z) => z.id === id)
    if (!zone || zone.slots.length)
      throw new Error('Chỉ xóa zone chưa có slot; không xóa dữ liệu vận hành.')
    lot.zones = lot.zones.filter((z) => z.id !== id)
    save(lots)
  },
  async saveSlot(lotId: string, zoneId: string, input: SlotInput, id?: string) {
    const lots = read()
    const lot = getLot(lots, lotId)
    requireManager(lot)
    const zone = lot.zones.find((z) => z.id === zoneId)
    if (!zone) throw new Error('Không tìm thấy zone.')
    if (!zone.isActive) throw new Error('Cần bật zone trước khi cấu hình slot.')
    if (id && !zone.slots.some((s) => s.id === id))
      throw new Error('Slot không còn tồn tại.')
    if (!VEHICLE_TYPES.some((t) => t.id === input.vehicleTypeId))
      throw new Error('Loại xe không hợp lệ.')
    validateSlot(input, zone, id)
    const next = { ...input, code: input.code.trim(), id: id ?? newId() }
    if (id) zone.slots[zone.slots.findIndex((s) => s.id === id)] = next
    else zone.slots.push(next)
    save(lots)
  },
  async deleteSlot(lotId: string, zoneId: string, id: string) {
    const lots = read()
    const lot = getLot(lots, lotId)
    requireManager(lot)
    const zone = lot.zones.find((z) => z.id === zoneId)
    const slot = zone?.slots.find((s) => s.id === id)
    if (!zone || !slot || ['Reserved', 'Occupied'].includes(slot.status))
      throw new Error('Không thể xóa slot đang giữ/đang đỗ hoặc không tồn tại.')
    zone.slots = zone.slots.filter((s) => s.id !== id)
    save(lots)
  },
  async setOperation(
    lotId: string,
    patch: Pick<
      ManagedLot,
      | 'status'
      | 'closedFrom'
      | 'closedUntil'
      | 'closureReason'
      | 'maintenanceNotice'
    >,
  ) {
    const lots = read()
    const lot = getLot(lots, lotId)
    requireManager(lot)
    if (patch.status !== 'Active' && lot.zones.some(protectedSlot))
      throw new Error(
        'Không đóng bãi khi còn slot đang giữ/đang đỗ. BE cần kiểm tra cả session vãng lai.',
      )
    if (
      ['TemporarilyClosed', 'Maintenance'].includes(patch.status) &&
      !patch.closureReason.trim()
    )
      throw new Error('Nhập lý do đóng/bảo trì.')
    if (
      patch.status === 'TemporarilyClosed' &&
      (!patch.closedFrom ||
        !patch.closedUntil ||
        new Date(patch.closedUntil) <= new Date(patch.closedFrom))
    )
      throw new Error('Nhập thời gian đóng và mở lại hợp lệ.')
    Object.assign(lot, patch)
    save(lots)
  },
}
