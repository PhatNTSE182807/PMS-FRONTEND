import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import ts from 'typescript'
const code = ts.transpileModule(
  readFileSync(new URL('../../src/lib/lot-rules.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext } },
).outputText
const { validateLot, validateZone, validateSlot } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
)
const zone = {
  id: 'z1',
  code: 'A',
  name: 'Khu A',
  zoneType: 'Area',
  floorNo: null,
  capacity: 10,
  vehicleCapacities: { CAR_4: 8, MOTORBIKE: 2 },
  reservationLimit: 3,
  isActive: true,
  slots: [],
}
const lot = {
  id: 'lot1',
  code: 'L1',
  name: 'Lot 1',
  address: 'Thu Duc',
  capacity: 20,
  latitude: null,
  longitude: null,
  is24Hours: true,
  imageUrl: '',
  zones: [zone],
}
test('accept valid lot and zone', () => {
  validateLot(lot, [lot], lot)
  validateZone(zone, lot, zone)
})
test('reject duplicate code case-insensitively', () =>
  assert.throws(() => validateLot({ ...lot, code: 'l1' }, [lot]), /Lot code/))
test('reject shrinking a lot below its zones', () =>
  assert.throws(
    () => validateLot({ ...lot, capacity: 5 }, [lot], lot),
    /total zone capacity/,
  ))
test('GPS must be a valid pair', () =>
  assert.throws(
    () => validateLot({ ...lot, latitude: 10 }, [lot], lot),
    /both latitude/,
  ))
test('zone capacity cannot exceed lot capacity', () =>
  assert.throws(
    () =>
      validateZone({ ...zone, id: undefined, code: 'B', capacity: 30 }, lot),
    /exceeds/,
  ))
test('vehicle capacities must equal zone capacity', () =>
  assert.throws(
    () => validateZone({ ...zone, vehicleCapacities: { CAR_4: 2 } }, lot, zone),
    /per vehicle type/,
  ))
test('reservation quota cannot exceed capacity', () =>
  assert.throws(
    () => validateZone({ ...zone, reservationLimit: 11 }, lot, zone),
    /Reservation limit/,
  ))
test('quota cannot shrink below configured slots', () =>
  assert.throws(
    () =>
      validateZone(
        { ...zone, reservationLimit: 0 },
        {
          ...lot,
          zones: [
            {
              ...zone,
              slots: [
                {
                  id: 's',
                  code: 'A01',
                  vehicleTypeId: 'CAR_4',
                  status: 'Available',
                },
              ],
            },
          ],
        },
        {
          ...zone,
          slots: [
            {
              id: 's',
              code: 'A01',
              vehicleTypeId: 'CAR_4',
              status: 'Available',
            },
          ],
        },
      ),
    /Reservation limit/,
  ))
test('do not allow manual occupied state from config', () =>
  assert.throws(
    () =>
      validateSlot(
        { code: 'A01', vehicleTypeId: 'CAR_4', status: 'Occupied' },
        zone,
      ),
    /operations/,
  ))
test('protect reserved slot from editing', () =>
  assert.throws(
    () =>
      validateSlot(
        { code: 'A01', vehicleTypeId: 'CAR_4', status: 'Available' },
        {
          ...zone,
          slots: [
            {
              id: 's',
              code: 'A01',
              vehicleTypeId: 'CAR_4',
              status: 'Reserved',
            },
          ],
        },
        's',
      ),
    /cannot be edited/,
  ))
test('reject exceeding quota or per-type capacity', () => {
  assert.throws(
    () =>
      validateSlot(
        { code: 'A01', vehicleTypeId: 'CAR_4', status: 'Available' },
        { ...zone, reservationLimit: 0 },
      ),
    /reservation limit/,
  )
  assert.throws(
    () =>
      validateSlot(
        { code: 'A01', vehicleTypeId: 'BICYCLE', status: 'Available' },
        zone,
      ),
    /vehicle type/,
  )
})
test('allow Available to Maintenance on an unused slot', () =>
  validateSlot(
    { code: 'A01', vehicleTypeId: 'CAR_4', status: 'Maintenance' },
    {
      ...zone,
      slots: [
        { id: 's', code: 'A01', vehicleTypeId: 'CAR_4', status: 'Available' },
      ],
    },
    's',
  ))
