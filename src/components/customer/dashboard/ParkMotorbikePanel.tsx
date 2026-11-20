import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Bike, CircleCheck, Timer } from 'lucide-react'
import { useVehicles } from '@/hooks/useProfile'
import { useRequestCheckIn } from '@/hooks/useGateRequests'
import { useCreateReservation } from '@/hooks/useReservations'
import { toastBookingError } from '@/lib/userToasts'
import type { ReservationDTO } from '@/types/operations.dto'
import { t, localDateFormat, tMaybe } from '@/i18n'

const clock = localDateFormat({ hour: '2-digit', minute: '2-digit' })

interface ParkMotorbikePanelProps {
  lotKey: string
  slotId: string
  slotCode: string
}

/**
 * Motorbikes do not book ahead: tapping a free bay claims it right now, with no deposit and no time
 * to pick, and sends a check-in request so Staff at the gate sees the plate at once. The fee is paid
 * at check-out as for any walk-in.
 */
export function ParkMotorbikePanel({ lotKey, slotId, slotCode }: ParkMotorbikePanelProps) {
  const { data: vehicles = [] } = useVehicles()
  const allBikes = useMemo(() => vehicles.filter((v) => v.isActive !== false && /motor/i.test(v.vehicleType)), [vehicles])
  // Only a motorbike whose papers Staff approved can claim a bay (the API refuses the others)
  const bikes = useMemo(() => allBikes.filter((v) => v.verificationStatus === 'Approved'), [allBikes])
  const waitingBikes = allBikes.length - bikes.length
  const [vehicleId, setVehicleId] = useState('')
  const [claimed, setClaimed] = useState<ReservationDTO | null>(null)
  const create = useCreateReservation()
  const checkIn = useRequestCheckIn()

  const chosenVehicle = vehicleId || bikes.find((v) => v.isDefault)?.vehicleId || bikes[0]?.vehicleId || ''
  const claimedHere = claimed && String(claimed.slotId) === slotId ? claimed : null

  const park = () =>
    create.mutate(
      {
        parkingLotId: lotKey,
        slotId,
        vehicleId: chosenVehicle,
        // The API sets the arrival to now for motorbikes; sent only because the request needs one
        arrivalTime: new Date().toISOString(),
        bookingMode: 'PayAsYouGo',
        payDeposit: false,
      },
      {
        onSuccess: (reservation) => {
          setClaimed(reservation)
          // Put the plate in front of Staff at the entry lane right away
          checkIn.mutate(reservation.id, {
            onSuccess: () => toast.success(t('Bay {slotCode} is yours. Ride to the gate: Staff will check you in.', { slotCode: reservation.slotCode })),
            onError: () => toast.success(t('Bay {slotCode} is yours. Press check-in on your booking when you reach the gate.', { slotCode: reservation.slotCode })),
          })
        },
        onError: toastBookingError,
      },
    )

  if (claimedHere) {
    return (
      <div className="cx-reserve" aria-live="polite">
        <p className="cx-reserve__title">
          <CircleCheck aria-hidden />{' '}{t('Bay')}{' '}<strong>{tMaybe(claimedHere.slotCode)}</strong>{' '}{t('is yours • #{code}', { code: claimedHere.code })}
        </p>
        <p className="cx-reserve__meta">
          <Timer aria-hidden />{' '}{t('Ride to the gate before')}{' '}<strong>{clock.format(Date.parse(claimedHere.checkInUntil))}</strong>{t(': Staff sees your plate and checks you in.')}
        </p>
        <p className="cx-reserve__meta">{t('No deposit: you pay the parking fee when you leave.')}</p>
        <Link to="/me/bookings" className="cx-link">{t('Open My Bookings')}</Link>
      </div>
    )
  }

  return (
    <div className="cx-reserve">
      <label className="cx-field">
        <span className="cx-field__label">{t('Motorbike')}</span>
        <select className="cx-input" value={chosenVehicle} onChange={(e) => setVehicleId(e.target.value)} disabled={bikes.length === 0}>
          {bikes.length === 0 && <option value="">{allBikes.length ? t('No approved motorbike yet') : t('No motorbike in your profile yet')}</option>}
          {bikes.map((v) => (
            <option key={v.vehicleId} value={v.vehicleId}>
              {v.licensePlate} • {tMaybe(v.brand)} {tMaybe(v.model)}
            </option>
          ))}
        </select>
        {waitingBikes > 0 && (
          <span className="cx-field__hint">
            {tMaybe(waitingBikes)} {waitingBikes === 1 ? 'motorbike is' : 'motorbikes are'}{' '}{t('not listed: waiting for Staff to approve the papers.')}
          </span>
        )}
      </label>
      <p className="cx-reserve__meta">{t('No booking time and no deposit: the bay is held for you now and you pay when you leave.')}</p>
      <button type="button" className="cx-btn cx-btn--light cx-btn--block" disabled={!chosenVehicle || create.isPending} onClick={park}>
        <Bike aria-hidden /> {create.isPending ? t('Claiming the bay…') : t('Park in bay {slotCode} now', { slotCode })}
      </button>
      {bikes.length === 0 && (
        <Link to="/me/vehicles" className="cx-link">{allBikes.length ? t('Check your vehicle papers') : t('Register a motorbike to park')}</Link>
      )}
    </div>
  )
}
