import { findMockLot } from '@/mocks/parkingLots.mock'
import { profileMock } from '@/mocks/profile.mock'
import type {
  CheckInRequest,
  CheckInResultDTO,
  CheckoutQuoteDTO,
  CheckoutRequest,
  CheckoutResultDTO,
  CreateReservationRequest,
  GateAlertDTO,
  GateDTO,
  ParkingSessionDTO,
  PaymentCallbackResultDTO,
  PaymentDTO,
  PaymentProvider,
  ReservationDTO,
  ReservationQrDTO,
  UpdateReservationRequest,
  ZoneCounterDTO,
} from '@/types/operations.dto'
import { mockFail, mockResponse } from './mockApi'

/*
 * In-browser stand-in for the reservation, gate and payment APIs, following the same SRS rules
 * (BR-01..BR-11, BR-22) on a smaller scale. Payments never leave the browser: the "gateway" is the
 * app's own /payment/return page with ?demo=1, which reports the payment as paid.
 */

const MINUTE = 60_000
const RULES = {
  maxLeadHours: 2,
  depositMinutes: 10,
  earlyMinutes: 15,
  holdMinutes: 15,
  cancelRefundMinutes: 30,
  deposit: 30_000,
  graceMinutes: 15,
  blockMinutes: 60,
  carBlock: 20_000,
  carDailyCap: 150_000,
  bikeBlock: 5_000,
  bikeBlockMinutes: 240,
  bikeDailyCap: 20_000,
  exitWindowMinutes: 15,
  exitWindowLateFee: 10_000,
  anprThreshold: 0.85,
}
/** A plate the demo blacklist knows, so the Staff screen can show the alert. */
const DEMO_BLACKLIST: Record<string, string> = { '29A66666': 'Nợ phí gửi xe (demo)' }

