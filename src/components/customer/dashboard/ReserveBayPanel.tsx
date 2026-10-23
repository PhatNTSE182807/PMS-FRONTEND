import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { CircleCheck, CreditCard, Timer, Wallet } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { BookingTimeFields } from '@/components/customer/BookingTimeFields'
import { useNow } from '@/hooks/useNow'
import { useVehicles } from '@/hooks/useProfile'
import { useCreateReservation, usePayDeposit } from '@/hooks/useReservations'
import { checkBookingTimes, defaultBookingTimes, describeWindow } from '@/lib/bookingTime'
import { formatNumber } from '@/lib/format'
import type { PaymentProvider, ReservationDTO } from '@/types/operations.dto'

interface ReserveBayPanelProps {
  lotKey: string
  slotId: string
  slotCode: string
}

/**
 * Books the selected bay (SRS FR-RSV-02): pick the car, the booking type and the date and time
 * (Scheduled: arrival and departure; pay as you go: arrival only), then pay the deposit with VNPay or
 * MoMo before the deadline. Overlapping bookings of one bay: the first one wins.
 */
export function ReserveBayPanel({ lotKey, slotId, slotCode }: ReserveBayPanelProps) {
  const now = useNow(1000)
  const { data: vehicles = [] } = useVehicles()
  const allCars = useMemo(() => vehicles.filter((v) => v.isActive !== false && !/motor/i.test(v.vehicleType)), [vehicles])
  // Only a car whose papers Staff approved can be booked (the API refuses the others)
  const cars = useMemo(() => allCars.filter((v) => v.verificationStatus === 'Approved'), [allCars])
  const waitingCars = allCars.length - cars.length
  const [vehicleId, setVehicleId] = useState('')
  const [times, setTimes] = useState(() => defaultBookingTimes(Date.now()))
  const [held, setHeld] = useState<ReservationDTO | null>(null)
  const create = useCreateReservation()
  const pay = usePayDeposit()

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
      },
      {
        onSuccess: (reservation) => {
          setHeld(reservation)
          toast.success(`Bay ${slotCode} is booked for ${describeWindow(reservation.arrivalTime, reservation.departureTime, Date.now())}`, {
            description: `Pay the ${formatNumber(reservation.depositAmount)} VND deposit within 10 minutes to confirm it.`,
          })
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    )
  }

  const payWith = (provider: PaymentProvider) => heldHere && pay.mutate({ id: heldHere.id, provider })

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
        </div>
        <Link to="/me/bookings" className="cx-link">Open My Bookings</Link>
      </div>
    )
  }

  return (
    <div className="cx-reserve">
      <label className="cx-field">
        <span className="cx-field__label">Vehicle</span>
        <select className="cx-input" value={chosenVehicle} onChange={(e) => setVehicleId(e.target.value)} disabled={cars.length === 0}>
          {cars.length === 0 && <option value="">{allCars.length ? 'No approved car yet' : 'No car in your profile yet'}</option>}
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
      <BookingTimeFields value={times} onChange={setTimes} now={now} idPrefix={`reserve-${slotId}`} disabled={create.isPending} />
      <button type="button" className="cx-btn cx-btn--light cx-btn--block" disabled={!chosenVehicle || create.isPending} onClick={reserve}>
        <CircleCheck aria-hidden /> {create.isPending ? 'Booking the bay…' : `Reserve bay ${slotCode} • 30,000 VND deposit`}
      </button>
      {cars.length === 0 && (
        <Link to="/me/vehicles" className="cx-link">{allCars.length ? 'Check your vehicle papers' : 'Register a car to book'}</Link>
      )}
    </div>
  )
}
