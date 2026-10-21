import { isMockService, SERVICE_PATHS } from '@/config/env'
import { gateMock } from '@/mocks/operations.mock'
import type {
  CheckInRequest,
  CheckInResultDTO,
  CheckoutQuoteDTO,
  CheckoutRequest,
  CheckoutResultDTO,
  GateDTO,
  GateReservationLookupDTO,
  ParkingSessionDTO,
  PaymentDTO,
  PaymentProvider,
  ZoneCounterDTO,
} from '@/types/operations.dto'
import { http } from './axiosClient'

const base = SERVICE_PATHS.gate
const mocked = () => isMockService('gate')
const lotPath = (lotId: string) => `${base}/lots/${lotId}`
const sessionPath = (sessionId: number) => `${base}/sessions/${sessionId}`

/** Entry and exit lanes of the Staff's lot (SRS FR-OPS-01/02, UC-01, UC-02). */
export const gateService = {
  getGates(lotId: string): Promise<GateDTO[]> {
    return mocked() ? gateMock.gates(lotId) : http.get<GateDTO[]>(`${lotPath(lotId)}/gates`)
  },

  getZoneCounters(lotId: string): Promise<ZoneCounterDTO[]> {
    return mocked() ? gateMock.counters(lotId) : http.get<ZoneCounterDTO[]>(`${lotPath(lotId)}/zone-counters`)
  },

  /** Open sessions (vehicles inside or entering) unless a status is given. */
  getSessions(lotId: string, status?: string): Promise<ParkingSessionDTO[]> {
    return mocked() ? gateMock.sessions(lotId, status) : http.get<ParkingSessionDTO[]>(`${lotPath(lotId)}/sessions`, { params: { status } })
  },

  /** Exit lane: the open session of a plate or a session code. */
  lookup(lotId: string, query: { plate?: string; code?: string; ticket?: string }): Promise<ParkingSessionDTO> {
    return mocked() ? gateMock.lookup(lotId, query) : http.get<ParkingSessionDTO>(`${lotPath(lotId)}/sessions/lookup`, { params: query })
  },

  /** Entry lane: the booking behind a scanned QR (`qr`) or a typed code, with the booked vehicle. */
  lookupReservation(lotId: string, query: { code?: string; qr?: string }): Promise<GateReservationLookupDTO> {
    return mocked()
      ? gateMock.lookupReservation(lotId, query)
      : http.get<GateReservationLookupDTO>(`${lotPath(lotId)}/reservations/lookup`, { params: query })
  },

  /** Runs every gate check: "Created" opens the barrier, "Blocked" lists what the Staff must resolve. */
  checkIn(lotId: string, request: CheckInRequest): Promise<CheckInResultDTO> {
    return mocked() ? gateMock.checkIn(lotId, request) : http.post<CheckInResultDTO>(`${lotPath(lotId)}/check-in`, request)
  },

  /** Loop sensor: the vehicle passed, the session is now valid. */
  confirmEntry(sessionId: number): Promise<ParkingSessionDTO> {
    return mocked() ? gateMock.confirmEntry(sessionId) : http.post<ParkingSessionDTO>(`${sessionPath(sessionId)}/entry-confirm`)
  },

  /** The vehicle turned around before the sensor. */
  cancelEntry(sessionId: number): Promise<ParkingSessionDTO> {
    return mocked() ? gateMock.cancelEntry(sessionId) : http.post<ParkingSessionDTO>(`${sessionPath(sessionId)}/entry-cancel`)
  },

  /** Fee request at the exit lane: deposit deducted, Exit Window checked. */
  quote(sessionId: number, plateNumber?: string): Promise<CheckoutQuoteDTO> {
    return mocked() ? gateMock.quote(sessionId, plateNumber) : http.post<CheckoutQuoteDTO>(`${sessionPath(sessionId)}/quote`, { plateNumber })
  },

  cancelPayment(sessionId: number): Promise<ParkingSessionDTO> {
    return mocked() ? gateMock.cancelPayment(sessionId) : http.post<ParkingSessionDTO>(`${sessionPath(sessionId)}/cancel-payment`)
  },

  payCash(sessionId: number, amount: number, prepaid = false): Promise<PaymentDTO> {
    return mocked()
      ? gateMock.payCash(sessionId, amount, prepaid)
      : http.post<PaymentDTO>(`${sessionPath(sessionId)}/payments/cash`, { amount, prepaid })
  },

  /** Dynamic QR (VNPay / MoMo) for a Guest: show `payUrl` as a QR code. */
  payOnline(sessionId: number, provider: PaymentProvider, prepaid = false): Promise<PaymentDTO> {
    return mocked()
      ? gateMock.payOnline(sessionId, provider, prepaid)
      : http.post<PaymentDTO>(`${sessionPath(sessionId)}/payments/online`, { provider, prepaid })
  },

  /** The vehicle passes the exit barrier. */
  checkout(sessionId: number, request: CheckoutRequest): Promise<CheckoutResultDTO> {
    return mocked() ? gateMock.checkout(sessionId, request) : http.post<CheckoutResultDTO>(`${sessionPath(sessionId)}/check-out`, request)
  },
}