const iso = (t: number) => new Date(t).toISOString()
const now = () => Date.now()
const normalize = (plate: string | undefined) => (plate ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
const lotNumber = (lotId: string) => Number(lotId.replace(/\D/g, '')) || 1
let sequence = 1000
const nextId = () => ++sequence
const code = (prefix: string) => `${prefix}${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`

interface MockReservation extends ReservationDTO {
  lotKey: string
}
interface MockSession extends ParkingSessionDTO {
  lotKey: string
  vehicleKind: 'car' | 'motorbike'
}

const reservations: MockReservation[] = []
const sessions: MockSession[] = []
const payments: PaymentDTO[] = []

/* ---------------------------------------------------------------- fees (BR-09, BR-10, BR-22) */

function stayFee(kind: 'car' | 'motorbike', entry: number, exit: number) {
  const minutes = Math.max(0, Math.ceil((exit - entry) / MINUTE))
  if (minutes <= RULES.graceMinutes) return { minutes, fee: 0, days: [] as CheckoutQuoteDTO['days'] }
  const block = kind === 'car' ? RULES.carBlock : RULES.bikeBlock
  const blockMinutes = kind === 'car' ? RULES.blockMinutes : RULES.bikeBlockMinutes
  const cap = kind === 'car' ? RULES.carDailyCap : RULES.bikeDailyCap
  const days: CheckoutQuoteDTO['days'] = []
  let start = entry
  while (start < exit) {
    const midnight = new Date(start)
    midnight.setHours(24, 0, 0, 0)
    const end = Math.min(exit, midnight.getTime())
    const dayMinutes = Math.ceil((end - start) / MINUTE)
    const blocks = Math.ceil(dayMinutes / blockMinutes)
    const amount = Math.min(blocks * block, cap)
    days.push({ date: new Date(start).toISOString().slice(0, 10), minutes: dayMinutes, blocks, amount, capped: blocks * block > cap })
    start = end
  }
  const fee = Math.ceil(days.reduce((s, d) => s + d.amount, 0) / 1000) * 1000
  return { minutes, fee, days }
}

/* ---------------------------------------------------------------- reservations */

/** Deadlines the backend's Hangfire jobs handle: deposit expiry and no-shows. */
function sweep() {
  const t = now()
  for (const r of reservations) {
    if (r.status === 'PendingDeposit' && r.depositDueAt && Date.parse(r.depositDueAt) <= t) {
      r.status = 'Expired'
      r.cancelReason = 'Quá hạn thanh toán cọc'
      r.pendingPayment = null
    } else if (r.status === 'Confirmed' && Date.parse(r.checkInUntil) <= t) {
      r.status = 'NoShow'
    }
  }
  for (const s of sessions) {
    if (s.status === 'PendingEntry' && t - Date.parse(s.entryTime) > 2 * MINUTE) s.status = 'Cancelled'
  }
}

function refreshFlags(r: MockReservation) {
  const t = now()
  const beforeDeadline = t <= Date.parse(r.arrivalTime) - RULES.cancelRefundMinutes * MINUTE
  r.canChange = r.status === 'Confirmed' && beforeDeadline
  r.canCancel = r.status === 'PendingDeposit' || r.status === 'Confirmed'
  r.refundIfCancelledNow = r.status === 'Confirmed' && beforeDeadline ? r.depositAmount - r.refundAmount : 0
  if (r.pendingPayment && (r.pendingPayment.status !== 'Pending' || r.status !== 'PendingDeposit')) r.pendingPayment = null
  return r
}

function ownReservation(id: number) {
  const r = reservations.find((x) => x.id === id)
  if (!r) mockFail(404, 'Không tìm thấy đặt chỗ. Reservation not found.')
  return r
}

function checkArrival(arrival: number) {
  if (Number.isNaN(arrival) || arrival <= now()) mockFail(400, 'Giờ đến phải ở tương lai. The arrival time must be in the future.')
  if (arrival > now() + RULES.maxLeadHours * 60 * MINUTE)
    mockFail(400, `Chỉ đặt trước tối đa ${RULES.maxLeadHours} giờ (BR-01). Arrival must be within ${RULES.maxLeadHours} hours.`)
}

/** Slot ids of the demo 3D model are floorIndex * 1000 + bay number (layout.mock); the code is rebuilt from it. */
const slotCode = (slotId: number) => `L${Math.floor(slotId / 1000) + 1}-${String(slotId % 1000).padStart(2, '0')}`

function newPayment(amount: number, provider: PaymentProvider, purpose: PaymentDTO['purpose'], channel: PaymentDTO['channel'], link: { reservationId?: number; sessionId?: number }): PaymentDTO {
  const payment: PaymentDTO = {
    id: nextId(),
    code: code('PM'),
    provider,
    method: 'Online',
    purpose,
    channel,
    amount,
    status: 'Pending',
    payUrl: null,
    expiresAt: iso(now() + 15 * MINUTE),
    createdAt: iso(now()),
    paidAt: null,
    reservationId: link.reservationId ?? null,
    sessionId: link.sessionId ?? null,
    refundedAmount: 0,
    refundOfPaymentId: null,
    message: null,
    exitPass: null,
    exitWindowEndsAt: null,
    callbackDeadline: iso(now() + 60_000),
  }
  // The demo "gateway" is the app's own return page
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  payment.payUrl = `${origin}/payment/return/${provider.toLowerCase()}?demo=1&code=${payment.code}&amount=${amount}`
  payments.push(payment)
  return payment
}

function refund(original: PaymentDTO, amount: number, reason: string) {
  if (amount <= 0) return
  original.refundedAmount += amount
  payments.push({ ...original, id: nextId(), code: code('RF'), purpose: 'Refund', amount, status: 'Refunded', refundOfPaymentId: original.id, message: reason, payUrl: null, paidAt: iso(now()) })
}

function depositHeld(reservationId: number) {
  return payments
    .filter((p) => p.reservationId === reservationId && p.purpose === 'Deposit' && p.status === 'Succeeded')
    .reduce((s, p) => s + p.amount - p.refundedAmount, 0)
}

function refundDeposit(r: MockReservation, amount: number, reason: string) {
  let left = amount
  for (const p of payments.filter((x) => x.reservationId === r.id && x.purpose === 'Deposit' && x.status === 'Succeeded')) {
    const part = Math.min(left, p.amount - p.refundedAmount)
    if (part <= 0) continue
    refund(p, part, reason)
    left -= part
  }
  r.refundAmount += amount - left
}

/** Applies a gateway success once (FR-PAY-09: a second success for the same thing is refunded). */
function applyPayment(payment: PaymentDTO): PaymentCallbackResultDTO {
  if (payment.status !== 'Pending' && payment.status !== 'Expired')
    return { signatureValid: true, outcome: 'AlreadyProcessed', message: null, payment }
  payment.status = 'Succeeded'
  payment.paidAt = iso(now())
  payment.payUrl = null
  if (payment.purpose === 'Deposit') {
    const r = reservations.find((x) => x.id === payment.reservationId)
    if (r && r.status === 'PendingDeposit') {
      r.status = 'Confirmed'
      r.confirmedAt = iso(now())
      return { signatureValid: true, outcome: 'Applied', message: 'Giao dịch thành công', payment }
    }
    refund(payment, payment.amount, 'Hoàn cọc đến muộn / trùng')
    if (r) r.refundAmount += payment.amount
    return { signatureValid: true, outcome: 'Refunded', message: 'Thanh toán đến muộn hoặc bị trùng nên đã được hoàn tự động.', payment }
  }
  const s = sessions.find((x) => x.id === payment.sessionId)
  if (s && s.status === 'PendingPayment') {
    s.paidAmount += payment.amount
    s.status = 'Paid'
    if (payment.channel !== 'Lane') {
      s.exitWindowEndsAt = iso(now() + RULES.exitWindowMinutes * MINUTE)
      payment.exitWindowEndsAt = s.exitWindowEndsAt
      payment.exitPass = `exit.demo.${s.code}`
    }
    return { signatureValid: true, outcome: 'Applied', message: 'Giao dịch thành công', payment }
  }
  refund(payment, payment.amount, 'Hoàn thanh toán trùng')
  return { signatureValid: true, outcome: 'Refunded', message: 'Thanh toán trùng đã được hoàn tự động.', payment }
}

export const reservationMock = {
  mine: () =>
    mockResponse(() => {
      sweep()
      return reservations.map(refreshFlags).sort((a, b) => Date.parse(b.arrivalTime) - Date.parse(a.arrivalTime))
    }),

  get: (id: number) => mockResponse(() => (sweep(), refreshFlags(ownReservation(id)))),

  async create(request: CreateReservationRequest): Promise<ReservationDTO> {
    const vehicles = await profileMock.getVehicles()
    return mockResponse(() => {
      sweep()
      const vehicle = vehicles.find((v) => v.vehicleId === request.vehicleId)
      if (!vehicle) mockFail(400, 'Xe không thuộc tài khoản của bạn. This vehicle is not on your account.')
      if (/motor/i.test(vehicle.vehicleType)) mockFail(400, 'Loại xe này không được đặt chỗ trước (BR-01). This vehicle type cannot be reserved.')
      const arrival = Date.parse(request.arrivalTime)
      checkArrival(arrival)
      const active = reservations.filter((r) => r.status === 'PendingDeposit' || r.status === 'Confirmed')
      if (active.length >= 2) mockFail(400, 'Mỗi tài khoản chỉ có tối đa 2 đặt chỗ hiệu lực. Reservation limit reached.')
      if (active.some((r) => r.vehicleId === vehicle.vehicleId)) mockFail(400, 'Xe này đã có một đặt chỗ hiệu lực. This vehicle already has an active reservation.')
      const slotId = Number(request.slotId)
      if (reservations.some((r) => r.lotKey === request.parkingLotId && r.slotId === slotId && (r.status === 'PendingDeposit' || r.status === 'Confirmed' || r.status === 'CheckedIn')))
        mockFail(409, 'Slot này vừa được người khác giữ chỗ. This slot was just taken by someone else.')

      const lot = findMockLot(request.parkingLotId)
      const created: MockReservation = {
        lotKey: request.parkingLotId,
        id: nextId(),
        code: code('RSV'),
        status: 'PendingDeposit',
        parkingLotId: lotNumber(request.parkingLotId),
        parkingLotName: lot?.name ?? 'Demo lot',
        zoneId: Math.floor(slotId / 1000) + 1,
        zoneName: `Level ${Math.floor(slotId / 1000) + 1} · Cars`,
        slotId,
        slotCode: slotCode(slotId),
        vehicleId: vehicle.vehicleId,
        plateNumber: vehicle.licensePlate,
        arrivalTime: iso(arrival),
        checkInFrom: iso(arrival - RULES.earlyMinutes * MINUTE),
        checkInUntil: iso(arrival + RULES.holdMinutes * MINUTE),
        depositAmount: RULES.deposit,
        depositDueAt: iso(now() + RULES.depositMinutes * MINUTE),
        refundAmount: 0,
        cancelReason: null,
        cancelledBy: null,
        createdAt: iso(now()),
        confirmedAt: null,
        canChange: false,
        canCancel: true,
        refundIfCancelledNow: 0,
        pendingPayment: null,
      }
      reservations.push(created)
      return refreshFlags(created)
    })
  },

  update: (id: number, request: UpdateReservationRequest) =>
    mockResponse(() => {
      const r = refreshFlags(ownReservation(id))
      if (!r.canChange) mockFail(400, 'Đã quá hạn đổi hoặc đặt chỗ chưa xác nhận. This reservation can no longer be changed.')
      if (request.arrivalTime) {
        const arrival = Date.parse(request.arrivalTime)
        checkArrival(arrival)
        r.arrivalTime = iso(arrival)
        r.checkInFrom = iso(arrival - RULES.earlyMinutes * MINUTE)
        r.checkInUntil = iso(arrival + RULES.holdMinutes * MINUTE)
      }
      if (request.slotId) {
        r.slotId = Number(request.slotId)
        r.slotCode = slotCode(r.slotId)
      }
      return refreshFlags(r)
    }),

  cancel: (id: number, reason?: string) =>
    mockResponse(() => {
      const r = refreshFlags(ownReservation(id))
      if (r.status === 'PendingDeposit') {
        r.status = 'Expired'
      } else if (r.status === 'Confirmed') {
        const amount = r.refundIfCancelledNow
        r.status = 'Cancelled'
        refundDeposit(r, amount, 'Hoàn cọc hủy')
      } else {
        mockFail(400, 'Không thể hủy đặt chỗ này. This reservation can no longer be cancelled.')
      }
      r.cancelReason = reason || 'Khách hủy'
      r.cancelledBy = 'User'
      return refreshFlags(r)
    }),

  qr: (id: number) =>
    mockResponse<ReservationQrDTO>(() => {
      const r = ownReservation(id)
      if (r.status !== 'Confirmed') mockFail(400, 'Mã QR chỉ có sau khi đặt cọc thành công. The QR code is issued once the deposit is paid.')
      return { reservationId: r.id, code: r.code, qrPayload: `rsv.demo.${r.id}`, validFrom: r.checkInFrom, validUntil: r.checkInUntil }
    }),

  payDeposit: (id: number, provider: PaymentProvider) =>
    mockResponse(() => {
      const r = refreshFlags(ownReservation(id))
      if (r.status !== 'PendingDeposit') mockFail(400, 'Đặt chỗ không còn chờ cọc. This reservation is not waiting for a deposit.')
      const payment = newPayment(r.depositAmount, provider, 'Deposit', 'App', { reservationId: r.id })
      r.pendingPayment = payment
      return payment
    }),
}

/* ---------------------------------------------------------------- payments */

export const paymentMock = {
  /** The demo return page: ?demo=1&code=… means the simulated gateway took the money. */
  handleReturn: (_provider: string, params: Record<string, string>) =>
    mockResponse<PaymentCallbackResultDTO>(() => {
      const payment = payments.find((p) => p.code === params.code)
      if (!payment) return { signatureValid: false, outcome: 'NotFound', message: 'Không tìm thấy giao dịch demo.', payment: null }
      if (params.cancel === '1') {
        payment.status = 'Failed'
        return { signatureValid: true, outcome: 'Failed', message: 'Khách hàng hủy giao dịch', payment }
      }
      return applyPayment(payment)
    }),

  get: (id: number) =>
    mockResponse(() => {
      const payment = payments.find((p) => p.id === id)
      if (!payment) mockFail(404, 'Không tìm thấy giao dịch. Payment not found.')
      return payment
    }),

  /** FR-PAY-08 "check with the gateway": the demo gateway always reports the QR as paid. */
  check: (id: number) =>
    mockResponse(() => {
      const payment = payments.find((p) => p.id === id)
      if (!payment) mockFail(404, 'Không tìm thấy giao dịch. Payment not found.')
      return applyPayment(payment)
    }),
}

/* ---------------------------------------------------------------- gate */

const CAPACITY = { car: 40, motorbike: 20 }

function seedLot(lotKey: string) {
  if (sessions.some((s) => s.lotKey === lotKey)) return
  const base = { lotKey, parkingLotId: lotNumber(lotKey), entryGateId: 1, hasPlate: true, zoneId: null, zoneName: null, slotId: null, slotCode: null, reservationId: null, reservationCode: null, isCustomerAccount: false, paidAmount: 0, finalFee: 0, exitWindowEndsAt: null, exitTime: null, isManualEntry: false, isLostTicket: false, plateMismatch: false, isOverdue: false, zeroFeeReason: null, overrideNote: null }
  const seed: [string, number, 'car' | 'motorbike'][] = [
    ['51A-888.68', 140, 'car'],
    ['30G-456.12', 47, 'car'],
    ['59-X1 234.56', 20, 'motorbike'],
  ]
  for (const [plate, minutesAgo, kind] of seed) {
    const id = nextId()
    const entry = now() - minutesAgo * MINUTE
    sessions.push({ ...base, id, code: code('SS'), status: 'Active', sessionType: 'WalkIn', plateNumber: plate, vehicleTypeId: kind === 'car' ? 1 : 3, vehicleTypeName: kind === 'car' ? 'Car' : 'Motorbike', entryTime: iso(entry), entryConfirmedAt: iso(entry), vehicleKind: kind })
  }
}

function lotSessions(lotKey: string) {
  seedLot(lotKey)
  sweep()
  return sessions.filter((s) => s.lotKey === lotKey)
}

const inside = (s: MockSession) => ['Active', 'LostTicketPending', 'PendingPayment', 'Paid'].includes(s.status)
const open = (s: MockSession) => s.status === 'PendingEntry' || inside(s)

function findSession(id: number) {
  const s = sessions.find((x) => x.id === id)
  if (!s) mockFail(404, 'Không tìm thấy phiên gửi xe. Session not found.')
  return s
}

function counters(lotKey: string): ZoneCounterDTO[] {
  const list = lotSessions(lotKey).filter(inside)
  return (['motorbike', 'car'] as const).map((kind, i) => {
    const occupied = list.filter((s) => s.vehicleKind === kind).length
    const held = kind === 'car' ? reservations.filter((r) => r.lotKey === lotKey && r.status === 'Confirmed').length : 0
    const total = CAPACITY[kind]
    const available = Math.max(0, total - occupied - held)
    return { zoneId: i + 1, zoneCode: `L${i + 1}`, zoneName: `Level ${i + 1} · ${kind === 'car' ? 'Cars' : 'Motorbikes'}`, vehicleTypeId: kind === 'car' ? 1 : 3, totalCapacity: total, occupiedSpaces: occupied, availableSpaces: available, isFull: available <= 0 }
  })
}

/** Fee request at a payment point; with `mutate` the session moves like on the backend. */
function quote(s: MockSession, exitPlate: string | undefined, mutate: boolean): CheckoutQuoteDTO {
  const exitWindowMissed = Boolean(s.exitWindowEndsAt && now() > Date.parse(s.exitWindowEndsAt) && s.paidAmount > 0)
  const settled = s.status === 'Paid' && !exitWindowMissed
  const { minutes, fee, days } = s.sessionType === 'Whitelist' ? { minutes: 0, fee: 0, days: [] } : stayFee(s.vehicleKind, Date.parse(s.entryTime), now())
  const deposit = s.reservationId ? depositHeld(s.reservationId) : 0
  const lost = s.isLostTicket ? 100_000 : 0
  const late = exitWindowMissed ? RULES.exitWindowLateFee : 0
  const gross = settled ? s.finalFee : fee + lost + late
  const due = settled ? 0 : Math.max(0, gross - deposit - s.paidAmount)
  const depositApplied = Math.min(deposit, Math.max(0, gross - s.paidAmount))
  const zeroFeeReason = s.sessionType === 'Whitelist' ? 'Whitelist' : fee === 0 && !settled ? 'GracePeriod' : due === 0 && deposit > 0 && s.paidAmount === 0 ? 'CoveredByDeposit' : s.zeroFeeReason
  if (mutate && !settled) {
    if (s.status === 'Active' || s.status === 'Paid') s.status = 'PendingPayment'
    if (s.status === 'PendingPayment' && due === 0) {
      s.status = 'Paid'
      s.exitWindowEndsAt = null
    }
    s.finalFee = gross
    s.zeroFeeReason = zeroFeeReason
  }
  const alerts: GateAlertDTO[] = []
  if (!s.hasPlate) alerts.push({ code: 'PHOTO_CHECK_REQUIRED', message: 'Xe không biển số: đối chiếu ảnh vào – ra.', blocking: true, canOverride: true, relatedSessionId: null })
  else if (exitPlate && normalize(exitPlate) !== normalize(s.plateNumber)) {
    if (mutate) s.plateMismatch = true
    alerts.push({ code: 'PLATE_MISMATCH', message: `Biển số ra ${exitPlate} khác biển số vào ${s.plateNumber}.`, blocking: true, canOverride: true, relatedSessionId: null })
  }
  return {
    session: { ...s },
    durationMinutes: minutes,
    fee: settled ? s.finalFee : fee,
    lostTicketFee: lost,
    exitWindowLateFee: late,
    depositApplied,
    alreadyPaid: s.paidAmount,
    amountDue: Math.ceil(due / 1000) * 1000,
    depositRefund: deposit - depositApplied,
    zeroFeeReason,
    canOpenBarrier: due === 0 && !exitWindowMissed && alerts.every((a) => !a.blocking),
    alerts,
    days,
    pricingRuleId: null,
    pricingRuleVersion: null,
  }
}

const strip = ({ lotKey: _lot, vehicleKind: _kind, ...dto }: MockSession): ParkingSessionDTO => {
  void _lot
  void _kind
  return dto
}

export const gateMock = {
  gates: (lotId: string) =>
    mockResponse<GateDTO[]>(() => {
      void lotId
      return [
        { id: 1, code: 'IN-1', name: 'Làn vào 1', direction: 'In' },
        { id: 2, code: 'OUT-1', name: 'Làn ra 1', direction: 'Out' },
      ]
    }),

  counters: (lotId: string) => mockResponse(() => counters(lotId)),

  sessions: (lotId: string, status?: string) =>
    mockResponse(() =>
      lotSessions(lotId)
        .filter((s) => (status ? s.status === status : open(s)))
        .sort((a, b) => Date.parse(b.entryTime) - Date.parse(a.entryTime))
        .map(strip),
    ),

  lookup: (lotId: string, query: { plate?: string; code?: string }) =>
    mockResponse(() => {
      const list = lotSessions(lotId).filter(open)
      const found = query.code ? list.find((s) => s.code === query.code?.trim()) : list.find((s) => normalize(s.plateNumber) === normalize(query.plate))
      if (!found) mockFail(404, 'Không có phiên gửi xe đang mở. No open session found.')
      return strip(found)
    }),

  checkIn: (lotId: string, request: CheckInRequest) =>
    mockResponse<CheckInResultDTO>(() => {
      const list = lotSessions(lotId)
      const alerts: GateAlertDTO[] = []
      const overrides: string[] = []
      const alert = (codeName: string, message: string, cleared = false, canOverride = true, relatedSessionId: number | null = null) => {
        if (cleared) overrides.push(codeName)
        alerts.push({ code: codeName, message, blocking: !cleared, canOverride, relatedSessionId })
      }
      const plate = request.noPlate ? '' : (request.plateNumber ?? '').trim().toUpperCase()
      const key = normalize(plate)
      if (!request.noPlate && !key) alert('PLATE_REQUIRED', 'Chưa có biển số; nhập tay hoặc chọn xe không biển số.', false, false)
      const confidence = request.anprConfidence == null ? 1 : request.anprConfidence > 1 ? request.anprConfidence / 100 : request.anprConfidence
      if (!request.noPlate && confidence < RULES.anprThreshold)
        alert('LOW_CONFIDENCE', `ANPR chỉ tin cậy ${Math.round(confidence * 100)}%; kiểm tra lại biển số.`, request.plateConfirmed)

      let reservation: MockReservation | undefined
      if (!request.ignoreReservation && (request.reservationQr || request.reservationCode)) {
        const id = request.reservationQr?.startsWith('rsv.demo.') ? Number(request.reservationQr.slice(9)) : NaN
        reservation = reservations.find((r) => r.id === id || r.code === request.reservationCode?.trim())
        if (!reservation || reservation.status !== 'Confirmed') {
          alert('RESERVATION_INVALID', 'Không tìm thấy đặt chỗ hợp lệ. Enter as walk-in instead.', false, true)
          reservation = undefined
        } else if (now() < Date.parse(reservation.checkInFrom) || now() > Date.parse(reservation.checkInUntil)) {
          alert('RESERVATION_OUTSIDE_WINDOW', 'Ngoài cửa sổ đến: chờ hoặc vào như vãng lai (đặt chỗ vẫn giữ).', false, true)
          reservation = undefined
        } else if (key && normalize(reservation.plateNumber ?? '') !== key) {
          alert('RESERVATION_PLATE_MISMATCH', 'Biển số không khớp đặt chỗ; xác minh xe cùng tài khoản, cùng loại.', request.allowPlateMismatch)
        }
      }

      if (key) {
        const dup = list.find((s) => open(s) && s.hasPlate && normalize(s.plateNumber) === key)
        if (dup) alert('DUPLICATE_SESSION', `Biển số đang có phiên mở ${dup.code}.`, false, false, dup.id)
        if (DEMO_BLACKLIST[key]) alert('BLACKLISTED', `Biển số trong Blacklist: ${DEMO_BLACKLIST[key]}.`, request.allowBlacklisted)
      }

      const kind: 'car' | 'motorbike' = request.noPlate || request.vehicleTypeId === 3 ? 'motorbike' : 'car'
      const zone = counters(lotId).find((c) => (kind === 'car' ? c.vehicleTypeId === 1 : c.vehicleTypeId === 3))
      if (!reservation && zone?.isFull) alert('ZONE_FULL', `${zone.zoneName} đã hết chỗ.`, request.allowWhenFull)

      if (overrides.length > 0 && !request.overrideReason?.trim()) mockFail(400, 'Cho xe vào khi có cảnh báo phải ghi lý do. Give a reason for the override.')
      if (alerts.some((a) => a.blocking)) return { outcome: 'Blocked', barrierOpen: false, alerts, session: null, ticket: null }

      const session: MockSession = {
        lotKey: lotId,
        vehicleKind: kind,
        id: nextId(),
        code: code('SS'),
        parkingLotId: lotNumber(lotId),
        status: 'PendingEntry',
        sessionType: reservation ? 'Reservation' : 'WalkIn',
        plateNumber: plate,
        hasPlate: !request.noPlate,
        vehicleTypeId: kind === 'car' ? 1 : 3,
        vehicleTypeName: kind === 'car' ? 'Car' : 'Motorbike',
        entryTime: iso(now()),
        entryConfirmedAt: null,
        entryGateId: request.gateId ?? 1,
        zoneId: reservation?.zoneId ?? zone?.zoneId ?? null,
        zoneName: reservation?.zoneName ?? zone?.zoneName ?? null,
        slotId: reservation?.slotId ?? null,
        slotCode: reservation?.slotCode ?? null,
        reservationId: reservation?.id ?? null,
        reservationCode: reservation?.code ?? null,
        isCustomerAccount: Boolean(reservation),
        paidAmount: 0,
        finalFee: 0,
        exitWindowEndsAt: null,
        exitTime: null,
        isManualEntry: Boolean(request.isManual),
        isLostTicket: false,
        plateMismatch: false,
        isOverdue: false,
        zeroFeeReason: null,
        overrideNote: overrides.length ? `${overrides.join('; ')}: ${request.overrideReason}` : null,
      }
      sessions.push(session)
      return { outcome: 'Created', barrierOpen: true, alerts, session: strip(session), ticket: `tkt.demo.${session.code}` }
    }),

  confirmEntry: (sessionId: number) =>
    mockResponse(() => {
      const s = findSession(sessionId)
      if (s.status !== 'PendingEntry') mockFail(400, `Phiên đang ${s.status}.`)
      s.status = 'Active'
      s.entryConfirmedAt = iso(now())
      const r = reservations.find((x) => x.id === s.reservationId)
      if (r && r.status === 'Confirmed') r.status = 'CheckedIn'
      return strip(s)
    }),

  cancelEntry: (sessionId: number) =>
    mockResponse(() => {
      const s = findSession(sessionId)
      if (s.status !== 'PendingEntry') mockFail(400, `Phiên đang ${s.status}.`)
      s.status = 'Cancelled'
      return strip(s)
    }),

  quote: (sessionId: number, plateNumber?: string) => mockResponse(() => quote(findSession(sessionId), plateNumber, true)),

  cancelPayment: (sessionId: number) =>
    mockResponse(() => {
      const s = findSession(sessionId)
      if (s.status !== 'PendingPayment') mockFail(400, 'Phiên không ở trạng thái chờ thanh toán.')
      s.status = 'Active'
      return strip(s)
    }),

  payCash: (sessionId: number, amount: number, prepaid: boolean) =>
    mockResponse(() => {
      const s = findSession(sessionId)
      const q = quote(s, undefined, true)
      if (q.amountDue <= 0) mockFail(400, 'Phiên đã được thanh toán hoặc phí 0đ. Nothing is due.')
      if (amount < q.amountDue) mockFail(400, `Số tiền nhận ít hơn số phải trả (${q.amountDue}đ).`)
      const payment = newPayment(q.amountDue, 'VNPay', 'ParkingFee', prepaid ? 'Kiosk' : 'Lane', { sessionId: s.id })
      payment.provider = null
      payment.method = 'Cash'
      return applyPayment(payment).payment!
    }),

  payOnline: (sessionId: number, provider: PaymentProvider, prepaid: boolean) =>
    mockResponse(() => {
      const s = findSession(sessionId)
      const q = quote(s, undefined, true)
      if (q.amountDue <= 0) mockFail(400, 'Phiên đã được thanh toán hoặc phí 0đ. Nothing is due.')
      return newPayment(q.amountDue, provider, 'ParkingFee', prepaid ? 'Kiosk' : 'Lane', { sessionId: s.id })
    }),

  checkout: (sessionId: number, request: CheckoutRequest) =>
    mockResponse<CheckoutResultDTO>(() => {
      const s = findSession(sessionId)
      const q = quote(s, request.plateNumber, true)
      if (s.status !== 'Paid') mockFail(400, `Còn phải trả ${q.amountDue}đ.`)
      const left = q.alerts.filter((a) => a.blocking && !(a.code === 'PLATE_MISMATCH' ? request.allowPlateMismatch : request.photoChecked))
      if (left.length) return { session: strip(s), barrierOpen: false, depositRefund: 0, alerts: left }
      s.status = 'Completed'
      s.exitTime = iso(now())
      let depositRefund = 0
      const r = reservations.find((x) => x.id === s.reservationId)
      if (r && r.status === 'CheckedIn') {
        r.status = 'Completed'
        depositRefund = q.depositRefund
        refundDeposit(r, depositRefund, 'Hoàn phần dư cọc')
      }
      return { session: strip(s), barrierOpen: true, depositRefund, alerts: [] }
    }),
}
