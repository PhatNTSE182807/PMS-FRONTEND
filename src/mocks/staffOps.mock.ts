/**
 * Demo data for the Staff (gate attendant) console. The backend has no gate, POS, incident or
 * cash-drawer endpoints yet, so every Staff screen reads from here and is labelled "Demo".
 */

const loadedAt = Date.now()

const today = (h: number, m = 0, s = 0) => {
  const d = new Date(loadedAt)
  d.setHours(h, m, s, 0)
  return d.getTime()
}

/* ------------------------------------------------------------------ */
/* Station                                                              */
/* ------------------------------------------------------------------ */

export const demoStation = {
  facility: 'Saigon Centre - Takashimaya Hub',
  facilityCode: 'LOT-SGC-01',
  station: 'Gate POS Station 01',
  lane: 'Front Concourse',
  employeeCode: 'EMP-0418',
  title: 'Senior Gate Officer',
  manager: 'Duc Nguyen',
  managerCode: 'EMP-0091',
  edgeLatencyMs: 14,
}

/* ------------------------------------------------------------------ */
/* Gate dashboard                                                       */
/* ------------------------------------------------------------------ */

export const demoGateStats = {
  throughputToday: 1248,
  throughputTrend: 18.4,
  activeBays: 421,
  totalBays: 500,
  generalOpen: 59,
  reservedVip: 18,
  cashInDrawer: 3_850_000,
}

export interface DemoCamera {
  id: string
  label: string
  image: string
  accuracy: number
  plate: string
  vehicle: string
  status: 'PASSING' | 'AWAITING'
  tag: string
  capturedAt: number
}

export const demoCameras: DemoCamera[] = [
  { id: 'CAM-01', label: 'Entry north', image: '/home/anpr-gate.jpg', accuracy: 99.8, plate: '51K-889.24', vehicle: 'Porsche 911 Carrera', status: 'PASSING', tag: 'OCR locked', capturedAt: today(14, 32, 8) },
  { id: 'CAM-02', label: 'Exit south', image: '/home/vault-deck.jpg', accuracy: 99.4, plate: '51H-442.19', vehicle: 'Toyota Camry 2.5Q', status: 'AWAITING', tag: 'Plate verified', capturedAt: today(14, 32, 5) },
]

export const demoGateSession = {
  plate: '51K-889.24',
  tier: 'VIP Gold tier',
  vehicleClass: 'Passenger Coupe (Porsche 911)',
  driver: 'Nguyen Van An',
  driverId: '#VN-9082',
  bay: 'B2-04 (VIP Zone)',
  reservation: 'Deposit 50,000 VND deducted',
}

export type GateDirection = 'ENTRY' | 'EXIT'
export type GateClearance = 'AUTO_PASSED' | 'PAID_OPENING' | 'COMPLETED'

export interface DemoGateEvent {
  at: number
  plate: string
  vehicle: string
  direction: GateDirection
  access: string
  premium?: boolean
  clearance: GateClearance
}

export const demoGateEvents: DemoGateEvent[] = [
  { at: today(14, 32, 8), plate: '51K-889.24', vehicle: 'Porsche 911', direction: 'ENTRY', access: 'Pre-booked VIP (App deduct)', premium: true, clearance: 'AUTO_PASSED' },
  { at: today(14, 31, 44), plate: '51H-442.19', vehicle: 'Toyota Camry', direction: 'EXIT', access: 'VietQR (35,000 VND)', clearance: 'PAID_OPENING' },
  { at: today(14, 30, 19), plate: '50E-120.55', vehicle: 'Mercedes-Benz E300', direction: 'ENTRY', access: 'NFC corporate pass', clearance: 'AUTO_PASSED' },
  { at: today(14, 28, 52), plate: '59A-992.11', vehicle: 'Honda CR-V', direction: 'EXIT', access: 'Cash (70,000 VND)', clearance: 'COMPLETED' },
  { at: today(14, 27, 1), plate: '51G-331.02', vehicle: 'VinFast VF8', direction: 'ENTRY', access: 'Standard ticket dispensed', clearance: 'AUTO_PASSED' },
  { at: today(14, 25, 39), plate: '51B-108.90', vehicle: 'Ford Transit (Hotel shuttle)', direction: 'EXIT', access: 'Fleet contract (monthly)', premium: true, clearance: 'COMPLETED' },
]

/* ------------------------------------------------------------------ */
/* Payment & checkout POS                                               */
/* ------------------------------------------------------------------ */

