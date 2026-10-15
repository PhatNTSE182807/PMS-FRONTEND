/**
 * ParkingService - Parking lot & zone management for the Web Admin (F1.4).
 *
 * MOCK ONLY: the Backend has no parking endpoints yet, so every method resolves
 * after ~500ms with data kept in an in-memory store (reset on page reload).
 * Shapes follow SRS v1.3 (FR-LOT-01, FR-LOT-02, section 7: ParkingLot, Zone).
 *
 * Like userService, all methods resolve to { success, data?, message? } and never throw.
 * When the real API is ready, replace the bodies with axios calls and keep the same shapes.
 */

const MOCK_DELAY_MS = 500;

// Vehicle type a zone is configured for (FR-LOT-02: "cau hinh slot theo loai xe").
export const ZONE_TYPES = ['Car', 'Motorbike', 'Bicycle'];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// ---- In-memory mock store ---------------------------------------------------

/** @type {Array<{id:string,name:string,address:string,capacity:number,openTime:string,closeTime:string,isActive:boolean}>} */
const lotsStore = [
  {
    id: 'lot-001',
    name: 'Lot A - District 1',
    address: '12 Nguyen Hue, Ben Nghe Ward, District 1, Ho Chi Minh City',
    capacity: 250,
    openTime: '06:00',
    closeTime: '22:00',
    isActive: true,
  },
  {
    id: 'lot-002',
    name: 'Lot B - Thu Duc',
    address: '1 Vo Van Ngan, Linh Chieu Ward, Thu Duc City, Ho Chi Minh City',
    capacity: 400,
    openTime: '00:00',
    closeTime: '23:59',
    isActive: true,
  },
  {
    id: 'lot-003',
    name: 'Lot C - Tan Binh (Maintenance)',
    address: '45 Cong Hoa, Ward 4, Tan Binh District, Ho Chi Minh City',
    capacity: 120,
    openTime: '07:00',
    closeTime: '20:00',
    isActive: false,
  },
];

/** @type {Array<{id:string,parkingLotId:string,name:string,type:string}>} */
const zonesStore = [
  { id: 'zone-001', parkingLotId: 'lot-001', name: 'Floor 1 - Row A', type: 'Car' },
  { id: 'zone-002', parkingLotId: 'lot-001', name: 'Floor 1 - Row B', type: 'Car' },
  { id: 'zone-003', parkingLotId: 'lot-001', name: 'Basement - Motorbikes', type: 'Motorbike' },
  { id: 'zone-004', parkingLotId: 'lot-002', name: 'Zone North', type: 'Car' },
  { id: 'zone-005', parkingLotId: 'lot-002', name: 'Zone South', type: 'Motorbike' },
  { id: 'zone-006', parkingLotId: 'lot-002', name: 'Bicycle Corner', type: 'Bicycle' },
  { id: 'zone-007', parkingLotId: 'lot-003', name: 'Ground Floor', type: 'Car' },
];

// ---- Helpers ----------------------------------------------------------------

/** Resolve `produce()` after the mock latency. Errors thrown inside are turned into a failed result. */
const respond = (produce) =>
  new Promise((resolve) => {
    setTimeout(() => {
      try {
        resolve(produce());
      } catch (err) {
        console.warn('parkingService mock error:', err);
        resolve({ success: false, message: 'Unexpected error.' });
      }
    }, MOCK_DELAY_MS);
  });

const fail = (message) => ({ success: false, message });

// ---- Service ----------------------------------------------------------------

export const parkingService = {
  /**
   * Get all parking lots.
   * MOCK of: GET /api/parking-lots
   * @returns {Promise<{success: boolean, data?: Array, message?: string}>}
   */
  getParkingLots() {
    return respond(() => ({ success: true, data: lotsStore.map((lot) => ({ ...lot })) }));
  },

  /**
   * Create a parking lot (FR-LOT-01, Admin).
   * MOCK of: POST /api/parking-lots
   * @param {{ name: string, address: string, capacity: number|string, openTime: string, closeTime: string, isActive?: boolean }} data
   * @returns {Promise<{success: boolean, data?: object, message?: string}>}
   */
  createParkingLot(data) {
    return respond(() => {
      const name = String(data?.name ?? '').trim();
      const address = String(data?.address ?? '').trim();
      const capacity = Number(data?.capacity);
      const openTime = String(data?.openTime ?? '');
      const closeTime = String(data?.closeTime ?? '');

      if (!name) return fail('Parking lot name is required.');
      if (!address) return fail('Address is required.');
      if (!Number.isInteger(capacity) || capacity <= 0) return fail('Capacity must be a positive whole number.');
      if (!TIME_RE.test(openTime) || !TIME_RE.test(closeTime)) return fail('Open/close time must be in HH:mm format.');
      if (openTime === closeTime) return fail('Open time and close time must be different.');
      if (lotsStore.some((lot) => lot.name.toLowerCase() === name.toLowerCase())) {
        return fail(`A parking lot named "${name}" already exists.`);
      }

      const newLot = {
        id: `lot-${crypto.randomUUID().slice(0, 8)}`,
        name,
        address,
        capacity,
        openTime,
        closeTime,
        isActive: data?.isActive ?? true,
      };
      lotsStore.push(newLot);

      return { success: true, data: { ...newLot }, message: `Parking lot "${name}" created (mock).` };
    });
  },

  /**
   * Get the zones of one parking lot.
   * MOCK of: GET /api/parking-lots/{parkingLotId}/zones
   * @param {string} parkingLotId
   * @returns {Promise<{success: boolean, data?: Array<{id:string,parkingLotId:string,name:string,type:string}>, message?: string}>}
   */
  getZones(parkingLotId) {
    return respond(() => {
      if (!lotsStore.some((lot) => lot.id === parkingLotId)) return fail('Parking lot not found.');
      return {
        success: true,
        data: zonesStore.filter((zone) => zone.parkingLotId === parkingLotId).map((zone) => ({ ...zone })),
      };
    });
  },

  /**
   * Create a zone inside a parking lot (FR-LOT-02, Manager/Admin).
   * MOCK of: POST /api/parking-lots/{parkingLotId}/zones
   * @param {{ parkingLotId: string, name: string, type: 'Car'|'Motorbike'|'Bicycle' }} data
   * @returns {Promise<{success: boolean, data?: object, message?: string}>}
   */
  createZone(data) {
    return respond(() => {
      const parkingLotId = data?.parkingLotId;
      const name = String(data?.name ?? '').trim();

      if (!lotsStore.some((lot) => lot.id === parkingLotId)) return fail('Parking lot not found.');
      if (!name) return fail('Zone name is required.');
      if (!ZONE_TYPES.includes(data?.type)) return fail(`Invalid zone type "${data?.type}".`);
      if (
        zonesStore.some(
          (zone) => zone.parkingLotId === parkingLotId && zone.name.toLowerCase() === name.toLowerCase(),
        )
      ) {
        return fail(`A zone named "${name}" already exists in this parking lot.`);
      }

      const newZone = {
        id: `zone-${crypto.randomUUID().slice(0, 8)}`,
        parkingLotId,
        name,
        type: data.type,
      };
      zonesStore.push(newZone);

      return { success: true, data: { ...newZone }, message: `Zone "${name}" created (mock).` };
    });
  },
};
