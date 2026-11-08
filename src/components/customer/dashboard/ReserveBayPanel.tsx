import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { CircleCheck, CreditCard, FlaskConical, ShieldCheck, Timer, Wallet, Zap } from 'lucide-react'
import { BookingTimeFields } from '@/components/customer/BookingTimeFields'
import { useNow } from '@/hooks/useNow'
import { useVehicles } from '@/hooks/useProfile'
import { usePaymentSimulation } from '@/hooks/usePaymentSimulation'
import { useCreateReservation, useMyReservations, usePayDeposit, useSimulateDeposit } from '@/hooks/useReservations'
import { bookingAllowance } from '@/lib/bookingLimits'
import { checkBookingTimes, defaultBookingTimes, describeWindow } from '@/lib/bookingTime'
import { formatNumber } from '@/lib/format'
import { USER_TOAST, toastBookingError } from '@/lib/userToasts'
import type { PaymentProvider, ReservationDTO } from '@/types/operations.dto'
import { holdDuration } from '../customerFormat'

/** Deposit choices: the hold after arrival is longer when a deposit is paid. */
const DEPOSIT_OPTIONS = [
  { value: true, icon: ShieldCheck, title: 'With deposit', text: '30,000 VND, deducted at exit (kept by the lot if you leave after your departure time) • bay held 30 min after arrival' },
  { value: false, icon: Zap, title: 'No deposit', text: 'Confirmed at once • bay held only 15 min after arrival' },
] as const

const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })

interface ReserveBayPanelProps {
  lotKey: string
  slotId: string
  slotCode: string
}

/**
 * Books the selected bay (SRS FR-RSV-02): pick the car, the booking type and the date and time
 * (Scheduled: arrival and departure; pay as you go: arrival only), and whether to pay a deposit.
 * With a deposit (paid with the wallet, VNPay or MoMo before the deadline) the bay is held 30 minutes
 * after arrival; without one the booking is confirmed at once and held only 15 minutes.
 * Overlapping bookings of one bay: the first one wins.
 */