export interface TariffLine {
  label: string
  detail: string
  amount: number
}

export const demoCheckout = {
  txnId: 'SGC-2025-0518-9942',
  plate: '51F-128.45',
  vehicle: 'Lexus RX350 • Pearl Obsidian Mica',
  matchScore: 99.8,
  lane: 'GATE-01',
  laneName: 'Concourse front',
  checkIn: today(9, 15),
  exitAt: today(14, 28),
  entryImage: '/register-car.jpg',
  exitImage: '/home/hero-garage.jpg',
  rateCard: 'LOT-SGC-REG',
  tariff: [
    { label: 'Grace window • Initial 15 mins', detail: '09:15 - 09:30 • Complimentary courtesy', amount: 0 },
    { label: 'First 2 hours base block', detail: '09:15 - 11:15 • Standard concourse tier', amount: 70_000 },
    { label: 'Next 3h 13m incremental tariff', detail: '4 billing blocks × 25,000 VND', amount: 100_000 },
  ] satisfies TariffLine[],
  deposit: { label: 'Pre-booking deposit deduction', detail: 'VietQR online reservation #BK-9942', amount: -50_000 },
  receiptPhone: '+84 90 812 3456',
}

/* ------------------------------------------------------------------ */
/* Exceptions & alerts                                                  */
/* ------------------------------------------------------------------ */

export type IncidentSeverity = 'URGENT' | 'HIGH_RISK' | 'REASSIGNMENT'

export interface DemoIncident {
  id: string
  source: string
  severity: IncidentSeverity
  title: string
  summary: string
  left: { label: string; value: string }
  right: { label: string; value: string }
  vehicle: string
  driverClaim: string
  ticket: string
  entry: { image: string; at: number; ocr: string; score: number; node: string; mode: string }
  exit: { image: string; at: number; ocr: string; score: number; node: string; mode: string }
  suggestedPlate: string
  tariff: number
  lostTicketFine: number
}

export const demoIncidents: DemoIncident[] = [
  {
    id: 'ALT-1092',
    source: 'Gantry exit',
    severity: 'URGENT',
    title: 'Low confidence ANPR plate misread',
    summary: 'Exit camera returned OCR confidence of 68.2%. Visual distortion near centre digit.',
    left: { label: 'Sensor read', value: '51K-88?24' },
    right: { label: 'Registered ticket', value: '51K-889.24' },
    vehicle: 'Mercedes-Benz E300 AMG',
    driverClaim: 'Card check-in at 08:30',
    ticket: '#TX-90184',
    entry: { image: '/lamborghini.jpg', at: today(8, 30, 12), ocr: '51K-889.24', score: 99.4, node: 'SGC-FRONT-CAM-01', mode: '1080p 60FPS RAW' },
    exit: { image: '/home/anpr-gate.jpg', at: today(14, 25, 4), ocr: '51K-88?24', score: 68.2, node: 'SGC-EXIT-GANTRY-CAM-03', mode: 'IR night-vision on' },
    suggestedPlate: '51K-889.24',
    tariff: 70_000,
    lostTicketFine: 150_000,
  },
  {
    id: 'ALT-1090',
    source: 'Ticket NFC-0481',
    severity: 'HIGH_RISK',
    title: 'Entry/exit plate discrepancy',
    summary: 'Honda Vision token scanned, front plate mismatch recorded between terminals.',
    left: { label: 'Entry record', value: '59-X3 481.02' },
    right: { label: 'Exit camera', value: '59-X3 481.08' },
    vehicle: 'Honda Vision 110',
    driverClaim: 'NFC token issued at 10:02',
    ticket: '#NFC-0481',
    entry: { image: '/home/vault-deck.jpg', at: today(10, 2, 41), ocr: '59-X3 481.02', score: 97.1, node: 'SGC-FRONT-CAM-02', mode: '1080p 60FPS RAW' },
    exit: { image: '/home/hero-garage.jpg', at: today(14, 21, 9), ocr: '59-X3 481.08', score: 95.6, node: 'SGC-EXIT-GANTRY-CAM-03', mode: 'IR night-vision on' },
    suggestedPlate: '59-X3 481.02',
    tariff: 12_000,
    lostTicketFine: 50_000,
  },
  {
    id: 'ALT-1088',
    source: 'Concourse B2',
    severity: 'REASSIGNMENT',
    title: 'Pre-booking slot bay B2-04 occupied',
    summary: 'VIP customer arrived for scheduled bay. Ultrasonic node signals slot taken by unauthorised auto.',
    left: { label: 'Reserved bay', value: 'B2-04 (VIP)' },
    right: { label: 'Action required', value: 'Redirect to B2-08' },
    vehicle: 'Porsche 911 GT3',
    driverClaim: 'Reservation #BK-9942 at 14:30',
    ticket: '#BK-9942',
    entry: { image: '/lamborghini.jpg', at: today(14, 29, 50), ocr: '51K-312.90', score: 99.1, node: 'SGC-B2-CAM-07', mode: '1080p 30FPS' },
    exit: { image: '/home/vault-deck.jpg', at: today(14, 32, 8), ocr: '51K-889.24', score: 99.8, node: 'SGC-FRONT-CAM-01', mode: '1080p 60FPS RAW' },
    suggestedPlate: '51K-889.24',
    tariff: 0,
    lostTicketFine: 0,
  },
]

