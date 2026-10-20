import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { CalendarClock, CircleCheck, Timer, Wallet } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { useNow } from '@/hooks/useNow'
import { useVehicles } from '@/hooks/useProfile'
import { useCreateReservation, usePayDeposit } from '@/hooks/useReservations'
import { formatNumber } from '@/lib/format'
import type { PaymentProvider, ReservationDTO } from '@/types/operations.dto'

/** BR-01: arrival at most 2 hours after booking. */
const MAX_LEAD_MINUTES = 120

/** "YYYY-MM-DDTHH:mm" in local time, for <input type="datetime-local">. */
function toLocalInput(time: number) {
  const d = new Date(time)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Next quarter hour, at least 15 minutes ahead. */
function defaultArrival() {
  const t = Date.now() + 15 * 60_000
  return Math.ceil(t / (15 * 60_000)) * 15 * 60_000
}

interface ReserveBayPanelProps {
  lotKey: string
  slotId: string
  slotCode: string
}

/**
 * Books the selected bay (SRS FR-RSV-02): pick the car and the arrival time, hold the slot, then pay
 * the deposit with VNPay or MoMo before the deadline. Two drivers on one bay: the first holder wins.
 */
export function ReserveBayPanel({ lotKey, slotId, slotCode }: ReserveBayPanelProps) {
  const now = useNow(1000)
  const { data: vehicles = [] } = useVehicles()
  const cars = useMemo(() => vehicles.filter((v) => v.isActive !== false && !/motor/i.test(v.vehicleType)), [vehicles])
  const [vehicleId, setVehicleId] = useState('')
  const [arrival, setArrival] = useState(() => toLocalInput(defaultArrival()))
  const [held, setHeld] = useState<ReservationDTO | null>(null)
  const create = useCreateReservation()
  const pay = usePayDeposit()

  const chosenVehicle = vehicleId || cars.find((v) => v.isDefault)?.vehicleId || cars[0]?.vehicleId || ''
  const heldHere = held && String(held.slotId) === slotId ? held : null

  const reserve = () => {
    const arrivalTime = new Date(arrival)
    if (Number.isNaN(arrivalTime.getTime())) {
      toast.error('Pick a valid arrival time.')
      return
    }
    create.mutate(
      { parkingLotId: lotKey, slotId, vehicleId: chosenVehicle, arrivalTime: arrivalTime.toISOString() },
      {
        onSuccess: (reservation) => {
          setHeld(reservation)
          toast.success(`Bay ${slotCode} is held for you`, { description: `Pay the ${formatNumber(reservation.depositAmount)} VND deposit within 10 minutes to confirm it.` })
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
          <CircleCheck aria-hidden /> Bay <strong>{heldHere.slotCode}</strong> held • #{heldHere.code}
        </p>
        <p className="cx-reserve__meta">
          <Timer aria-hidden /> Pay the <strong>{formatNumber(heldHere.depositAmount)} VND</strong> deposit within{' '}
          <span className="cx-mono">{Math.floor(left / 60_000)}:{String(Math.floor((left % 60_000) / 1000)).padStart(2, '0')}</span>
          {left === 0 && ' (expired)'}
        </p>
        <div className="cx-reserve__pay">
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
          {cars.length === 0 && <option value="">No car in your profile yet</option>}
          {cars.map((v) => (
            <option key={v.vehicleId} value={v.vehicleId}>
              {v.licensePlate} • {v.brand} {v.model}
            </option>
          ))}
        </select>
      </label>
      <label className="cx-field">
        <span className="cx-field__label">
          <CalendarClock size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> Expected arrival
        </span>
        <input
          type="datetime-local"
          className="cx-input"
          value={arrival}
          min={toLocalInput(now)}
          max={toLocalInput(now + MAX_LEAD_MINUTES * 60_000)}
          onChange={(e) => setArrival(e.target.value)}
        />
        <span className="cx-field__hint">At most 2 hours from now; check-in opens 15 minutes before and closes 15 minutes after.</span>
      </label>
      <button type="button" className="cx-btn cx-btn--light cx-btn--block" disabled={!chosenVehicle || create.isPending} onClick={reserve}>
        <CircleCheck aria-hidden /> {create.isPending ? 'Holding the bay…' : `Reserve bay ${slotCode} • 30,000 VND deposit`}
      </button>
      {cars.length === 0 && (
        <Link to="/me/vehicles" className="cx-link">Register a car to book</Link>
      )}
    </div>
  )
}
