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
  name: 'Bãi 1',
  address: 'Thủ Đức',
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
  assert.throws(() => validateLot({ ...lot, code: 'l1' }, [lot]), /Mã bãi/))
test('reject shrinking a lot below its zones', () =>
  assert.throws(
    () => validateLot({ ...lot, capacity: 5 }, [lot], lot),
    /tổng sức chứa/,
  ))
test('GPS must be a valid pair', () =>
  assert.throws(
    () => validateLot({ ...lot, latitude: 10 }, [lot], lot),
    /cả vĩ độ/,
  ))
test('zone capacity cannot exceed lot capacity', () =>
  assert.throws(
    () =>
      validateZone({ ...zone, id: undefined, code: 'B', capacity: 30 }, lot),
    /vượt/,
  ))
test('vehicle capacities must equal zone capacity', () =>
  assert.throws(
    () => validateZone({ ...zone, vehicleCapacities: { CAR_4: 2 } }, lot, zone),
    /theo loại xe/,
  ))
test('reservation quota cannot exceed capacity', () =>
  assert.throws(
    () => validateZone({ ...zone, reservationLimit: 11 }, lot, zone),
    /Hạn mức/,
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
    /Hạn mức/,
  ))
test('do not allow manual occupied state from config', () =>
  assert.throws(
    () =>
      validateSlot(
        { code: 'A01', vehicleTypeId: 'CAR_4', status: 'Occupied' },
        zone,
      ),
    /vận hành/,
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
    /không được sửa/,
  ))
test('reject exceeding quota or per-type capacity', () => {
  assert.throws(
    () =>
      validateSlot(
        { code: 'A01', vehicleTypeId: 'CAR_4', status: 'Available' },
        { ...zone, reservationLimit: 0 },
      ),
    /hạn mức/,
  )
  assert.throws(
    () =>
      validateSlot(
        { code: 'A01', vehicleTypeId: 'BICYCLE', status: 'Available' },
        zone,
      ),
    /loại xe/,
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
