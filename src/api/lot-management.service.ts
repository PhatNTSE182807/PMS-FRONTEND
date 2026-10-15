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
        'Demo data is invalid. Saved data was not overwritten.',
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
      'The parking lot management API is not integrated yet. Enable the parking mock to use the frontend demo.',
    )
  const user = session.getUser()
  if (!user || !['ADMIN', 'MANAGER'].includes(user.role))
    throw new Error('You do not have permission to manage parking lots.')
  return user
}
function getLot(lots: ManagedLot[], id: string) {
  const user = actor()
  const lot = lots.find((l) => l.id === id)
  if (!lot || (user.role === 'MANAGER' && lot.managerUserId !== user.userId))
    throw new Error('Parking lot not found in your assigned scope.')
  return lot
}
function requireAdmin() {
  if (actor().role !== 'ADMIN')
    throw new Error('Only an Admin can change parking lot details and assign a Manager.')
}
function requireManager(lot: ManagedLot) {
  const user = actor()
  if (user.role !== 'MANAGER' || user.userId !== lot.managerUserId)
    throw new Error(
      'Only the Manager assigned to this lot can configure its zones, slots and operating status.',
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
      throw new Error('The Manager does not exist or is inactive.')
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
        'Only inactive lots without zones can be deleted. Lots that have operated must keep their history in the backend.',
      )
    save(lots.filter((l) => l.id !== id))
  },
  async saveZone(lotId: string, input: ZoneInput, id?: string) {
    const lots = read()
    const lot = getLot(lots, lotId)
    requireManager(lot)
    const current = id ? lot.zones.find((z) => z.id === id) : undefined
    if (id && !current) throw new Error('The zone no longer exists.')
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
      throw new Error('Only zones without slots can be deleted; operational data is never removed.')
    lot.zones = lot.zones.filter((z) => z.id !== id)
    save(lots)
  },
  async saveSlot(lotId: string, zoneId: string, input: SlotInput, id?: string) {
    const lots = read()
    const lot = getLot(lots, lotId)
    requireManager(lot)
    const zone = lot.zones.find((z) => z.id === zoneId)
    if (!zone) throw new Error('Zone not found.')
    if (!zone.isActive) throw new Error('Activate the zone before configuring slots.')
    if (id && !zone.slots.some((s) => s.id === id))
      throw new Error('The slot no longer exists.')
    if (!VEHICLE_TYPES.some((t) => t.id === input.vehicleTypeId))
      throw new Error('Invalid vehicle type.')
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
      throw new Error('Cannot delete a slot that is reserved, occupied or no longer exists.')
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
        'Cannot close a lot while slots are reserved or occupied. The backend must also check walk-in sessions.',
      )
    if (
      ['TemporarilyClosed', 'Maintenance'].includes(patch.status) &&
      !patch.closureReason.trim()
    )
      throw new Error('Enter the closure or maintenance reason.')
    if (
      patch.status === 'TemporarilyClosed' &&
      (!patch.closedFrom ||
        !patch.closedUntil ||
        new Date(patch.closedUntil) <= new Date(patch.closedFrom))
    )
      throw new Error('Enter a valid closing and reopening time.')
    Object.assign(lot, patch)
    save(lots)
  },
}
