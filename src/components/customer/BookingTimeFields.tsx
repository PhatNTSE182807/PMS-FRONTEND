import { CalendarClock, Clock3, Infinity as InfinityIcon } from 'lucide-react'
import { BOOKING_RULES, toLocalInput, type BookingTimes } from '@/lib/bookingTime'
import type { BookingMode } from '@/types/operations.dto'

const MODES: { value: BookingMode; title: string; text: string; icon: typeof Clock3 }[] = [
  { value: 'Scheduled', title: 'Scheduled', text: 'Pick arrival and departure', icon: Clock3 },
  { value: 'PayAsYouGo', title: 'Pay as you go', text: 'Pick arrival, leave anytime', icon: InfinityIcon },
]

/**
 * Booking mode plus the arrival (and, for Scheduled, the departure) date and time. The pickers
 * refuse times in the past and beyond the booking horizon; the parent checks the values with
 * checkBookingTimes before sending them.
 */
export function BookingTimeFields({
  value,
  onChange,
  now,
  idPrefix,
  disabled,
  holdMinutes = 15,
}: {
  value: BookingTimes
  onChange: (next: BookingTimes) => void
  now: number
  idPrefix: string
  disabled?: boolean
  /** Minutes the bay is held after arrival: 30 with a deposit, 15 without. */
  holdMinutes?: number
}) {
  const min = toLocalInput(now + 60_000)
  const max = toLocalInput(now + BOOKING_RULES.maxLeadDays * 86_400_000)

  return (
    <div className="cx-booking-time">
      <div className="cx-mode" role="radiogroup" aria-label="Booking type">
        {MODES.map((mode) => {
          const Icon = mode.icon
          const active = value.mode === mode.value
          return (
            <button
              key={mode.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              className={`cx-mode__option ${active ? 'is-active' : ''}`}
              onClick={() => onChange({ ...value, mode: mode.value })}
            >
              <Icon aria-hidden />
              <span>
                <strong>{mode.title}</strong>
                <small>{mode.text}</small>
              </span>
            </button>
          )
        })}
      </div>

      <label className="cx-field" htmlFor={`${idPrefix}-arrival`}>
        <span className="cx-field__label">
          <CalendarClock size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> Arrival date &amp; time
        </span>
        <input
          id={`${idPrefix}-arrival`}
          type="datetime-local"
          className="cx-input"
          value={value.arrival}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, arrival: e.target.value })}
        />
      </label>

      {value.mode === 'Scheduled' && (
        <label className="cx-field" htmlFor={`${idPrefix}-departure`}>
          <span className="cx-field__label">
            <CalendarClock size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> Departure date &amp; time
          </span>
          <input
            id={`${idPrefix}-departure`}
            type="datetime-local"
            className="cx-input"
            value={value.departure}
            min={value.arrival || min}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, departure: e.target.value })}
          />
        </label>
      )}

      <span className="cx-field__hint">
        {value.mode === 'Scheduled'
          ? `The bay is yours for this window (${BOOKING_RULES.minStayMinutes} min to ${BOOKING_RULES.maxStayHours} h). You pay for the time you actually park.`
          : 'The bay is yours from arrival until you leave. You pay for the time you actually park.'}{' '}
        Check-in opens 15 minutes before arrival and closes {holdMinutes} minutes after.
      </span>
    </div>
  )
}