export const RESOLUTION_REASONS = [
  'OCR character misread verified against driver ticket',
  'Plate obscured by dirt or glare, verified visually',
  'Driver presented matching registration papers',
  'Bay reassigned on customer request',
]

export const demoIncidentStats = { cleared: 19, avgTriageSeconds: 42 }

/* ------------------------------------------------------------------ */
/* End-of-day cash tally                                                */
/* ------------------------------------------------------------------ */

export interface Denomination {
  value: number
  code: string
  note: string
  count: number
}

export const demoDenominations: Denomination[] = [
  { value: 500_000, code: '500K', note: 'Polymer issue • High security', count: 12 },
  { value: 200_000, code: '200K', note: 'Polymer issue • Red-orange tint', count: 10 },
  { value: 100_000, code: '100K', note: 'Polymer issue • Emerald tint', count: 10 },
  { value: 50_000, code: '50K', note: 'Polymer issue • Violet-red', count: 5 },
  { value: 20_000, code: '20K', note: 'Polymer issue • Azure blue', count: 2 },
  { value: 10_000, code: '10K', note: 'Polymer issue • Yellowish green', count: 1 },
]

export const demoDrawer = {
  sessionId: 'AUD-20261024-S01',
  systemCash: 8_300_000,
  cashTransactions: 84,
  digitalCleared: 24_150_000,
  digitalTransactions: 142,
  float: 1_000_000,
  envelope: 'ENV-20261024-01-T',
}

export interface CashReceipt {
  id: string
  at: number
  plate: string
  dwellMinutes: number
  tariffClass: string
  amount: number
  note: string
}

export const demoCashReceipts: CashReceipt[] = [
  { id: 'REC-1024-0084', at: today(22, 48, 14), plate: '51K-988.22', dwellMinutes: 252, tariffClass: 'Standard SUV', amount: 150_000, note: 'Standard exit • exact note payment' },
  { id: 'REC-1024-0083', at: today(22, 31, 5), plate: '50A-711.90', dwellMinutes: 165, tariffClass: 'Sedan VIP', amount: 100_000, note: 'Change dispensed 100k VND' },
  { id: 'REC-1024-0082', at: today(21, 55, 40), plate: '59T-344.11', dwellMinutes: 500, tariffClass: 'Full dwell', amount: 300_000, note: 'Cinema ticket stamp validated (-50k)' },
  { id: 'REC-1024-0081', at: today(21, 12, 18), plate: '60B-822.45', dwellMinutes: 65, tariffClass: 'Motorbike super', amount: 30_000, note: 'Exact physical denomination tendered' },
  { id: 'REC-1024-0080', at: today(20, 44, 59), plate: '51G-551.02', dwellMinutes: 379, tariffClass: 'Premium sedan', amount: 250_000, note: 'Cash validated via optical drawer tray' },
  { id: 'REC-1024-0079', at: today(19, 30, 12), plate: '51F-102.88', dwellMinutes: 230, tariffClass: 'EV fastcharge', amount: 450_000, note: 'Charging surcharge + parking tier' },
  { id: 'REC-1024-0078', at: today(18, 14, 2), plate: '59A-990.14', dwellMinutes: 302, tariffClass: 'Standard SUV', amount: 200_000, note: 'Paid with single 200k polymer note' },
  { id: 'REC-1024-0077', at: today(17, 40, 29), plate: '52Z-419.00', dwellMinutes: 130, tariffClass: 'Sedan VIP', amount: 100_000, note: 'Regular tariff validated' },
]
