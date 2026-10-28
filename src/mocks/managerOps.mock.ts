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
