import { findTemplate, type GarageTemplate } from '@/components/customer/garage/garageModel'
import type { LotInput, ManagedLot, ManagedZone } from '@/types/lot-management.dto'
const check = (ok: boolean, message: string) => {
  if (!ok) throw new Error(message)
}
export const protectedSlot = (zone: ManagedZone) =>
  zone.slots.some((s) => s.status === 'Occupied' || s.status === 'Reserved')
export function validateLot(
  input: LotInput,
  lots: ManagedLot[],
  current?: ManagedLot,
) {
  check(
    input.code.trim().length > 0 && input.code.length <= 30,
    'Lot code is required (max 30 characters).',
  )
  check(
    input.name.trim().length > 0 && input.name.length <= 200,
    'Lot name is required (max 200 characters).',
  )
  check(
    input.address.trim().length > 0 && input.address.length <= 500,
    'Address is required (max 500 characters).',
  )
  check(
    !lots.some(
      (l) =>
        l.id !== current?.id &&
        l.code.toLowerCase() === input.code.trim().toLowerCase(),
    ),
    'Lot code already exists.',
  )
  // Lots are only built from a ready-made model: zones, slots and capacity come from it
  check(Boolean(findTemplate(input.layoutTemplate)), 'Choose one of the ready-made parking lot models.')
  check(
    !current?.zones.length || input.layoutTemplate === current.layoutTemplate,
    'The model of a lot that already has zones cannot be changed.',
  )
  check(
    input.is24Hours ||
      (/^\d{2}:\d{2}$/.test(input.openTime) &&
        /^\d{2}:\d{2}$/.test(input.closeTime) &&
        input.openTime !== input.closeTime),
    'Opening and closing times must differ, or choose 24-hour operation.',
  )
  if (input.imageUrl) {
    try {
      const u = new URL(input.imageUrl)
      check(
        ['http:', 'https:'].includes(u.protocol),
        'The image must be an HTTP/HTTPS URL.',
      )
    } catch {
      throw new Error('The image must be a valid HTTP/HTTPS URL.')
    }
  }
}

/**
 * Zones and slots of a ready-made model, as the backend builds them (PMS.Application LotTemplates):
 * one zone per level ("L1", "L2"…), slots "L1-01"…, motorbikes on the ground level.
 */
export function zonesFromTemplate(template: GarageTemplate, newId: () => string): ManagedZone[] {
  return template.floors.map((kind, floorNo) => {
    const code = `L${floorNo + 1}`
    const vehicleTypeId = kind === 'motorbike' ? 'MOTORBIKE' : 'CAR_4'
    return {
      id: newId(),
      code,
      name: `Level ${floorNo + 1} · ${kind === 'motorbike' ? 'Motorbikes' : 'Cars'}`,
      zoneType: 'Floor',
      floorNo,
      capacity: template.slotsPerFloor,
      vehicleCapacities: { [vehicleTypeId]: template.slotsPerFloor },
      reservationLimit: template.slotsPerFloor,
      isActive: true,
      slots: Array.from({ length: template.slotsPerFloor }, (_, i) => ({
        id: newId(),
        code: `${code}-${String(i + 1).padStart(2, '0')}`,
        vehicleTypeId,
        status: 'Available' as const,
      })),
    }
  })
}
