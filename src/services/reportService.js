/**
 * ReportService - Dashboard & revenue reports for the Web Admin (F1.12).
 * Covers FR-RPT-01 (multi-lot dashboard: vehicles, revenue, occupancy) and
 * FR-RPT-02 (revenue by day/week/month, filterable by lot, vehicle type, payment method).
 *
 * MOCK ONLY: the Backend has no report endpoints yet, so every method resolves after ~500ms
 * with data aggregated from a deterministic in-memory sample (same filters => same numbers).
 *
 * Filters (all optional, merged with DEFAULT_FILTERS):
 *   { rangeDays: 7|30|90, groupBy: 'day'|'week'|'month', lotId: 'all'|<lotId>,
 *     vehicleType: 'all'|<type>, paymentMethod: 'all'|<method> }
 *
 * All methods resolve to { success, data?, message? } and never throw, like userService / parkingService.
 * Note: Manager scope (only their own lots, FR-AUTH-07) must be enforced by the real Backend.
 */

const MOCK_DELAY_MS = 500;

// ---- Filter option lists (also used by the UI to render the filter bar) -------------------------

// Lot ids/names/capacity match the mock data of parkingService.
const LOT_SAMPLE = [
  { id: 'lot-001', name: 'Lot A - District 1', capacity: 250, isActive: true, dailyVehicles: 120, occupancyRate: 78.4 },
  { id: 'lot-002', name: 'Lot B - Thu Duc', capacity: 400, isActive: true, dailyVehicles: 200, occupancyRate: 64.2 },
  { id: 'lot-003', name: 'Lot C - Tan Binh (Maintenance)', capacity: 120, isActive: false, dailyVehicles: 35, occupancyRate: 0 },
];

export const REPORT_LOTS = LOT_SAMPLE.map(({ id, name }) => ({ id, name }));
export const VEHICLE_TYPES = ['Car', 'Motorbike', 'Bicycle'];
export const PAYMENT_METHODS = ['Cash', 'VNPay', 'MoMo', 'VietQR'];
export const RANGE_OPTIONS = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
];
export const GROUP_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];
export const DEFAULT_FILTERS = {
  rangeDays: 7,
  groupBy: 'day',
  lotId: 'all',
  vehicleType: 'all',
  paymentMethod: 'all',
};

// ---- Deterministic sample model ------------------------------------------------------------------

const VEHICLE_SHARE = { Car: 0.3, Motorbike: 0.62, Bicycle: 0.08 };
const AVG_FEE_VND = { Car: 25000, Motorbike: 8000, Bicycle: 3000 };
const PAYMENT_SHARE = { Cash: 0.45, VNPay: 0.25, MoMo: 0.15, VietQR: 0.15 };
// Sunday..Saturday: busier towards the weekend.
const WEEKDAY_FACTOR = [0.9, 0.85, 0.9, 0.95, 1.0, 1.2, 1.3];

/** Stable pseudo-random number in [0, 1) derived from a string key. */
const rand = (key) => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h += 0x6d2b79f5;
  h = Math.imul(h ^ (h >>> 15), h | 1);
  h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
  return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
};

const pad = (n) => String(n).padStart(2, '0');
// Local date key (not toISOString, which would shift the day in UTC+7).
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

/**
 * Facts (one row per day x lot x vehicle type x payment method) for day offsets
 * fromOffset..toOffset (0 = today, 1 = yesterday...), oldest first.
 */
const generateFacts = (fromOffset, toOffset) => {
  const today = startOfToday();
  const facts = [];
  for (let offset = toOffset; offset >= fromOffset; offset -= 1) {
    const date = addDays(today, -offset);
    const key = dateKey(date);
    const dayFactor = WEEKDAY_FACTOR[date.getDay()];
    LOT_SAMPLE.forEach((lot) => {
      VEHICLE_TYPES.forEach((vehicleType) => {
        PAYMENT_METHODS.forEach((paymentMethod) => {
          const seed = `${key}|${lot.id}|${vehicleType}|${paymentMethod}`;
          const vehicles = Math.round(
            lot.dailyVehicles * VEHICLE_SHARE[vehicleType] * PAYMENT_SHARE[paymentMethod] * dayFactor * (0.8 + 0.4 * rand(seed)),
          );
          const revenue = Math.round((vehicles * AVG_FEE_VND[vehicleType] * (0.9 + 0.2 * rand(`${seed}|fee`))) / 1000) * 1000;
          facts.push({ date, dateKey: key, lotId: lot.id, vehicleType, paymentMethod, vehicles, revenue });
        });
      });
    });
  }
  return facts;
};

