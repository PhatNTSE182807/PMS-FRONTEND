import { findMockLot, MOCK_PARKING_LOTS } from '@/mocks/parkingLots.mock'
import { profileMock } from '@/mocks/profile.mock'
import type {
  BookingMode,
  CheckInRequest,
  CheckInResultDTO,
  CheckoutQuoteDTO,
  CheckoutRequest,
  CheckoutResultDTO,
  CreateReservationRequest,
  CurrentSessionDTO,
  ExitPassDTO,
  GateAlertDTO,
  GateDTO,
  GateReservationLookupDTO,
  ParkingSessionDTO,
  PaymentCallbackResultDTO,
  PaymentDTO,
  PaymentProvider,
  ReservationDTO,
  ReservationQrDTO,
  UpdateReservationRequest,
  ZoneCounterDTO,
} from '@/types/operations.dto'
import type { ApproveGateRequestRequest, GateRequestDecisionDTO, GateRequestDTO, GateRequestKind } from '@/types/gateRequest.dto'
import { mockFail, mockResponse } from './mockApi'

/*
 * In-browser stand-in for the reservation, gate and payment APIs, following the same SRS rules
 * (BR-01..BR-11, BR-22) on a smaller scale. Payments never leave the browser: the "gateway" is the
 * app's own /payment/return page with ?demo=1, which reports the payment as paid.
 */

const MINUTE = 60_000
const RULES = {
  maxLeadDays: 30,
  minStayMinutes: 30,
  maxStayHours: 24,
  depositMinutes: 10,
  earlyMinutes: 15,
  /** Hold after arrival for a booking without a deposit. */
  holdMinutes: 15,
  /** Hold after arrival for a booking with a paid deposit. */
  depositHoldMinutes: 30,
  cancelRefundMinutes: 30,
  deposit: 30_000,
  /** No free period: the first block is owed from entry (team change to BR-22). */
  graceMinutes: 0,
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
const DEMO_BLACKLIST: Record<string, string> = { '29A66666': 'Unpaid parking fees (demo)' }

const iso = (t: number) => new Date(t).toISOString()
const now = () => Date.now()
const normalize = (plate: string | undefined) => (plate ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
const lotNumber = (lotId: string) => Number(lotId.replace(/\D/g, '')) || 1
let sequence = 1000
const nextId = () => ++sequence
const code = (prefix: string) => `${prefix}${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`

interface MockReservation extends ReservationDTO {
  lotKey: string
  /** Another customer's booking, seeded for the Staff lane demo: never shown to the demo driver. */
  staffDemo?: boolean
}
interface MockSession extends ParkingSessionDTO {
  lotKey: string
  vehicleKind: 'car' | 'motorbike'
  /** Parked by the signed-in demo driver (shows on the customer dashboard). */
  ownedByCustomer?: boolean
}

/** Session fields of a vehicle with no lost-ticket case. */
const NO_LOST_TICKET_CASE = { lostTicketStatus: null, lostTicketReportedBy: null, lostTicketReportedAt: null, lostTicketReason: null, lostTicketDecisionNote: null }

const reservations: MockReservation[] = []
/** The demo driver's own bookings (the Staff demo seeds other customers' bookings in the same list). */
const customerReservations = () => reservations.filter((r) => !r.staffDemo)
const sessions: MockSession[] = []
const payments: PaymentDTO[] = []

/* ---------------------------------------------------------------- fees (BR-09, BR-10, BR-22) */

function stayFee(kind: 'car' | 'motorbike', entry: number, exit: number) {
  const minutes = Math.max(0, Math.ceil((exit - entry) / MINUTE))
  // Leaving the minute of entry still costs the first block
  if (exit <= entry) exit = entry + MINUTE
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
      r.cancelReason = 'Deposit not paid in time'
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
  const r = customerReservations().find((x) => x.id === id)
  if (!r) mockFail(404, 'Reservation not found.')
  return r
}

function checkArrival(arrival: number) {
  if (Number.isNaN(arrival) || arrival <= now()) mockFail(400, 'The arrival time must be in the future.')
  if (arrival > now() + RULES.maxLeadDays * 24 * 60 * MINUTE) mockFail(400, `Arrival can be at most ${RULES.maxLeadDays} days ahead.`)
}

/** Same rules as the API: a Scheduled booking needs a departure 30 min to 24 h after arrival; pay-as-you-go has none. */
function checkDeparture(mode: BookingMode, arrival: number, departureIso: string | null | undefined): number | null {
  if (mode === 'PayAsYouGo') return null
  const departure = departureIso ? Date.parse(departureIso) : NaN
  if (Number.isNaN(departure)) mockFail(400, 'Pick a departure time for a scheduled booking, or book pay-as-you-go.')
  if (departure < arrival + RULES.minStayMinutes * MINUTE) mockFail(400, `The departure must be at least ${RULES.minStayMinutes} minutes after arrival.`)
  if (departure > arrival + RULES.maxStayHours * 60 * MINUTE)
    mockFail(400, `A scheduled booking can last at most ${RULES.maxStayHours} hours; book pay-as-you-go for longer stays.`)
  return departure
}

const activeStatus = (r: ReservationDTO) => r.status === 'PendingDeposit' || r.status === 'Confirmed' || r.status === 'CheckedIn'

/** NFR-15 over time: a window runs from check-in opening to the departure; pay-as-you-go is open-ended. */
function checkSlotFree(lotKey: string, slotId: number, arrival: number, departure: number | null, except?: number) {
  const from = arrival - RULES.earlyMinutes * MINUTE
  for (const r of reservations) {
    if (r.id === except || r.lotKey !== lotKey || r.slotId !== slotId || !activeStatus(r)) continue
    const otherFrom = Date.parse(r.arrivalTime) - RULES.earlyMinutes * MINUTE
    const otherTo = r.bookingMode === 'Scheduled' && r.departureTime ? Date.parse(r.departureTime) : null
    if ((departure === null || otherFrom < departure) && (otherTo === null || from < otherTo))
      mockFail(409, 'This bay is already booked for part of that time. Pick another time or bay.')
  }
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
      return { signatureValid: true, outcome: 'Applied', message: 'Transaction successful', payment }
    }
    refund(payment, payment.amount, 'Late or duplicate deposit refund')
    if (r) r.refundAmount += payment.amount
    return { signatureValid: true, outcome: 'Refunded', message: 'The payment came late or twice and was refunded.', payment }
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
    return { signatureValid: true, outcome: 'Applied', message: 'Transaction successful', payment }
  }
  refund(payment, payment.amount, 'Duplicate payment refund')
  return { signatureValid: true, outcome: 'Refunded', message: 'The duplicate payment was refunded automatically.', payment }
}

