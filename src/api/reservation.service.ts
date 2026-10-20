import { isMockService, SERVICE_PATHS } from '@/config/env'
import { MOCK_PARKING_LOTS } from '@/mocks/parkingLots.mock'
import { mockResponse } from '@/mocks/mockApi'
import { reservationMock } from '@/mocks/operations.mock'
import type {
  BookableLotDTO,
  CreateReservationRequest,
  PaymentDTO,
  PaymentProvider,
  ReservationDTO,
  ReservationQrDTO,
  UpdateReservationRequest,
} from '@/types/operations.dto'
import { http } from './axiosClient'

const base = `${SERVICE_PATHS.booking}/reservations`
const mocked = () => isMockService('booking')

/** Where the gateway sends the customer back: the app's own return page (the provider is appended by the API). */
export const paymentReturnUrl = () => `${window.location.origin}/payment/return`

/** Customer reservations (SRS FR-RSV-02..05): hold a slot, pay the deposit, change, cancel, QR. */
export const reservationService = {
  /** Lots a customer can book on the 3D map. Demo lots keep their string ids ("lot-01"). */
  async getBookableLots(): Promise<(BookableLotDTO & { key: string })[]> {
    if (mocked()) {
      return mockResponse(() =>
        MOCK_PARKING_LOTS.map((l, i) => ({ id: i + 1, key: l.id, code: l.code, name: l.name, address: l.address, layoutTemplate: 'L3S20' })),
      )
    }
    const lots = await http.get<BookableLotDTO[]>(`${SERVICE_PATHS.parking}/public/lots`)
    return lots.map((l) => ({ ...l, key: String(l.id) }))
  },

  getMine(): Promise<ReservationDTO[]> {
    return mocked() ? reservationMock.mine() : http.get<ReservationDTO[]>(`${base}/mine`)
  },

  get(id: number): Promise<ReservationDTO> {
    return mocked() ? reservationMock.get(id) : http.get<ReservationDTO>(`${base}/${id}`)
  },

  /** Holds the slot at once; HTTP 409 means another driver held it first. */
  create(request: CreateReservationRequest): Promise<ReservationDTO> {
    if (mocked()) return reservationMock.create(request)
    return http.post<ReservationDTO>(base, {
      parkingLotId: Number(request.parkingLotId),
      slotId: Number(request.slotId),
      vehicleId: request.vehicleId,
      arrivalTime: request.arrivalTime,
    })
  },

  update(id: number, request: UpdateReservationRequest): Promise<ReservationDTO> {
    if (mocked()) return reservationMock.update(id, request)
    return http.put<ReservationDTO>(`${base}/${id}`, {
      arrivalTime: request.arrivalTime,
      slotId: request.slotId ? Number(request.slotId) : undefined,
    })
  },

  cancel(id: number, reason?: string): Promise<ReservationDTO> {
    return mocked() ? reservationMock.cancel(id, reason) : http.post<ReservationDTO>(`${base}/${id}/cancel`, { reason })
  },

  getQr(id: number): Promise<ReservationQrDTO> {
    return mocked() ? reservationMock.qr(id) : http.get<ReservationQrDTO>(`${base}/${id}/qr`)
  },

  /** Starts the deposit payment; redirect the browser to `payUrl`. */
  payDeposit(id: number, provider: PaymentProvider): Promise<PaymentDTO> {
    if (mocked()) return reservationMock.payDeposit(id, provider)
    return http.post<PaymentDTO>(`${base}/${id}/payments`, { provider, returnUrl: paymentReturnUrl() })
  },
}
