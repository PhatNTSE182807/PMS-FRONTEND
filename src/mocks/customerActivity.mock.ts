/**
 * Demo data for the customer dashboard sections the backend has no endpoint for yet
 * (active parking session, upcoming reservation, past sessions). The UI marks them "Demo".
 */

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
// Fixed when the bundle loads, so the elapsed-time meter keeps counting up.
const loadedAt = Date.now()

export interface DemoActiveSession {
  lotName: string
  address: string
  slot: string
  entryAt: number
  entryGate: string
  /** VND per started hour */
  hourlyRate: number
}

export interface DemoReservation {
  lotName: string
  area: string
  window: string
  stallArea: string
  note: string
}

export interface DemoSessionRecord {
  id: string
  endedAt: number
  lotName: string
  area: string
  stall: string
  plate: string
  durationMinutes: number
  amount: number
}

export const demoActiveSession: DemoActiveSession = {
  lotName: 'Saigon Centre Terminal',
  address: '65 Le Loi Boulevard, Ben Nghe, District 1',
  slot: 'B2-14',
  entryAt: loadedAt - (2 * HOUR + 45 * 60 * 1000),
  entryGate: 'Entry Gate A3',
  hourlyRate: 25_000,
}

export const demoReservation: DemoReservation = {
  lotName: 'Landmark 81 Terminal',
  area: 'Binh Thanh District, Ho Chi Minh City',
  window: 'Tomorrow, 14:00 - 18:30',
  stallArea: 'Zone B2 • Near Tower Lobby',
  note: 'Includes high-speed AC charging on request.',
}

/** `plate` is a placeholder: the dashboard shows the customer's own plates instead. */
export const demoRecentSessions: DemoSessionRecord[] = [
  { id: 's-1', endedAt: loadedAt - 1 * DAY, lotName: 'Bitexco Financial Terminal', area: 'District 1', stall: 'B1-09', plate: '', durationMinutes: 192, amount: 80_000 },
  { id: 's-2', endedAt: loadedAt - 4 * DAY, lotName: 'Landmark 81 Terminal', area: 'Binh Thanh', stall: 'B2-30', plate: '', durationMinutes: 105, amount: 45_000 },
  { id: 's-3', endedAt: loadedAt - 7 * DAY, lotName: 'Saigon Centre Terminal', area: 'District 1', stall: 'B3-04', plate: '', durationMinutes: 250, amount: 110_000 },
]

export type DemoBookingStatus = 'CONFIRMED' | 'PENDING_DEPOSIT' | 'COMPLETED' | 'CANCELLED'

export interface DemoBooking {
  id: string
  status: DemoBookingStatus
  lotName: string
  lotCode: string
  address: string
  bay: string
  bayType: string
  /** Index into the customer's vehicles (wraps around); the plate comes from the real list. */
  vehicleIndex: number
  vehicleKind: 'car' | 'motorbike'
  start: number
  end: number
  deposit: number
  /** Final fee for completed bookings, refund for cancelled ones. */
  finalFee?: number
}

const at = (dayOffset: number, hour: number, minute = 0) => {
  const d = new Date(loadedAt)
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, minute, 0, 0)
  return d.getTime()
}

/** Bookings for "My Bookings": one active, one awaiting its deposit and a short history. */
export const demoBookings: DemoBooking[] = [
  { id: 'BK-9942', status: 'CONFIRMED', lotName: 'Saigon Centre - Takashimaya Hub', lotCode: 'LOT-SGC-01', address: '65 Le Loi, Ben Nghe Ward, District 1, Ho Chi Minh City', bay: 'B2-04', bayType: 'Sedan & SUV slot', vehicleIndex: 0, vehicleKind: 'car', start: loadedAt + 30 * 60 * 1000, end: loadedAt + 90 * 60 * 1000, deposit: 50_000 },
  { id: 'BK-9951', status: 'PENDING_DEPOSIT', lotName: 'Landmark 81 Underground Vault', lotCode: 'LOT-LM81-02', address: 'Binh Thanh District, HCMC', bay: 'P1-18', bayType: 'Motorbike', vehicleIndex: 1, vehicleKind: 'motorbike', start: at(1, 9), end: at(1, 10), deposit: 20_000 },
  { id: 'BK-9482', status: 'COMPLETED', lotName: 'Crescent Mall Complex', lotCode: 'LOT-CSM-04', address: 'District 7, HCMC', bay: 'A1-12', bayType: 'Car (Sedan)', vehicleIndex: 0, vehicleKind: 'car', start: at(-1, 18), end: at(-1, 21, 30), deposit: 50_000, finalFee: 85_000 },
  { id: 'BK-9120', status: 'COMPLETED', lotName: 'Bitexco Financial Tower', lotCode: 'LOT-BTX-03', address: 'District 1, HCMC', bay: 'M-05', bayType: 'Bike (Scooter)', vehicleIndex: 1, vehicleKind: 'motorbike', start: at(-6, 10), end: at(-6, 12, 45), deposit: 20_000, finalFee: 30_000 },
  { id: 'BK-8931', status: 'CANCELLED', lotName: 'Thu Duc Innovation Hub', lotCode: 'LOT-TDI-05', address: 'Thu Duc City, HCMC', bay: 'C3-09', bayType: 'Car (Sedan)', vehicleIndex: 0, vehicleKind: 'car', start: at(-10, 14), end: at(-10, 14), deposit: 50_000, finalFee: 50_000 },
]
