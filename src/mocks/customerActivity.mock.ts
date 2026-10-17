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