const normalizeFilters = (input) => {
  const f = { ...DEFAULT_FILTERS, ...input };
  f.rangeDays = Number(f.rangeDays);
  if (!RANGE_OPTIONS.some((o) => o.value === f.rangeDays)) f.rangeDays = DEFAULT_FILTERS.rangeDays;
  if (!GROUP_OPTIONS.some((o) => o.value === f.groupBy)) f.groupBy = DEFAULT_FILTERS.groupBy;
  return f;
};

/** Returns an error message when a filter value is unknown, otherwise ''. */
const checkFilters = (f) => {
  if (f.lotId !== 'all' && !LOT_SAMPLE.some((l) => l.id === f.lotId)) return 'Parking lot not found.';
  if (f.vehicleType !== 'all' && !VEHICLE_TYPES.includes(f.vehicleType)) return `Invalid vehicle type "${f.vehicleType}".`;
  if (f.paymentMethod !== 'all' && !PAYMENT_METHODS.includes(f.paymentMethod)) return `Invalid payment method "${f.paymentMethod}".`;
  return '';
};

const matches = (fact, f) =>
  (f.lotId === 'all' || fact.lotId === f.lotId) &&
  (f.vehicleType === 'all' || fact.vehicleType === f.vehicleType) &&
  (f.paymentMethod === 'all' || fact.paymentMethod === f.paymentMethod);

const currentPeriod = (f) => generateFacts(0, f.rangeDays - 1).filter((fact) => matches(fact, f));
const previousPeriod = (f) => generateFacts(f.rangeDays, f.rangeDays * 2 - 1).filter((fact) => matches(fact, f));

const sum = (facts, field) => facts.reduce((total, fact) => total + fact[field], 0);

const changePct = (current, previous) => (previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10);

/** Bucket (day / week starting Monday / month) a date falls into. */
const bucketOf = (date, groupBy, rangeDays) => {
  if (groupBy === 'month') {
    return { key: `${date.getFullYear()}-${pad(date.getMonth() + 1)}`, label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) };
  }
  if (groupBy === 'week') {
    const start = addDays(date, -((date.getDay() + 6) % 7));
    return { key: dateKey(start), label: `${pad(start.getDate())}/${pad(start.getMonth() + 1)}` };
  }
  return {
    key: dateKey(date),
    // Weekday names read well for 7 bars; dd/MM for longer ranges.
    label: rangeDays <= 7 ? date.toLocaleDateString('en-US', { weekday: 'short' }) : `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`,
  };
};

/** Sum facts into [{ key, label, revenue, vehicles }] keeping chronological order (facts are oldest first). */
const groupByBucket = (facts, groupBy, rangeDays) => {
  const buckets = new Map();
  facts.forEach((fact) => {
    const { key, label } = bucketOf(fact.date, groupBy, rangeDays);
    if (!buckets.has(key)) buckets.set(key, { key, label, revenue: 0, vehicles: 0 });
    const bucket = buckets.get(key);
    bucket.revenue += fact.revenue;
    bucket.vehicles += fact.vehicles;
  });
  return [...buckets.values()];
};

const withShare = (rows, totalRevenue) =>
  rows
    .map((row) => ({ ...row, sharePct: totalRevenue === 0 ? 0 : Math.round((row.revenue / totalRevenue) * 1000) / 10 }))
    .sort((a, b) => b.revenue - a.revenue);

const respond = (produce) =>
  new Promise((resolve) => {
    setTimeout(() => {
      try {
        resolve(produce());
      } catch (err) {
        console.warn('reportService mock error:', err);
        resolve({ success: false, message: 'Unexpected error.' });
      }
    }, MOCK_DELAY_MS);
  });

// ---- Service -------------------------------------------------------------------------------------