export const reservationMock = {
  mine: () =>
    mockResponse(() => {
      sweep()
      return customerReservations().map(refreshFlags).sort((a, b) => Date.parse(b.arrivalTime) - Date.parse(a.arrivalTime))
    }),

  forLot: (lotId: string, from: string, to: string) =>
    mockResponse(() => {
      sweep()
      const start = Date.parse(from)
      const end = Date.parse(to)
      return reservations
        .filter((r) => (r.lotKey === lotId || String(r.parkingLotId) === lotId) && Date.parse(r.arrivalTime) >= start && Date.parse(r.arrivalTime) <= end)
        .map(refreshFlags)
        .sort((a, b) => Date.parse(a.arrivalTime) - Date.parse(b.arrivalTime))
    }),

  get: (id: number) => mockResponse(() => (sweep(), refreshFlags(ownReservation(id)))),

  async create(request: CreateReservationRequest): Promise<ReservationDTO> {
    const vehicles = await profileMock.getVehicles()
    return mockResponse(() => {
      sweep()
      const vehicle = vehicles.find((v) => v.vehicleId === request.vehicleId)
      if (!vehicle) mockFail(400, 'This vehicle is not on your account.')
      // Like the API: a motorbike claims the bay for right now, with no deposit and pay-as-you-go
      const instant = /motor/i.test(vehicle.vehicleType)
      const arrival = instant ? Math.floor(now() / MINUTE) * MINUTE : Date.parse(request.arrivalTime)
      if (!instant) checkArrival(arrival)
      const mode: BookingMode = instant ? 'PayAsYouGo' : (request.bookingMode ?? 'PayAsYouGo')
      const departure = checkDeparture(mode, arrival, request.departureTime)
      // BR-07: a checked-in booking still counts, and the vehicle is matched by plate
      const active = customerReservations().filter((r) => r.status === 'PendingDeposit' || r.status === 'Confirmed' || r.status === 'CheckedIn')
      if (active.length >= 2) mockFail(400, 'Each account can have at most 2 active reservations.')
      if (active.some((r) => r.vehicleId === vehicle.vehicleId || normalize(r.plateNumber ?? '') === normalize(vehicle.licensePlate)))
        mockFail(400, `Vehicle ${vehicle.licensePlate} already has an active reservation.`)
      const slotId = Number(request.slotId)
      checkSlotFree(request.parkingLotId, slotId, arrival, departure)

      const lot = findMockLot(request.parkingLotId)
      // Like the API: with a deposit the booking waits for the payment and is held 30 minutes after
      // arrival; without one it is confirmed at once and held 15 minutes
      const withDeposit = (request.payDeposit ?? true) && !instant
      const holdMinutes = withDeposit ? RULES.depositHoldMinutes : RULES.holdMinutes
      const created: MockReservation = {
        lotKey: request.parkingLotId,
        id: nextId(),
        code: code('RSV'),
        status: withDeposit ? 'PendingDeposit' : 'Confirmed',
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
        checkInUntil: iso(arrival + holdMinutes * MINUTE),
        depositAmount: withDeposit ? RULES.deposit : 0,
        hasDeposit: withDeposit,
        holdMinutes,
        depositDueAt: withDeposit ? iso(now() + RULES.depositMinutes * MINUTE) : null,
        refundAmount: 0,
        cancelReason: null,
        cancelledBy: null,
        createdAt: iso(now()),
        confirmedAt: withDeposit ? null : iso(now()),
        canChange: false,
        canCancel: true,
        refundIfCancelledNow: 0,
        pendingPayment: null,
        parkingLotAddress: lot?.address ?? null,
        parkingLotDistrict: null,
        vehicleLabel: [vehicle.brand, vehicle.model].filter(Boolean).join(' '),
        bookingMode: mode,
        departureTime: departure === null ? null : iso(departure),
        // Like the API: the bay is locked two hours before arrival
        isSlotHeld: arrival - 120 * MINUTE <= now(),
      }
      reservations.push(created)
      return refreshFlags(created)
    })
  },

  update: (id: number, request: UpdateReservationRequest) =>
    mockResponse(() => {
      const r = refreshFlags(ownReservation(id))
      if (!r.canChange) mockFail(400, 'This reservation can no longer be changed.')
      const arrival = request.arrivalTime ? Date.parse(request.arrivalTime) : Date.parse(r.arrivalTime)
      checkArrival(arrival)
      const mode: BookingMode = request.bookingMode ?? r.bookingMode
      const departure = checkDeparture(mode, arrival, request.departureTime ?? r.departureTime)
      const slotId = request.slotId ? Number(request.slotId) : (r.slotId ?? 0)
      checkSlotFree(r.lotKey, slotId, arrival, departure, r.id)

      r.arrivalTime = iso(arrival)
      r.checkInFrom = iso(arrival - RULES.earlyMinutes * MINUTE)
      // Keep the hold length of the booking type
      r.checkInUntil = iso(arrival + r.holdMinutes * MINUTE)
      r.bookingMode = mode
      r.departureTime = departure === null ? null : iso(departure)
      r.isSlotHeld = arrival - 120 * MINUTE <= now()
      if (request.slotId) {
        r.slotId = slotId
        r.slotCode = slotCode(slotId)
      }
      return refreshFlags(r)
    }),

  /** The soonest booking that has not started. */
  upcoming: () =>
    mockResponse<ReservationDTO | null>(() => {
      sweep()
      const next = customerReservations()
        .filter((r) => r.status === 'PendingDeposit' || r.status === 'Confirmed')
        .sort((a, b) => Date.parse(a.arrivalTime) - Date.parse(b.arrivalTime))[0]
      return next ? refreshFlags(next) : null
    }),

  cancel: (id: number, reason?: string) =>
    mockResponse(() => {
      const r = refreshFlags(ownReservation(id))
      if (r.status === 'PendingDeposit') {
        r.status = 'Expired'
      } else if (r.status === 'Confirmed') {
        const amount = r.refundIfCancelledNow
        r.status = 'Cancelled'
        refundDeposit(r, amount, 'Cancellation refund')
      } else {
        mockFail(400, 'This reservation can no longer be cancelled.')
      }
      r.cancelReason = reason || 'Cancelled by the customer'
      r.cancelledBy = 'User'
      return refreshFlags(r)
    }),

  qr: (id: number) =>
    mockResponse<ReservationQrDTO>(() => {
      const r = ownReservation(id)
      if (r.status !== 'Confirmed') mockFail(400, 'The QR code is issued once the deposit is paid.')
      return { reservationId: r.id, code: r.code, qrPayload: `rsv.demo.${r.id}`, validFrom: r.checkInFrom, validUntil: r.checkInUntil }
    }),

  payDeposit: (id: number, provider: PaymentProvider) =>
    mockResponse(() => {
      const r = refreshFlags(ownReservation(id))
      if (r.status !== 'PendingDeposit') mockFail(400, 'This reservation is not waiting for a deposit.')
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
      if (!payment) return { signatureValid: false, outcome: 'NotFound', message: 'Demo payment not found.', payment: null }
      if (params.cancel === '1') {
        payment.status = 'Failed'
        return { signatureValid: true, outcome: 'Failed', message: 'The customer cancelled the transaction', payment }
      }
      return applyPayment(payment)
    }),

  get: (id: number) =>
    mockResponse(() => {
      const payment = payments.find((p) => p.id === id)
      if (!payment) mockFail(404, 'Payment not found.')
      return payment
    }),

  /** FR-PAY-08 "check with the gateway": the demo gateway always reports the QR as paid. */
  check: (id: number) =>
    mockResponse(() => {
      const payment = payments.find((p) => p.id === id)
      if (!payment) mockFail(404, 'Payment not found.')
      return applyPayment(payment)
    }),
}