export function ReserveBayPanel({ lotKey, slotId, slotCode }: ReserveBayPanelProps) {
  const now = useNow(1000)
  const { data: vehicles = [] } = useVehicles()
  const allCars = useMemo(() => vehicles.filter((v) => v.isActive !== false && !/motor/i.test(v.vehicleType)), [vehicles])
  // Only a car whose papers Staff approved can be booked (the API refuses the others)
  const approvedCars = useMemo(() => allCars.filter((v) => v.verificationStatus === 'Approved'), [allCars])
  const waitingCars = allCars.length - approvedCars.length
  // One booking per vehicle and a few per account: cars that already have one are left out of the list
  const { data: reservations = [] } = useMyReservations()
  const allowance = useMemo(() => bookingAllowance(reservations), [reservations])
  const cars = useMemo(() => approvedCars.filter((v) => !allowance.bookedVehicleIds.has(String(v.vehicleId))), [approvedCars, allowance])
  const bookedCars = approvedCars.length - cars.length
  const [vehicleId, setVehicleId] = useState('')
  const [times, setTimes] = useState(() => defaultBookingTimes(Date.now()))
  const [held, setHeld] = useState<ReservationDTO | null>(null)
  // Deposit option: true = pay 30,000 VND and keep the bay 30 min after arrival; false = no deposit, 15 min
  const [payDeposit, setPayDeposit] = useState(true)
  const create = useCreateReservation()
  const pay = usePayDeposit()
  // Development / testing only: confirm the deposit without the VNPay / MoMo pages
  const canSimulate = usePaymentSimulation()
  const simulate = useSimulateDeposit()

  const chosenVehicle = vehicleId || cars.find((v) => v.isDefault)?.vehicleId || cars[0]?.vehicleId || ''
  const heldHere = held && String(held.slotId) === slotId ? held : null

  const reserve = () => {
    // Checked here too, so a time that slipped into the past while the form was open is caught
    const checked = checkBookingTimes(times, Date.now())
    if (!checked.ok) {
      toast.error(checked.error)
      return
    }
    create.mutate(
      {
        parkingLotId: lotKey,
        slotId,
        vehicleId: chosenVehicle,
        arrivalTime: checked.arrivalTime,
        bookingMode: times.mode,
        departureTime: checked.departureTime,
        payDeposit,
      },
      {
        onSuccess: (reservation) => {
          // The deposit deadline and the hold time are shown in the panel itself
          setHeld(reservation)
          toast.success(USER_TOAST.bookingSuccess)
        },
        onError: toastBookingError,
      },
    )
  }

  const payWith = (provider: PaymentProvider) => heldHere && pay.mutate({ id: heldHere.id, provider })

  // Booked without a deposit: confirmed already, nothing to pay
  if (heldHere && !heldHere.hasDeposit) {
    return (
      <div className="cx-reserve" aria-live="polite">
        <p className="cx-reserve__title">
          <CircleCheck aria-hidden /> Bay <strong>{heldHere.slotCode}</strong> confirmed • #{heldHere.code}
        </p>
        <p className="cx-reserve__meta">{describeWindow(heldHere.arrivalTime, heldHere.departureTime, now)}</p>
        <p className="cx-reserve__meta">
          <Timer aria-hidden /> No deposit: the bay is held until <strong>{clock.format(Date.parse(heldHere.checkInUntil))}</strong> ({holdDuration(heldHere)} after arrival)
        </p>
        <Link to="/me/bookings" className="cx-link">Open My Bookings</Link>
      </div>
    )
  }

  if (heldHere) {
    const due = heldHere.depositDueAt ? Date.parse(heldHere.depositDueAt) : now
    const left = Math.max(0, due - now)
    return (
      <div className="cx-reserve" aria-live="polite">
        <p className="cx-reserve__title">
          <CircleCheck aria-hidden /> Bay <strong>{heldHere.slotCode}</strong> booked • #{heldHere.code}
        </p>
        <p className="cx-reserve__meta">{describeWindow(heldHere.arrivalTime, heldHere.departureTime, now)}</p>
        <p className="cx-reserve__meta">
          <ShieldCheck aria-hidden /> With the deposit the bay is held {holdDuration(heldHere)} after arrival
        </p>
        <p className="cx-reserve__meta">
          <Timer aria-hidden /> Pay the <strong>{formatNumber(heldHere.depositAmount)} VND</strong> deposit within{' '}
          <span className="cx-mono">{Math.floor(left / 60_000)}:{String(Math.floor((left % 60_000) / 1000)).padStart(2, '0')}</span>
          {left === 0 && ' (expired)'}
        </p>
        <div className="cx-reserve__pay">
          <button type="button" className="cx-btn cx-btn--wallet" disabled={pay.isPending || left === 0} onClick={() => payWith('Wallet')}>
            <CreditCard aria-hidden /> Pay with XXIV Wallet
          </button>
          <button type="button" className="cx-btn cx-btn--gold" disabled={pay.isPending || left === 0} onClick={() => payWith('VNPay')}>
            <Wallet aria-hidden /> VNPay
          </button>
          <button type="button" className="cx-btn cx-btn--momo" disabled={pay.isPending || left === 0} onClick={() => payWith('MoMo')}>
            <Wallet aria-hidden /> MoMo
          </button>
          {canSimulate && (
            <button
              type="button"
              className="cx-btn cx-btn--simulate"
              disabled={simulate.isPending || left === 0}
              onClick={() => simulate.mutate(heldHere.id, { onSuccess: setHeld })}
            >
              <FlaskConical aria-hidden /> {simulate.isPending ? 'Simulating…' : 'Simulate successful payment'}
            </button>
          )}
        </div>
        <Link to="/me/bookings" className="cx-link">Open My Bookings</Link>
      </div>
    )
  }

  if (allowance.atLimit) {
    return (
      <div className="cx-reserve">
        <p className="cx-note" role="status">
          You already have {allowance.activeCount} active bookings, the most an account can hold. Use or cancel one to book this bay.
        </p>
        <Link to="/me/sessions" className="cx-btn cx-btn--teal cx-btn--block">Open Active Sessions</Link>
      </div>
    )
  }

  return (
    <div className="cx-reserve">
      <p className="cx-field__hint">
        Active bookings: {allowance.activeCount} of {allowance.limit}
        {bookedCars > 0 && ` • ${bookedCars} ${bookedCars === 1 ? 'car already has' : 'cars already have'} a booking and ${bookedCars === 1 ? 'is' : 'are'} not listed`}
      </p>
      <label className="cx-field">
        <span className="cx-field__label">Vehicle</span>
        <select className="cx-input" value={chosenVehicle} onChange={(e) => setVehicleId(e.target.value)} disabled={cars.length === 0}>
          {cars.length === 0 && <option value="">{bookedCars > 0 ? 'Every approved car already has a booking' : allCars.length ? 'No approved car yet' : 'No car in your profile yet'}</option>}
          {cars.map((v) => (
            <option key={v.vehicleId} value={v.vehicleId}>
              {v.licensePlate} • {v.brand} {v.model}
            </option>
          ))}
        </select>
        {waitingCars > 0 && (
          <span className="cx-field__hint">
            {waitingCars} {waitingCars === 1 ? 'car is' : 'cars are'} not listed: waiting for Staff to approve the papers.
          </span>
        )}
      </label>
      <BookingTimeFields
        value={times}
        onChange={setTimes}
        now={now}
        idPrefix={`reserve-${slotId}`}
        disabled={create.isPending}
        holdMinutes={payDeposit ? 30 : 15}
      />
      <div className="cx-mode" role="radiogroup" aria-label="Deposit">
        {DEPOSIT_OPTIONS.map((option) => {
          const Icon = option.icon
          const active = payDeposit === option.value
          return (
            <button
              key={String(option.value)}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={create.isPending}
              className={`cx-mode__option ${active ? 'is-active' : ''}`}
              onClick={() => setPayDeposit(option.value)}
            >
              <Icon aria-hidden />
              <span>
                <strong>{option.title}</strong>
                <small>{option.text}</small>
              </span>
            </button>
          )
        })}
      </div>
      <button type="button" className="cx-btn cx-btn--light cx-btn--block" disabled={!chosenVehicle || create.isPending} onClick={reserve}>
        <CircleCheck aria-hidden />{' '}
        {create.isPending ? 'Booking the bay…' : payDeposit ? `Reserve bay ${slotCode} • 30,000 VND deposit` : `Reserve bay ${slotCode} • no deposit`}
      </button>
      {cars.length === 0 && (
        <Link to="/me/vehicles" className="cx-link">{allCars.length ? 'Check your vehicle papers' : 'Register a car to book'}</Link>
      )}
    </div>
  )
}