export const reportService = {
  /**
   * KPI overview for the selected period (FR-RPT-01).
   * MOCK of: GET /api/reports/overview?rangeDays=&lotId=&vehicleType=&paymentMethod=
   * - totalVehicles / totalRevenue (VND): sums over the period with the filters applied
   * - occupancyRate (0-100): current snapshot, capacity-weighted over open lots in scope
   * - vehiclesChangePct / revenueChangePct: vs. the previous period of the same length (null if no baseline)
   * @param {Partial<typeof DEFAULT_FILTERS>} [filters]
   * @returns {Promise<{success: boolean, data?: {totalVehicles: number, totalRevenue: number, occupancyRate: number, vehiclesChangePct: number|null, revenueChangePct: number|null}, message?: string}>}
   */
  getDashboardOverview(filters) {
    return respond(() => {
      const f = normalizeFilters(filters);
      const error = checkFilters(f);
      if (error) return { success: false, message: error };

      const current = currentPeriod(f);
      const previous = previousPeriod(f);
      const totalVehicles = sum(current, 'vehicles');
      const totalRevenue = sum(current, 'revenue');

      const openLots = LOT_SAMPLE.filter((lot) => lot.isActive && (f.lotId === 'all' || lot.id === f.lotId));
      const capacity = openLots.reduce((total, lot) => total + lot.capacity, 0);
      const occupied = openLots.reduce((total, lot) => total + lot.capacity * lot.occupancyRate, 0);

      return {
        success: true,
        data: {
          totalVehicles,
          totalRevenue,
          occupancyRate: capacity === 0 ? 0 : Math.round((occupied / capacity) * 10) / 10,
          vehiclesChangePct: changePct(totalVehicles, sum(previous, 'vehicles')),
          revenueChangePct: changePct(totalRevenue, sum(previous, 'revenue')),
        },
      };
    });
  },

  /**
   * Revenue series for the chart, grouped by day / week / month (FR-RPT-02).
   * MOCK of: GET /api/reports/revenue?rangeDays=&groupBy=&lotId=&vehicleType=&paymentMethod=
   * @param {Partial<typeof DEFAULT_FILTERS>} [filters]
   * @returns {Promise<{success: boolean, data?: Array<{date: string, fullDate: string, revenue: number, vehicles: number}>, message?: string}>}
   */
  getRevenueChartData(filters) {
    return respond(() => {
      const f = normalizeFilters(filters);
      const error = checkFilters(f);
      if (error) return { success: false, message: error };

      const data = groupByBucket(currentPeriod(f), f.groupBy, f.rangeDays).map((b) => ({
        date: b.label,
        fullDate: f.groupBy === 'week' ? `Week of ${b.key}` : b.key,
        revenue: b.revenue,
        vehicles: b.vehicles,
      }));
      return { success: true, data };
    });
  },

  /**
   * Revenue split by parking lot (with current occupancy), vehicle type and payment method (FR-RPT-01/02).
   * MOCK of: GET /api/reports/breakdown?rangeDays=&lotId=&vehicleType=&paymentMethod=
   * Rows are sorted by revenue (desc) and carry `sharePct` of the filtered total.
   * @param {Partial<typeof DEFAULT_FILTERS>} [filters]
   * @returns {Promise<{success: boolean, data?: {
   *   byLot: Array<{id: string, name: string, isActive: boolean, capacity: number, occupancyRate: number, vehicles: number, revenue: number, sharePct: number}>,
   *   byVehicleType: Array<{key: string, vehicles: number, revenue: number, sharePct: number}>,
   *   byPaymentMethod: Array<{key: string, vehicles: number, revenue: number, sharePct: number}>
   * }, message?: string}>}
   */
  getRevenueBreakdown(filters) {
    return respond(() => {
      const f = normalizeFilters(filters);
      const error = checkFilters(f);
      if (error) return { success: false, message: error };

      const facts = currentPeriod(f);
      const total = sum(facts, 'revenue');
      const totals = (predicate) => {
        const rows = facts.filter(predicate);
        return { vehicles: sum(rows, 'vehicles'), revenue: sum(rows, 'revenue') };
      };

      const byLot = withShare(
        LOT_SAMPLE.filter((lot) => f.lotId === 'all' || lot.id === f.lotId).map((lot) => ({
          id: lot.id,
          name: lot.name,
          isActive: lot.isActive,
          capacity: lot.capacity,
          occupancyRate: lot.occupancyRate,
          ...totals((fact) => fact.lotId === lot.id),
        })),
        total,
      );
      const byVehicleType = withShare(
        VEHICLE_TYPES.filter((t) => f.vehicleType === 'all' || t === f.vehicleType).map((key) => ({
          key,
          ...totals((fact) => fact.vehicleType === key),
        })),
        total,
      );
      const byPaymentMethod = withShare(
        PAYMENT_METHODS.filter((m) => f.paymentMethod === 'all' || m === f.paymentMethod).map((key) => ({
          key,
          ...totals((fact) => fact.paymentMethod === key),
        })),
        total,
      );

      return { success: true, data: { byLot, byVehicleType, byPaymentMethod } };
    });
  },
};
