/**
 * Demo data for the Manager console sections the backend has no endpoint for yet
 * (reservations, approval requests, tariffs). The UI marks them "Demo".
 */

const MIN = 60_000
const loadedAt = Date.now()

/* ------------------------------------------------------------------ */
/* Reservations                                                         */
/* ------------------------------------------------------------------ */

export type ReservationStatus = 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'

export interface DemoReservation {
  id: string
  customer: string
  phone: string
  plate: string
  vehicle: string
  vehicleKind: 'car' | 'motorbike'
  bay: string
  floor: string
  start: number
  end: number
  deposit: number
  payment: string
  status: ReservationStatus
}

const today = (h: number, m = 0) => {
  const d = new Date(loadedAt)
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

export const demoReservations: DemoReservation[] = [
  { id: 'BK-9942', customer: 'Alexander Vance', phone: '0908 123 456', plate: '51K-889.24', vehicle: 'Porsche 911 GT3', vehicleKind: 'car', bay: 'B2-04', floor: 'Floor B2 (Premium)', start: loadedAt + 2 * MIN, end: loadedAt + 62 * MIN, deposit: 50_000, payment: 'VietQR', status: 'CONFIRMED' },
  { id: 'BK-9945', customer: 'Nguyen Minh Tri', phone: '0912 345 678', plate: '51H-442.19', vehicle: 'Toyota Camry', vehicleKind: 'car', bay: 'B1-12', floor: 'Floor B1', start: today(14), end: today(15), deposit: 50_000, payment: 'ANPR auto-debit', status: 'CHECKED_IN' },
  { id: 'BK-9938', customer: 'Tran Thi Anh', phone: '0988 776 655', plate: '59-T1 999.88', vehicle: 'Honda SH150i', vehicleKind: 'motorbike', bay: 'P1-18', floor: 'Floor B3 (Bike pod)', start: loadedAt - 15 * MIN, end: loadedAt + 45 * MIN, deposit: 20_000, payment: 'MoMo', status: 'CONFIRMED' },
  { id: 'BK-9920', customer: 'Pham Quoc Bao', phone: '0933 221 100', plate: '51K-312.90', vehicle: 'Mercedes C300', vehicleKind: 'car', bay: 'B2-08', floor: 'Floor B2 (Premium)', start: loadedAt + 45 * MIN, end: loadedAt + 105 * MIN, deposit: 50_000, payment: 'Credit card', status: 'CONFIRMED' },
  { id: 'BK-9917', customer: 'Le Hoang Duc', phone: '0933 882 104', plate: '50E-102.44', vehicle: 'VinFast VF8', vehicleKind: 'car', bay: 'B2-12', floor: 'Floor B2 (Premium)', start: today(9), end: today(11), deposit: 50_000, payment: 'VietQR', status: 'COMPLETED' },
  { id: 'BK-9902', customer: 'Doan Thu Thao', phone: '0944 551 098', plate: '59G-331.02', vehicle: 'Yamaha Grande', vehicleKind: 'motorbike', bay: 'P1-03', floor: 'Floor B3 (Bike pod)', start: today(8), end: today(9), deposit: 20_000, payment: 'MoMo', status: 'NO_SHOW' },
  { id: 'BK-9891', customer: 'Vuong Dinh Toan', phone: '0901 889 900', plate: '50E-109.84', vehicle: 'VinFast VF8', vehicleKind: 'car', bay: 'B2-19', floor: 'Floor B2', start: today(11, 30), end: today(12, 30), deposit: 50_000, payment: 'VietQR', status: 'CANCELLED' },
]

/* ------------------------------------------------------------------ */
/* Approval queue                                                       */
/* ------------------------------------------------------------------ */

export type ApprovalKind = 'LOST_TICKET' | 'DEPOSIT_REFUND' | 'SESSION_CLOSURE' | 'COUNTER_ADJUSTMENT'
export type ApprovalPriority = 'HIGH' | 'NORMAL' | 'INSPECTION' | 'SIGN_OFF'

export interface FeeLine {
  label: string
  amount: number
}

export interface DemoApproval {
  id: string
  kind: ApprovalKind
  priority: ApprovalPriority
  title: string
  plate?: string
  vehicle?: string
  requestedBy: string
  receivedAt: number
  /** Positive = customer pays, negative = refund / waiver. */
  amount: number
  summary: string
  fees: FeeLine[]
  evidence: { label: string; value: string }[]
}

export const demoApprovals: DemoApproval[] = [
  {
    id: 'REQ-8821', kind: 'LOST_TICKET', priority: 'HIGH', title: 'Lost Ticket & RFID Replacement',
    plate: '51H-442.19', vehicle: 'Toyota Camry (White)', requestedBy: 'Staff Tran Hoang Nam (POS-01)', receivedAt: loadedAt - 18 * MIN, amount: 180_000,
    summary: 'Customer arrived today via Lane IN-01 and lost the paper QR receipt. Staff checked the citizen ID and vehicle registration at the Gate OUT-01 kiosk. Plate recognised by gantry OCR.',
    fees: [
      { label: 'Standard dwell tariff (5h 03m @ 20,000 VND/h)', amount: 100_000 },
      { label: 'Lost ticket investigation & audit penalty', amount: 50_000 },
      { label: 'RFID proximity card replacement', amount: 30_000 },
    ],
    evidence: [
      { label: 'Vehicle model', value: 'Camry 2.5Q 2022' },
      { label: 'Elapsed dwell', value: '5 hrs 03 mins' },
      { label: 'Citizen ID', value: '0792••••8819' },
      { label: 'Vehicle reg. book', value: 'CV-88219/HCMC' },
    ],
  },
  {
    id: 'REQ-8820', kind: 'DEPOSIT_REFUND', priority: 'NORMAL', title: 'Pre-Booking Deposit Full Refund',
    requestedBy: 'Customer Vuong Dinh Toan (#BK-9891)', receivedAt: loadedAt - 62 * MIN, amount: -50_000,
    summary: 'Booking #BK-9891 was cancelled 2 hours before arrival, which complies with the full-refund rule (BR-04).',
    fees: [{ label: 'Deposit refund to VietQR source account', amount: -50_000 }],
    evidence: [
      { label: 'Booking', value: '#BK-9891' },
      { label: 'Cancelled', value: '2h before arrival' },
      { label: 'Rule', value: 'BR-04 compliant' },
      { label: 'Refund channel', value: 'VietQR' },
    ],
  },
  {
    id: 'REQ-8819', kind: 'SESSION_CLOSURE', priority: 'INSPECTION', title: 'Ghost Session Forced Closure',
    plate: '59-X3 481.02', vehicle: 'Honda Vision (Motorcycle)', requestedBy: 'Security team field scan', receivedAt: loadedAt - 140 * MIN, amount: -120_000,
    summary: 'The session has been open for 58 hours but bay M-149 was scanned empty by the security patrol. Close the session and waive the accrued fee.',
    fees: [{ label: 'Accrued dwell fee to waive', amount: -120_000 }],
    evidence: [
      { label: 'Open dwell', value: '58 hours' },
      { label: 'Bay', value: 'M-149' },
      { label: 'Field scan', value: 'Verified empty' },
      { label: 'Last gate event', value: 'Entry only' },
    ],
  },
  {
    id: 'REQ-8816', kind: 'COUNTER_ADJUSTMENT', priority: 'SIGN_OFF', title: 'Zone B1 Counter Calibration',
    requestedBy: 'Shift lead Le Thi Mai', receivedAt: loadedAt - 200 * MIN, amount: 0,
    summary: 'The zone counter shows 3 more cars than the ultrasonic loop sensors. Adjust the counter by -3 after the physical count.',
    fees: [],
    evidence: [
      { label: 'Counter', value: '+3 phantom cars' },
      { label: 'Adjustment', value: '-3 units' },
      { label: 'Zone', value: 'B1' },
      { label: 'Physical count', value: 'Done 13:40' },
    ],
  },
]

/* ------------------------------------------------------------------ */
/* Tariffs                                                              */
/* ------------------------------------------------------------------ */

export interface TariffClass {
  id: 'CAR' | 'MOTORBIKE' | 'EV'
  name: string
  description: string
  dailyCap: number
  graceMinutes: number
  /** First block (minutes) and its price; then a price per started subsequent block. */
  firstBlockMinutes: number
  firstBlockPrice: number
  nextBlockMinutes: number
  nextBlockPrice: number
  overnightSurcharge: number
  lostTicketPenalty: number
  exitGraceMinutes: number
}

export const demoTariffs: TariffClass[] = [
  { id: 'CAR', name: 'Class 1: Passenger Cars', description: 'Sedan, coupe, hatchback, crossover and SUV (up to 7 seats).', dailyCap: 350_000, graceMinutes: 15, firstBlockMinutes: 120, firstBlockPrice: 35_000, nextBlockMinutes: 60, nextBlockPrice: 25_000, overnightSurcharge: 120_000, lostTicketPenalty: 150_000, exitGraceMinutes: 15 },
  { id: 'MOTORBIKE', name: 'Class 2: Motorbikes & Scooters', description: 'Mopeds, motorbikes and light electric scooters.', dailyCap: 70_000, graceMinutes: 15, firstBlockMinutes: 240, firstBlockPrice: 10_000, nextBlockMinutes: 240, nextBlockPrice: 15_000, overnightSurcharge: 30_000, lostTicketPenalty: 50_000, exitGraceMinutes: 15 },
  { id: 'EV', name: 'Class 3: Electric Vehicles', description: 'EV charging bays on B2 and B3: Class 1 parking rules plus metered energy.', dailyCap: 350_000, graceMinutes: 15, firstBlockMinutes: 120, firstBlockPrice: 35_000, nextBlockMinutes: 60, nextBlockPrice: 25_000, overnightSurcharge: 120_000, lostTicketPenalty: 150_000, exitGraceMinutes: 15 },
]

export const EV_ENERGY_RATE = 3_800