/* ---------------------------------------------------------------- gate */

const CAPACITY = { car: 40, motorbike: 20 }

function seedLot(lotKey: string) {
  if (sessions.some((s) => s.lotKey === lotKey && !s.ownedByCustomer)) return
  const base = { lotKey, parkingLotId: lotNumber(lotKey), entryGateId: 1, hasPlate: true, zoneId: null, zoneName: null, slotId: null, slotCode: null, reservationId: null, reservationCode: null, isCustomerAccount: false, paidAmount: 0, finalFee: 0, exitWindowEndsAt: null, exitTime: null, isManualEntry: false, isLostTicket: false, ...NO_LOST_TICKET_CASE, plateMismatch: false, isOverdue: false, zeroFeeReason: null, overrideNote: null }
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
  if (!s) mockFail(404, 'Session not found.')
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
  const zeroFeeReason = s.sessionType === 'Whitelist' ? 'Whitelist' : due === 0 && deposit > 0 && s.paidAmount === 0 ? 'CoveredByDeposit' : s.zeroFeeReason
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
  if (!s.hasPlate) alerts.push({ code: 'PHOTO_CHECK_REQUIRED', message: 'Plate-less vehicle: compare the entry and exit photos.', blocking: true, canOverride: true, relatedSessionId: null })
  else if (exitPlate && normalize(exitPlate) !== normalize(s.plateNumber)) {
    if (mutate) s.plateMismatch = true
    alerts.push({ code: 'PLATE_MISMATCH', message: `Exit plate ${exitPlate} differs from entry plate ${s.plateNumber}.`, blocking: true, canOverride: true, relatedSessionId: null })
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

const strip = ({ lotKey: _lot, vehicleKind: _kind, ownedByCustomer: _own, ...dto }: MockSession): ParkingSessionDTO => {
  void _lot
  void _kind
  void _own
  return dto
}

export const gateMock = {
  gates: (lotId: string) =>
    mockResponse<GateDTO[]>(() => {
      void lotId
      return [
        { id: 1, code: 'IN-1', name: 'Entry lane 1', direction: 'In' },
        { id: 2, code: 'OUT-1', name: 'Exit lane 1', direction: 'Out' },
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
      if (!found) mockFail(404, 'No open session found.')
      return strip(found)
    }),

  checkIn: (lotId: string, request: CheckInRequest) =>
    mockResponse<CheckInResultDTO>(() => {
      const alerts: GateAlertDTO[] = []
      const overrides: string[] = []
      const alert = (codeName: string, message: string, cleared = false, canOverride = true, relatedSessionId: number | null = null) => {
        if (cleared) overrides.push(codeName)
        alerts.push({ code: codeName, message, blocking: !cleared, canOverride, relatedSessionId })
      }
      const plate = request.noPlate ? '' : (request.plateNumber ?? '').trim().toUpperCase()
      const key = normalize(plate)
      if (!request.noPlate && !key) alert('PLATE_REQUIRED', 'Enter the plate or mark the vehicle as plate-less.', false, false)
      if (request.noPlate && !request.noPlateReason?.trim()) alert('NO_PLATE_REASON_REQUIRED', 'Give the reason the vehicle has no plate.', false, false)
      const confidence = request.anprConfidence == null ? 1 : request.anprConfidence > 1 ? request.anprConfidence / 100 : request.anprConfidence
      if (!request.noPlate && confidence < RULES.anprThreshold)
        alert('LOW_CONFIDENCE', `ANPR is only ${Math.round(confidence * 100)}% confident; check the plate.`, request.plateConfirmed)

      let reservation: MockReservation | undefined
      if (!request.ignoreReservation && (request.reservationQr || request.reservationCode)) {
        const id = request.reservationQr?.startsWith('rsv.demo.') ? Number(request.reservationQr.slice(9)) : NaN
        reservation = reservations.find((r) => r.id === id || r.code === request.reservationCode?.trim())
        if (!reservation || reservation.status !== 'Confirmed') {
          alert('RESERVATION_INVALID', reservation?.status === 'CheckedIn' ? 'This reservation has already checked in.' : 'Reservation not found or not confirmed. Enter as walk-in instead.', false, true)
          reservation = undefined
        } else if (now() < Date.parse(reservation.checkInFrom) || now() > Date.parse(reservation.checkInUntil)) {
          alert('RESERVATION_OUTSIDE_WINDOW', 'Outside the check-in window: wait, or enter as walk-in (the booking is kept).', false, true)
          reservation = undefined
        } else if (key && normalize(reservation.plateNumber ?? '') !== key) {
          alert('RESERVATION_PLATE_MISMATCH', 'The plate differs from the booking; verify it is a vehicle of the same account and type.', request.allowPlateMismatch)
        }
      }

      // One vehicle is parked in one place: check every lot, by the typed plate and the booked one
      const bookedKey = normalize(reservation?.plateNumber ?? '')
      if (key || bookedKey) {
        const dup = sessions.find((s) => open(s) && s.hasPlate && [key, bookedKey].filter(Boolean).includes(normalize(s.plateNumber)))
        if (dup) alert('DUPLICATE_SESSION', `This vehicle is already parked (open session ${dup.code}).`, false, false, dup.id)
        if (key && DEMO_BLACKLIST[key]) alert('BLACKLISTED', `Blacklisted plate: ${DEMO_BLACKLIST[key]}.`, request.allowBlacklisted)
      }

      const kind: 'car' | 'motorbike' = request.noPlate || request.vehicleTypeId === 3 ? 'motorbike' : 'car'
      const zone = counters(lotId).find((c) => (kind === 'car' ? c.vehicleTypeId === 1 : c.vehicleTypeId === 3))
      if (!reservation && zone?.isFull) alert('ZONE_FULL', `${zone.zoneName} is full.`, request.allowWhenFull)

      if (overrides.length > 0 && !request.overrideReason?.trim()) mockFail(400, 'Give a reason for the override.')
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
        ...NO_LOST_TICKET_CASE,
        plateMismatch: false,
        isOverdue: false,
        zeroFeeReason: null,
        overrideNote: overrides.length ? `${overrides.join('; ')}: ${request.overrideReason}` : null,
      }
      sessions.push(session)
      return { outcome: 'Created', barrierOpen: true, alerts, session: strip(session), ticket: `tkt.demo.${session.code}` }
    }),

  /** Entry lane: the booking behind a scanned QR or typed code, with the booked vehicle. */
  async lookupReservation(lotId: string, query: { code?: string; qr?: string; plate?: string }): Promise<GateReservationLookupDTO> {
    const vehicles = await profileMock.getVehicles()
    return mockResponse(() => {
      sweep()
      const id = query.qr?.trim().startsWith('rsv.demo.') ? Number(query.qr.trim().slice(9)) : NaN
      const wanted = query.code?.trim().toUpperCase()
      const typedPlate = normalize(query.plate ?? '')
      if (!query.qr?.trim() && !wanted && !typedPlate) mockFail(400, 'Scan the reservation QR, type its code or type the plate.')
      if (query.qr?.trim() && Number.isNaN(id)) mockFail(400, 'This reservation QR is not genuine.')
      const byPlate = !query.qr?.trim() && !wanted
        ? reservations
            .filter((x) => (x.lotKey === lotId || String(x.parkingLotId) === lotId) && normalize(x.plateNumber ?? '') === typedPlate)
            .sort((a, b) => Number(b.status === 'Confirmed') - Number(a.status === 'Confirmed'))[0]
        : undefined
      if (typedPlate && !query.qr?.trim() && !wanted && !byPlate) mockFail(404, 'No reservation found for this plate in this lot.')
      const r = byPlate ?? reservations.find((x) => x.id === id || (wanted && x.code === wanted))
      if (!r) mockFail(404, 'Reservation not found.')
      if (r.lotKey !== lotId && String(r.parkingLotId) !== lotId) mockFail(400, 'This reservation is for another parking lot.')
      const vehicle = vehicles.find((v) => v.vehicleId === r.vehicleId)
      const parked = sessions.find((s) => open(s) && s.hasPlate && normalize(s.plateNumber) === normalize(r.plateNumber ?? ''))
      let problem: string | null = null
      if (r.status === 'CheckedIn') problem = 'This reservation has already checked in.'
      else if (r.status !== 'Confirmed') problem = `This reservation is ${r.status} and cannot check in.`
      else if (parked) problem = `This vehicle is already parked (session ${parked.code}).`
      else if (now() < Date.parse(r.checkInFrom)) problem = 'Too early: check-in has not opened yet.'
      else if (now() > Date.parse(r.checkInUntil)) problem = 'The hold has ended; the vehicle can only enter as a walk-in.'
      const { lotKey: _lot, ...reservation } = refreshFlags(r)
      return {
        reservation,
        vehicleTypeId: 1,
        vehicleTypeName: vehicle?.vehicleType ?? 'Car',
        vehicleBrand: vehicle?.brand ?? null,
        vehicleModel: vehicle?.model ?? null,
        vehicleColor: vehicle?.color ?? null,
        customerName: 'Demo customer',
        canCheckIn: problem == null,
        problem,
        openSessionCode: parked?.code ?? null,
      }
    })
  },

  confirmEntry: (sessionId: number) =>
    mockResponse(() => {
      const s = findSession(sessionId)
      if (s.status !== 'PendingEntry') mockFail(400, `The session is ${s.status}.`)
      s.status = 'Active'
      s.entryConfirmedAt = iso(now())
      const r = reservations.find((x) => x.id === s.reservationId)
      if (r && r.status === 'Confirmed') r.status = 'CheckedIn'
      return strip(s)
    }),

  cancelEntry: (sessionId: number) =>
    mockResponse(() => {
      const s = findSession(sessionId)
      if (s.status !== 'PendingEntry') mockFail(400, `The session is ${s.status}.`)
      s.status = 'Cancelled'
      return strip(s)
    }),

  quote: (sessionId: number, plateNumber?: string) => mockResponse(() => quote(findSession(sessionId), plateNumber, true)),

  cancelPayment: (sessionId: number) =>
    mockResponse(() => {
      const s = findSession(sessionId)
      if (s.status !== 'PendingPayment') mockFail(400, 'The session is not waiting for payment.')
      s.status = 'Active'
      return strip(s)
    }),

  payCash: (sessionId: number, amount: number, prepaid: boolean) =>
    mockResponse(() => {
      const s = findSession(sessionId)
      const q = quote(s, undefined, true)
      if (q.amountDue <= 0) mockFail(400, 'Nothing is due.')
      if (amount < q.amountDue) mockFail(400, `Received less than the ${q.amountDue} VND due.`)
      const payment = newPayment(q.amountDue, 'VNPay', 'ParkingFee', prepaid ? 'Kiosk' : 'Lane', { sessionId: s.id })
      payment.provider = null
      payment.method = 'Cash'
      return applyPayment(payment).payment!
    }),

  payOnline: (sessionId: number, provider: PaymentProvider, prepaid: boolean) =>
    mockResponse(() => {
      const s = findSession(sessionId)
      const q = quote(s, undefined, true)
      if (q.amountDue <= 0) mockFail(400, 'Nothing is due.')
      return newPayment(q.amountDue, provider, 'ParkingFee', prepaid ? 'Kiosk' : 'Lane', { sessionId: s.id })
    }),

  checkout: (sessionId: number, request: CheckoutRequest) =>
    mockResponse<CheckoutResultDTO>(() => {
      const s = findSession(sessionId)
      const q = quote(s, request.plateNumber, true)
      if (s.status !== 'Paid') mockFail(400, `${q.amountDue} VND is still due.`)
      const left = q.alerts.filter((a) => a.blocking && !(a.code === 'PLATE_MISMATCH' ? request.allowPlateMismatch : request.photoChecked))
      if (left.length) return { session: strip(s), barrierOpen: false, depositRefund: 0, alerts: left }
      s.status = 'Completed'
      s.exitTime = iso(now())
      let depositRefund = 0
      const r = reservations.find((x) => x.id === s.reservationId)
      if (r && r.status === 'CheckedIn') {
        r.status = 'Completed'
        depositRefund = q.depositRefund
        refundDeposit(r, depositRefund, 'Deposit remainder refund')
      }
      return { session: strip(s), barrierOpen: true, depositRefund, alerts: [] }
    }),
}

/* ---------------------------------------------------------------- the customer's parked vehicles */

/** The demo driver's default car is parked at the first demo lot (seeded once per page load). */
async function customerSessions(): Promise<MockSession[]> {
  if (!sessions.some((s) => s.ownedByCustomer)) {
    const vehicles = await profileMock.getVehicles()
    const car = vehicles.find((v) => v.isDefault) ?? vehicles[0]
    if (car) {
      const lot = MOCK_PARKING_LOTS[0]
      const entry = now() - 165 * MINUTE
      sessions.push({
        lotKey: lot.id, vehicleKind: 'car', ownedByCustomer: true,
        id: nextId(), code: code('SS'), parkingLotId: lotNumber(lot.id), status: 'Active', sessionType: 'WalkIn',
        plateNumber: car.licensePlate, hasPlate: true, vehicleTypeId: car.vehicleTypeId, vehicleTypeName: car.vehicleType,
        entryTime: iso(entry), entryConfirmedAt: iso(entry), entryGateId: 1, zoneId: 2, zoneName: 'Level 2 · Cars',
        slotId: 1014, slotCode: 'L2-14', reservationId: null, reservationCode: null, isCustomerAccount: true,
        paidAmount: 0, finalFee: 0, exitWindowEndsAt: null, exitTime: null, isManualEntry: false, isLostTicket: false,
        ...NO_LOST_TICKET_CASE, plateMismatch: false, isOverdue: false, zeroFeeReason: null, overrideNote: null,
      })
    }
  }
  return sessions.filter((s) => s.ownedByCustomer && inside(s))
}

function exitPassOf(s: MockSession, amountDue: number): ExitPassDTO {
  const prepaid = s.status === 'Paid' && Boolean(s.exitWindowEndsAt) && Date.parse(s.exitWindowEndsAt!) > now()
  return { sessionId: s.id, sessionCode: s.code, token: `exit.demo.${s.code}`, prepaid, validUntil: prepaid ? s.exitWindowEndsAt : null, amountDue: prepaid ? 0 : amountDue }
}

export const customerSessionMock = {
  async current(): Promise<CurrentSessionDTO[]> {
    const mine = await customerSessions()
    const vehicles = await profileMock.getVehicles()
    const labelOf = (plate: string) => {
      const v = vehicles.find((x) => normalize(x.licensePlate) === normalize(plate))
      return v ? [v.brand, v.model].filter(Boolean).join(' ') : null
    }
    return mockResponse(() =>
      mine.map((s) => {
        const q = quote(s, undefined, false)
        const lot = findMockLot(s.lotKey)
        const pendingPayment = payments.find((p) => p.sessionId === s.id && p.status === 'Pending' && p.payUrl) ?? null
        return {
          session: strip(s),
          lotName: lot?.name ?? 'Demo lot',
          lotAddress: lot?.address ?? null,
          lotDistrict: null,
          entryGateName: 'Entry lane 1',
          entryMethod: s.reservationId ? 'Reservation' : 'Plate',
          vehicleLabel: labelOf(s.plateNumber),
          bookingMode: null,
          plannedDeparture: null,
          elapsedMinutes: Math.floor((now() - Date.parse(s.entryTime)) / MINUTE),
          feeSoFar: q.fee + q.lostTicketFee + q.exitWindowLateFee,
          depositApplied: q.depositApplied,
          alreadyPaid: q.alreadyPaid,
          amountDue: q.amountDue,
          tariff: { graceMinutes: RULES.graceMinutes, blockMinutes: RULES.blockMinutes, blockPrice: RULES.carBlock, maxDailyFee: RULES.carDailyCap },
          pendingPayment,
          exitPass: exitPassOf(s, q.amountDue),
        } satisfies CurrentSessionDTO
      }),
    )
  },

  async exitPass(sessionId: number): Promise<ExitPassDTO> {
    await customerSessions()
    return mockResponse(() => {
      const s = findSession(sessionId)
      return exitPassOf(s, quote(s, undefined, false).amountDue)
    })
  },

  /** Like the API: a fee request, then a VNPay / MoMo payment from the app (an Exit Window once paid). */
  prepay: (sessionId: number, provider: PaymentProvider) =>
    mockResponse(() => {
      const s = findSession(sessionId)
      const q = quote(s, undefined, true)
      if (q.amountDue <= 0) mockFail(400, 'Nothing is due.')
      return newPayment(q.amountDue, provider, 'ParkingFee', 'App', { sessionId: s.id })
    }),
}

/* ---------------------------------------------------------------- check-in / check-out requests from the app */

interface MockGateRequest extends GateRequestDTO {
  lotKey: string
  /** Sent by the signed-in demo driver (the others are seeded for the Staff demo). */
  mine: boolean
}

const gateRequests: MockGateRequest[] = []
const seededRequestLots = new Set<string>()
/** In demo mode no Staff is watching the driver's requests: a simulated one handles them after this delay. */
const DEMO_STAFF_DELAY_MS = 15_000

/** Live fields (session status, payment, what would block the barrier) are read at every call, like the API. */
function requestDto(g: MockGateRequest): GateRequestDTO {
  const { lotKey: _lot, mine: _mine, ...dto } = g
  const r = reservations.find((x) => x.id === g.reservationId)
  const s = sessions.find((x) => x.id === g.sessionId)
  let problem: string | null = null
  if (g.status === 'Waiting') {
    if (g.kind === 'CheckIn') {
      if (!r) problem = 'The booking no longer exists.'
      else if (r.status !== 'Confirmed') problem = `The booking is ${r.status}.`
      else if (now() < Date.parse(r.checkInFrom)) problem = 'Too early: the check-in window has not opened.'
      else if (now() > Date.parse(r.checkInUntil)) problem = 'The hold has ended: only a walk-in entry is possible.'
    } else if (!s) problem = 'The parking session no longer exists.'
    else if (s.status !== 'Paid') problem = 'Not paid yet: take the fee at the POS before opening the barrier.'
    else if (s.exitWindowEndsAt && now() > Date.parse(s.exitWindowEndsAt)) problem = 'The exit window has passed: an extra fee is due.'
  }
  return {
    ...dto,
    reservationStatus: r?.status ?? dto.reservationStatus,
    slotCode: s?.slotCode ?? r?.slotCode ?? dto.slotCode,
    sessionCode: s?.code ?? null,
    sessionStatus: s?.status ?? null,
    entryTime: s?.entryTime ?? null,
    paidAmount: s?.paidAmount ?? 0,
    exitWindowEndsAt: s?.exitWindowEndsAt ?? null,
    problem,
  }
}

function newRequest(fields: Partial<MockGateRequest> & Pick<MockGateRequest, 'lotKey' | 'kind' | 'mine'>): MockGateRequest {
  const lot = findMockLot(fields.lotKey)
  const request: MockGateRequest = {
    id: nextId(), status: 'Waiting', parkingLotId: lotNumber(fields.lotKey), lotName: lot?.name ?? 'Demo lot',
    plateNumber: null, vehicleLabel: null, vehicleColor: null, vehicleTypeId: 1, vehicleTypeName: 'Car',
    customerName: null, customerPhone: null, reservationId: null, reservationCode: null, reservationStatus: null,
    arrivalTime: null, checkInFrom: null, checkInUntil: null, slotCode: null, sessionId: null, sessionCode: null,
    sessionStatus: null, entryTime: null, paidAmount: 0, exitWindowEndsAt: null, problem: null,
    createdAt: iso(now()), handledAt: null, note: null,
    ...fields,
  }
  gateRequests.push(request)
  return request
}

/** A confirmed booking inside its check-in window, for the seeded Staff queue. */
function seedBooking(lotKey: string, plate: string, label: string, arrivalInMinutes: number): MockReservation {
  const lot = findMockLot(lotKey)
  const arrival = now() + arrivalInMinutes * MINUTE
  const slotId = 2000 + (nextId() % 40)
  const r: MockReservation = {
    lotKey, id: nextId(), code: code('RSV'), status: 'Confirmed', parkingLotId: lotNumber(lotKey),
    parkingLotName: lot?.name ?? 'Demo lot', zoneId: 3, zoneName: 'Level 3 · Cars', slotId, slotCode: slotCode(slotId),
    vehicleId: `demo-${normalize(plate)}`, plateNumber: plate, arrivalTime: iso(arrival),
    checkInFrom: iso(arrival - RULES.earlyMinutes * MINUTE), checkInUntil: iso(arrival + RULES.depositHoldMinutes * MINUTE),
    depositAmount: RULES.deposit, hasDeposit: true, holdMinutes: RULES.depositHoldMinutes, depositDueAt: null, refundAmount: 0, cancelReason: null, cancelledBy: null,
    createdAt: iso(now() - 60 * MINUTE), confirmedAt: iso(now() - 55 * MINUTE), canChange: false, canCancel: true,
    refundIfCancelledNow: 0, pendingPayment: null, parkingLotAddress: lot?.address ?? null, parkingLotDistrict: null,
    vehicleLabel: label, bookingMode: 'PayAsYouGo', departureTime: null, isSlotHeld: true, staffDemo: true,
  }
  reservations.push(r)
  return r
}

/** The Staff demo starts with two arrivals and two departures waiting (once per lot and page load). */
function seedRequests(lotKey: string) {
  if (seededRequestLots.has(lotKey)) return
  seededRequestLots.add(lotKey)
  const cars = lotSessions(lotKey).filter((s) => inside(s) && s.vehicleKind === 'car' && !s.ownedByCustomer)

  const arrivals: [string, string, string, string, number][] = [
    ['51K-246.80', 'Mazda CX-5', 'Red', 'Lê Thị Hoa', 4],
    ['30H-135.79', 'Toyota Vios', 'White', 'Trần Minh Khoa', 1],
  ]
  for (const [plate, label, color, customer, minutesAgo] of arrivals) {
    const r = seedBooking(lotKey, plate, label, 5)
    newRequest({
      lotKey, kind: 'CheckIn', mine: false, plateNumber: plate, vehicleLabel: label, vehicleColor: color, customerName: customer,
      customerPhone: '0901 234 567', reservationId: r.id, reservationCode: r.code, arrivalTime: r.arrivalTime,
      checkInFrom: r.checkInFrom, checkInUntil: r.checkInUntil, createdAt: iso(now() - minutesAgo * MINUTE),
    })
  }

  // One departure already paid in the app (opens at once), one not paid yet (Staff must take the fee)
  const departures: [MockSession | undefined, string, string, number][] = [
    [cars[0], 'Phạm Quốc Bảo', 'Honda City', 3],
    [cars[1], 'Ngô Thanh Tâm', 'Kia Morning', 2],
  ]
  departures.forEach(([s, customer, label, minutesAgo], i) => {
    if (!s) return
    if (i === 0) {
      s.paidAmount = quote(s, undefined, false).fee
      s.status = 'Paid'
      s.exitWindowEndsAt = iso(now() + 12 * MINUTE)
    }
    newRequest({
      lotKey, kind: 'CheckOut', mine: false, plateNumber: s.plateNumber, vehicleLabel: label, customerName: customer,
      customerPhone: '0912 345 678', sessionId: s.id, createdAt: iso(now() - minutesAgo * MINUTE),
    })
  })
}

function findRequest(id: number) {
  const g = gateRequests.find((x) => x.id === id)
  if (!g) mockFail(404, 'Request not found.')
  return g
}

/** Opens the barrier through the lane mock (same rules as the entry and exit lanes). */
async function approveRequest(g: MockGateRequest, request: ApproveGateRequestRequest): Promise<GateRequestDecisionDTO> {
  if (g.status !== 'Waiting') mockFail(400, g.status === 'Cancelled' ? 'The customer cancelled this request.' : 'This request was already handled.')
  if (g.kind === 'CheckIn') {
    const result = await gateMock.checkIn(g.lotKey, {
      gateId: request.gateId, plateNumber: g.plateNumber ?? undefined, vehicleTypeId: g.vehicleTypeId ?? 1,
      reservationCode: g.reservationCode ?? undefined, plateConfirmed: request.plateConfirmed ?? true,
      allowWhenFull: request.allowWhenFull, allowPlateMismatch: request.allowPlateMismatch, overrideReason: request.overrideReason,
    })
    if (result.outcome === 'Created' && result.session) {
      g.status = 'Completed'
      g.sessionId = result.session.id
      g.handledAt = iso(now())
      const s = sessions.find((x) => x.id === result.session!.id)
      if (s && g.mine) s.ownedByCustomer = true
    }
    return { request: requestDto(g), barrierOpen: result.barrierOpen, checkIn: result, checkOut: null, alerts: result.alerts.filter((a) => a.blocking) }
  }
  const result = await gateMock.checkout(g.sessionId!, {
    gateId: request.gateId, plateNumber: g.plateNumber ?? undefined, photoChecked: request.plateConfirmed ?? true,
    allowPlateMismatch: request.allowPlateMismatch, overrideReason: request.overrideReason,
  })
  if (result.barrierOpen) {
    g.status = 'Completed'
    g.handledAt = iso(now())
  }
  return { request: requestDto(g), barrierOpen: result.barrierOpen, checkIn: null, checkOut: result, alerts: result.alerts.filter((a) => a.blocking) }
}

/** Demo only: a simulated Staff member opens the barrier (and the sensor confirms), or refuses when unpaid. */
function handleLater(g: MockGateRequest) {
  setTimeout(() => {
    if (g.status !== 'Waiting') return
    const problem = requestDto(g).problem
    if (problem) {
      g.status = 'Refused'
      g.handledAt = iso(now())
      g.note = g.kind === 'CheckOut' ? 'Please pay the parking fee in the app first, then press Check out again.' : problem
      return
    }
    void approveRequest(g, {})
      .then(async (decision) => {
        if (decision.checkIn?.session) await gateMock.confirmEntry(decision.checkIn.session.id)
      })
      .catch(() => {
        g.status = 'Refused'
        g.handledAt = iso(now())
        g.note = 'The gate could not open; please talk to the Staff at the lane.'
      })
  }, DEMO_STAFF_DELAY_MS)
}

export const gateRequestMock = {
  /** Same checks as the API: confirmed, inside the window, vehicle not parked; pressing twice keeps one place. */
  async requestCheckIn(reservationId: number): Promise<GateRequestDTO> {
    const profile = await profileMock.getProfile()
    return mockResponse(() => {
      sweep()
      const r = ownReservation(reservationId)
      if (r.status !== 'Confirmed') mockFail(400, r.status === 'CheckedIn' ? 'This booking has already checked in.' : `This booking is ${r.status} and cannot check in.`)
      if (now() < Date.parse(r.checkInFrom)) mockFail(400, `Too early: check-in opens ${RULES.earlyMinutes} minutes before your arrival time.`)
      if (now() > Date.parse(r.checkInUntil)) mockFail(400, 'The hold has ended; the vehicle can only enter as a walk-in at the lane.')
      if (sessions.some((s) => open(s) && normalize(s.plateNumber) === normalize(r.plateNumber ?? ''))) mockFail(400, 'This vehicle is already parked.')
      const waiting = gateRequests.find((g) => g.reservationId === r.id && g.kind === 'CheckIn' && g.status === 'Waiting')
      if (waiting) return requestDto(waiting)
      const g = newRequest({
        lotKey: r.lotKey, kind: 'CheckIn', mine: true, plateNumber: r.plateNumber, vehicleLabel: r.vehicleLabel ?? null,
        customerName: profile.fullName, customerPhone: profile.phoneNumber, reservationId: r.id, reservationCode: r.code,
        arrivalTime: r.arrivalTime, checkInFrom: r.checkInFrom, checkInUntil: r.checkInUntil, slotCode: r.slotCode,
      })
      handleLater(g)
      return requestDto(g)
    })
  },

  async requestCheckOut(sessionId: number): Promise<GateRequestDTO> {
    const profile = await profileMock.getProfile()
    const mineNow = await customerSessions()
    return mockResponse(() => {
      const s = mineNow.find((x) => x.id === sessionId)
      if (!s) mockFail(404, 'Parking session not found.')
      if (!inside(s)) mockFail(400, 'This vehicle is not parked.')
      const waiting = gateRequests.find((g) => g.sessionId === s.id && g.kind === 'CheckOut' && g.status === 'Waiting')
      if (waiting) return requestDto(waiting)
      const g = newRequest({
        lotKey: s.lotKey, kind: 'CheckOut', mine: true, plateNumber: s.plateNumber, customerName: profile.fullName,
        customerPhone: profile.phoneNumber, sessionId: s.id, reservationId: s.reservationId, reservationCode: s.reservationCode,
      })
      handleLater(g)
      return requestDto(g)
    })
  },

  mine: () =>
    mockResponse(() =>
      gateRequests
        .filter((g) => g.mine && now() - Date.parse(g.createdAt) < 12 * 60 * MINUTE)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .map(requestDto),
    ),

  cancel: (requestId: number) =>
    mockResponse(() => {
      const g = findRequest(requestId)
      if (!g.mine) mockFail(404, 'Request not found.')
      if (g.status !== 'Waiting') mockFail(400, 'Staff already handled this request.')
      g.status = 'Cancelled'
      g.handledAt = iso(now())
      return requestDto(g)
    }),

  /** Waiting requests of the lot, oldest first; ones handled at the lane without the app are closed. */
  queue: (lotId: string, kind: GateRequestKind) =>
    mockResponse(() => {
      seedRequests(lotId)
      sweep()
      for (const g of gateRequests.filter((x) => x.lotKey === lotId && x.status === 'Waiting')) {
        const r = reservations.find((x) => x.id === g.reservationId)
        const s = sessions.find((x) => x.id === g.sessionId)
        const stale = g.kind === 'CheckIn' ? r?.status !== 'Confirmed' : !s || !inside(s)
        if (stale) {
          g.status = 'Cancelled'
          g.handledAt = iso(now())
          g.note = 'Handled at the lane without the app request.'
        }
      }
      return gateRequests
        .filter((g) => g.lotKey === lotId && g.kind === kind && g.status === 'Waiting')
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
        .map(requestDto)
    }),

  approve: (requestId: number, request: ApproveGateRequestRequest) => approveRequest(findRequest(requestId), request),

  refuse: (requestId: number, reason: string) =>
    mockResponse(() => {
      if (!reason.trim()) mockFail(400, 'Give the customer a reason for refusing.')
      const g = findRequest(requestId)
      if (g.status !== 'Waiting') mockFail(400, 'This request was already handled.')
      g.status = 'Refused'
      g.handledAt = iso(now())
      g.note = reason.trim()
      return requestDto(g)
    }),
}
