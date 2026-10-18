import { findTemplate } from '@/components/customer/garage/garageModel'
import type {
  LotInput,
  ManagedLot,
  ManagedZone,
  SlotInput,
  ZoneInput,
} from '@/types/lot-management.dto'
const check = (ok: boolean, message: string) => {
  if (!ok) throw new Error(message)
}
const integer = (n: number) => Number.isSafeInteger(n) && n >= 0
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
  check(
    integer(input.capacity) && input.capacity > 0,
    'Capacity must be a positive integer.',
  )
  check(
    input.capacity >= (current?.zones.reduce((n, z) => n + z.capacity, 0) ?? 0),
    'Lot capacity cannot be less than the total zone capacity.',
  )
  check(
    !input.layoutTemplate || Boolean(findTemplate(input.layoutTemplate)),
    'Unknown 3D building layout.',
  )
  check(
    input.latitude === null ||
      (Number.isFinite(input.latitude) && Math.abs(input.latitude) <= 90),
    'Latitude must be between -90 and 90.',
  )
  check(
    input.longitude === null ||
      (Number.isFinite(input.longitude) && Math.abs(input.longitude) <= 180),
    'Longitude must be between -180 and 180.',
  )
  check(
    (input.latitude === null) === (input.longitude === null),
    'Enter both latitude and longitude, or leave both empty.',
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
export function validateZone(
  input: ZoneInput,
  lot: ManagedLot,
  current?: ManagedZone,
) {
  check(
    input.code.trim().length > 0 &&
      input.code.length <= 30 &&
      input.name.trim().length > 0 &&
      input.name.length <= 200,
    'Enter a zone code (≤30) and zone name (≤200).',
  )
  check(
    !lot.zones.some(
      (z) =>
        z.id !== current?.id &&
        z.code.toLowerCase() === input.code.trim().toLowerCase(),
    ),
    'Zone code already exists in this lot.',
  )
  check(
    integer(input.capacity) && input.capacity > 0,
    'Zone capacity must be a positive integer.',
  )
  check(
    input.capacity +
      lot.zones
        .filter((z) => z.id !== current?.id)
        .reduce((n, z) => n + z.capacity, 0) <=
      lot.capacity,
    'Total zone capacity exceeds the lot capacity.',
  )
  check(
    Object.values(input.vehicleCapacities).every(integer) &&
      Object.values(input.vehicleCapacities).reduce((a, b) => a + b, 0) ===
        input.capacity,
    'Capacity per vehicle type must add up to the zone capacity.',
  )
  check(
    (current?.slots ?? []).every(
      (s) =>
        (current?.slots.filter((x) => x.vehicleTypeId === s.vehicleTypeId)
          .length ?? 0) <= (input.vehicleCapacities[s.vehicleTypeId] ?? 0),
    ),
    'Vehicle type capacity cannot be less than the slots already created.',
  )
  check(
    integer(input.reservationLimit) && input.reservationLimit <= input.capacity,
    'Reservation limit must be between 0 and the zone capacity.',
  )
  check(
    (current?.slots.length ?? 0) <= input.reservationLimit,
    'Reservation limit cannot be less than the reservable slots already configured.',
  )
  check(
    input.zoneType !== 'Floor' ||
      (input.floorNo !== null && Number.isSafeInteger(input.floorNo)),
    'Floor zones need an integer floor number (negative for basements).',
  )
  check(
    input.isActive || !current || !protectedSlot(current),
    'Cannot deactivate a zone with reserved or occupied slots.',
  )
}
export function validateSlot(
  input: SlotInput,
  zone: ManagedZone,
  currentId?: string,
) {
  check(
    input.code.trim().length > 0 && input.code.length <= 30,
    'Slot code is required (max 30 characters).',
  )
  check(
    !zone.slots.some(
      (s) =>
        s.id !== currentId &&
        s.code.toLowerCase() === input.code.trim().toLowerCase(),
    ),
    'Slot code already exists in this zone.',
  )
  check(
    Boolean(currentId) || zone.slots.length < zone.reservationLimit,
    'The reservation limit for slots in this zone has been reached.',
  )
  const sameTypeCount = zone.slots.filter(
    (s) => s.id !== currentId && s.vehicleTypeId === input.vehicleTypeId,
  ).length
  check(
    sameTypeCount < (zone.vehicleCapacities[input.vehicleTypeId] ?? 0),
    'The capacity for this vehicle type in the zone has been reached.',
  )
  const current = zone.slots.find((s) => s.id === currentId)
  check(
    !current || !['Reserved', 'Occupied'].includes(current.status),
    'Reserved or occupied slots cannot be edited from the configuration screen.',
  )
  check(
    ['Available', 'Maintenance'].includes(input.status),
    'The configuration screen only switches Available ↔ Maintenance; Reserved/Occupied come from operations.',
  )
}
