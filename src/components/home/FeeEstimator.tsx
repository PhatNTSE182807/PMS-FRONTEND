import { useState, type CSSProperties } from 'react'
import { Bike, Car, Zap } from 'lucide-react'
import { formatVnd } from '@/lib/format'
import { useCountUp, useReveal } from './useHomeEffects'

/** Illustrative rates only — each lot sets its own prices. */
const RATES = [
  { id: 'CAR', label: 'Car', icon: Car, perHour: 30_000, dailyCap: 250_000 },
  { id: 'MOTORBIKE', label: 'Motorbike', icon: Bike, perHour: 5_000, dailyCap: 30_000 },
  { id: 'EV_CHARGING', label: 'EV charging', icon: Zap, perHour: 40_000, dailyCap: 320_000 },
] as const

type RateId = (typeof RATES)[number]['id']

function estimateFee(perHour: number, dailyCap: number, hours: number): number {
  const fullDays = Math.floor(hours / 24)
  const remainder = hours % 24
  return fullDays * dailyCap + Math.min(remainder * perHour, dailyCap)
}

export function FeeEstimator() {
  const [rateId, setRateId] = useState<RateId>('CAR')
  const [hours, setHours] = useState(3)
  const revealRef = useReveal<HTMLElement>()

  const rate = RATES.find((r) => r.id === rateId) ?? RATES[0]
  const fee = estimateFee(rate.perHour, rate.dailyCap, hours)
  const shownFee = useCountUp(fee, 500)
  const isCapped = hours % 24 > 0 && (hours % 24) * rate.perHour > rate.dailyCap

  return (
    <section className="home-section home-reveal" id="pricing" ref={revealRef}>
      <div className="home-container home-pricing">
        <div>
          <p className="home-eyebrow">Pricing</p>
          <h2 className="home-section__title">Know the fee before you park</h2>
          <p className="home-section__lead">
            Pay by the hour with a daily cap. Pick a vehicle and how long you stay to see an estimate.
          </p>
          <p className="home-note">Sample rates for illustration. The final price is set by each parking lot.</p>
        </div>

        <div className="home-estimator">
          <div className="home-estimator__types" role="radiogroup" aria-label="Vehicle type">
            {RATES.map((option) => {
              const Icon = option.icon
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={rateId === option.id}
                  className={`home-estimator__type ${rateId === option.id ? 'is-active' : ''}`}
                  onClick={() => setRateId(option.id)}
                >
                  <Icon aria-hidden />
                  <span>{option.label}</span>
                  <small>{formatVnd(option.perHour)}/h</small>
                </button>
              )
            })}
          </div>

          <label className="home-estimator__duration">
            <span>
              Duration <strong>{hours} {hours === 1 ? 'hour' : 'hours'}</strong>
            </span>
            <input
              type="range"
              min={1}
              max={48}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              style={{ '--fill': `${((hours - 1) / 47) * 100}%` } as CSSProperties}
            />
            <span className="home-estimator__scale" aria-hidden="true">
              <span>1h</span>
              <span>24h</span>
              <span>48h</span>
            </span>
          </label>

          <div className="home-estimator__result" aria-live="polite">
            <span className="home-estimator__label">Estimated fee</span>
            <span className="home-estimator__fee">{formatVnd(shownFee)}</span>
            <span className="home-estimator__hint">
              {isCapped ? `Daily cap of ${formatVnd(rate.dailyCap)} applied` : `${formatVnd(rate.perHour)} per hour`}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
