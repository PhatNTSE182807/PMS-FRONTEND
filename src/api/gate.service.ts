import type { BanknoteCounts } from '@/types/cashDrawer.dto'
import { SERVICE_PATHS } from '@/config/env'
import type {
  CheckInRequest,
  CheckInResultDTO,
  CheckoutQuoteDTO,
  CheckoutRequest,
  CheckoutResultDTO,
  GateDTO,
  GateReservationLookupDTO,
  LostTicketRequest,
  ParkingSessionDTO,
  PaymentDTO,
  PaymentProvider,
  StaffPaymentHistoryPageDTO,
  ZoneCounterDTO,
} from '@/types/operations.dto'
import { axiosClient, http, toApiError } from './axiosClient'

const base = SERVICE_PATHS.gate
const lotPath = (lotId: string) => `${base}/lots/${lotId}`
const sessionPath = (sessionId: number) => `${base}/sessions/${sessionId}`

/**
 * Entry and exit lanes of the Staff's lot (SRS FR-OPS-01/02, UC-01, UC-02). Always the real API
 * (StaffGateController): the check-in / check-out flow has no demo mode.
 */
export const gateService = {
  getGates(lotId: string): Promise<GateDTO[]> {
    return http.get<GateDTO[]>(`${lotPath(lotId)}/gates`)
  },

  getZoneCounters(lotId: string): Promise<ZoneCounterDTO[]> {
    return http.get<ZoneCounterDTO[]>(`${lotPath(lotId)}/zone-counters`)
  },

  /** Open sessions (vehicles inside or entering) unless a status is given. */
  getSessions(lotId: string, status?: string): Promise<ParkingSessionDTO[]> {
    return http.get<ParkingSessionDTO[]>(`${lotPath(lotId)}/sessions`, { params: { status } })
  },

  getHistory(
    lotId: string,
    page = 1,
    plate?: string,
    pageSize = 10,
  ): Promise<{ items: ParkingSessionDTO[]; page: number; pageSize: number; totalCount: number }> {
    return http.get(`${lotPath(lotId)}/sessions/history`, { params: { page, pageSize, plate: plate || undefined } })
  },

  /** Parking fees collected at this lot; method=Cash keeps cash only. */
  getPayments(
    lotId: string,
    params?: { method?: string; plate?: string; page?: number; pageSize?: number },
  ): Promise<StaffPaymentHistoryPageDTO> {
    return http.get<StaffPaymentHistoryPageDTO>(`${lotPath(lotId)}/payments`, {
      params: { ...params, method: params?.method || undefined, plate: params?.plate || undefined, pageSize: params?.pageSize ?? 10 },
    })
  },

  /** Exit lane: the open session of a plate or a session code. */
  lookup(lotId: string, query: { plate?: string; code?: string; ticket?: string }): Promise<ParkingSessionDTO> {
    return http.get<ParkingSessionDTO>(`${lotPath(lotId)}/sessions/lookup`, { params: query })
  },

  /** Entry lane: the booking behind a scanned QR (`qr`), a typed code or the vehicle's plate, with the booked vehicle. */
  lookupReservation(lotId: string, query: { code?: string; qr?: string; plate?: string }): Promise<GateReservationLookupDTO> {
    return http.get<GateReservationLookupDTO>(`${lotPath(lotId)}/reservations/lookup`, { params: query })
  },

  /** Runs every gate check: "Created" opens the barrier, "Blocked" lists what the Staff must resolve. */
  checkIn(lotId: string, request: CheckInRequest): Promise<CheckInResultDTO> {
    return http.post<CheckInResultDTO>(`${lotPath(lotId)}/check-in`, request)
  },

  /** Loop sensor: the vehicle passed, the session is now valid. */
  confirmEntry(sessionId: number): Promise<ParkingSessionDTO> {
    return http.post<ParkingSessionDTO>(`${sessionPath(sessionId)}/entry-confirm`)
  },

  /** The vehicle turned around before the sensor. */
  cancelEntry(sessionId: number): Promise<ParkingSessionDTO> {
    return http.post<ParkingSessionDTO>(`${sessionPath(sessionId)}/entry-cancel`)
  },

  /** Fee request at the exit lane: deposit deducted, Exit Window checked. */
  quote(sessionId: number, plateNumber?: string): Promise<CheckoutQuoteDTO> {
    return http.post<CheckoutQuoteDTO>(`${sessionPath(sessionId)}/quote`, { plateNumber })
  },

  cancelPayment(sessionId: number): Promise<ParkingSessionDTO> {
    return http.post<ParkingSessionDTO>(`${sessionPath(sessionId)}/cancel-payment`)
  },

  /** Cash: `received` / `change` (banknote counts) are optional and feed the Staff's cash drawer. */
  payCash(sessionId: number, amount: number, prepaid = false, received?: BanknoteCounts, change?: BanknoteCounts): Promise<PaymentDTO> {
    return http.post<PaymentDTO>(`${sessionPath(sessionId)}/payments/cash`, { amount, prepaid, received, change })
  },

  /** Dynamic QR (VNPay / MoMo) for a Guest: show `payUrl` as a QR code. */
  payOnline(sessionId: number, provider: PaymentProvider, prepaid = false): Promise<PaymentDTO> {
    return http.post<PaymentDTO>(`${sessionPath(sessionId)}/payments/online`, { provider, prepaid })
  },

  /** Lost ticket with photos of the driver's Citizen ID and registration certificate; the Staff then reviews it. */
  reportLostTicketWithPapers(sessionId: number, reason: string, citizenId: File, registration: File): Promise<ParkingSessionDTO> {
    const form = new FormData()
    form.append('reason', reason)
    form.append('citizenId', citizenId)
    form.append('registration', registration)
    return http.post<ParkingSessionDTO>(`${sessionPath(sessionId)}/lost-ticket/papers`, form)
  },

  /** The Staff compared the papers: approve (fine on the bill, the vehicle stays) or refuse with a note. */
  reviewLostTicket(sessionId: number, approve: boolean, note?: string): Promise<ParkingSessionDTO> {
    return http.post<ParkingSessionDTO>(`${sessionPath(sessionId)}/lost-ticket/review`, { approve, note: note || undefined })
  },

  /** One uploaded paper (citizen-id or registration); the endpoint needs the bearer token, so it is fetched as a blob. */
  async getLostTicketPaper(sessionId: number, kind: 'citizen-id' | 'registration'): Promise<Blob> {
    try {
      const response = await axiosClient.get<Blob>(`${sessionPath(sessionId)}/lost-ticket/papers/${kind}`, { responseType: 'blob' })
      return response.data
    } catch (error) {
      throw toApiError(error)
    }
  },

  /**
   * Lost ticket / card: adds the lost-ticket fine. With `conditionsMet` the session moves straight to
   * PendingPayment; otherwise it waits in LostTicketPending for a Manager's approval.
   */
  reportLostTicket(sessionId: number, request: LostTicketRequest): Promise<ParkingSessionDTO> {
    return http.post<ParkingSessionDTO>(`${sessionPath(sessionId)}/lost-ticket`, request)
  },

  /** The vehicle passes the exit barrier. */
  checkout(sessionId: number, request: CheckoutRequest): Promise<CheckoutResultDTO> {
    return http.post<CheckoutResultDTO>(`${sessionPath(sessionId)}/check-out`, request)
  },
}
