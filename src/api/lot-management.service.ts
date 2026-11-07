import { findTemplate, templateForLot } from '@/components/customer/garage/garageModel'
import { isMockService } from '@/config/env'
import { session } from '@/lib/session'
import { protectedSlot, validateLot, zonesFromTemplate } from '@/lib/lot-rules'
import { MOCK_PARKING_LOTS } from '@/mocks/parkingLots.mock'
import type { LotInput, ManagedLot } from '@/types/lot-management.dto'
import { identityService } from './identity.service'
import { lotManagementApi } from './lot-management.live'

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
    // Lots saved before ready-made models existed get the model the customer map shows, and its zones
    memory = (parsed as ManagedLot[]).map((l) => withModel({ ...l, layoutTemplate: l.layoutTemplate ?? templateForLot(l).id }))
    return structuredClone(memory)
  }
  memory = MOCK_PARKING_LOTS.map((l) =>
    withModel({
      id: l.id,
      code: l.code,
      name: l.name,
      address: l.address,
      city: 'Ho Chi Minh City',
      district: '',
      phone: '',
      latitude: null,
      longitude: null,
      is24Hours: true,
      openTime: '',
      closeTime: '',
      capacity: 0,
      layoutTemplate: templateForLot(l).id,
      imageUrl: '',
      description: '',
      managerUserId: l.id === 'lot-01' ? 'usr-0001' : '',
      status: 'Active',
      closedFrom: '',
      closedUntil: '',
      closureReason: '',
      maintenanceNotice: '',
      zones: [],
    }),
  )
  return structuredClone(memory)
}
/** Builds the zones and bays of a demo lot from its model, as the backend does when a lot is registered. */
function withModel(lot: ManagedLot): ManagedLot {
  const template = findTemplate(lot.layoutTemplate)
  if (lot.zones.length || !template) return lot
  const zones = zonesFromTemplate(template, newId)
  return { ...lot, zones, capacity: zones.reduce((n, z) => n + z.capacity, 0) }
}
function save(lots: ManagedLot[]) {
  localStorage.setItem(KEY, JSON.stringify(lots))
  memory = structuredClone(lots)
}
/** Demo sessions and VITE_MOCK_SERVICES=parking keep the data in this browser; otherwise the REST API. */
const isDemo = () => isMockService('parking')
/** The same rules run before both: the backend repeats them, the client just answers sooner. */
const load = (): Promise<ManagedLot[]> => (isDemo() ? Promise.resolve(read()) : lotManagementApi.list())
function actor() {
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
  if (user.role === 'ADMIN') return
  if (user.role !== 'MANAGER' || user.userId !== lot.managerUserId)
    throw new Error(
      'Only an Admin or the Manager assigned to this lot can change its operating status.',
    )
}
export const lotManagementService = {
  /** Whether changes stay in this browser (shown to the user after saving). */
  isDemo,
  async list() {
    const user = actor()
    return (await load()).filter(
      (l) => user.role === 'ADMIN' || l.managerUserId === user.userId,
    )
  },
  async managers() {
    requireAdmin()
    return (
      await identityService.getStaff({
        role: 'MANAGER',
        status: 'ACTIVE',
        pageNumber: 1,
        pageSize: 1000,
      })
    ).items
  },
  async saveLot(input: LotInput, id?: string) {
    requireAdmin()
    const lots = await load()
    const current = id ? getLot(lots, id) : undefined
    validateLot(input, lots, current)
    if (
      input.managerUserId &&
      !(await this.managers()).some((m) => m.id === input.managerUserId)
    )
      throw new Error('The Manager does not exist or is inactive.')
    if (!isDemo()) {
      const savedId = await lotManagementApi.saveLot(input, id, Boolean(current?.zones.length))
      const saved = (await lotManagementApi.list()).find((l) => l.id === savedId)
      if (!saved) throw new Error('The parking lot was saved but could not be reloaded.')
      return saved
    }
    // Status is not an editable admin field; it is managed through the separate operational command.
    // Zones, slots and capacity come from the ready-made model, like on the backend.
    const zones = current?.zones.length ? current.zones : zonesFromTemplate(findTemplate(input.layoutTemplate)!, newId)
    const next: ManagedLot = {
      ...input,
      code: input.code.trim(),
      name: input.name.trim(),
      address: input.address.trim(),
      id: id ?? newId(),
      zones,
      capacity: zones.reduce((n, z) => n + z.capacity, 0),
      status: current?.status ?? 'Active',
    }
    if (current) lots[lots.findIndex((l) => l.id === id)] = next
    else lots.push(next)
    save(lots)
    return next
  },
  async deleteLot(id: string) {
    requireAdmin()
    const lots = await load()
    const lot = getLot(lots, id)
    // Same rule as the API: the lot is closed first and every vehicle has left.
    if (lot.status !== 'Closed')
      throw new Error('Set the lot to Closed before deleting it.')
    if (lot.zones.some((z) => z.slots.some((s) => s.status === 'Occupied')))
      throw new Error('Cannot delete the parking lot while vehicles are still inside.')
    if (!isDemo()) {
      await lotManagementApi.deleteLot(id)
      return
    }
    save(lots.filter((l) => l.id !== id))
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
    const lots = await load()
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
    if (!isDemo()) {
      await lotManagementApi.setOperation(lotId, patch)
      return
    }
    Object.assign(lot, patch)
    save(lots)
  },
}
