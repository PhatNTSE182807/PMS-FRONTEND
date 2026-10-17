import { useState } from 'react'
import { CalendarCheck, QrCode, Search } from 'lucide-react'
import { useReveal, useRotatingIndex } from './useHomeEffects'

const STEPS = [
  {
    icon: Search,
    title: 'Find a space',
    text: 'See free spaces at every lot in real time, filtered by car, motorbike or EV charging.',
  },
  {
    icon: CalendarCheck,
    title: 'Reserve ahead',
    text: 'Pick a lot, a zone and a time. Your default vehicle is filled in for you.',
  },
  {
    icon: QrCode,
    title: 'Scan and park',
    text: 'Show the QR code at the gate to check in. The fee runs live and you pay when you leave.',
  },
]

const STEP_MS = 4500

export function HowItWorks() {
  const [isPaused, setIsPaused] = useState(false)
  const [active, setActive] = useRotatingIndex(STEPS.length, STEP_MS, isPaused)
  const revealRef = useReveal<HTMLElement>()
  const ActiveIcon = STEPS[active].icon

  return (
    <section className="home-section home-section--tinted home-reveal" id="how-it-works" ref={revealRef}>
      <div className="home-container home-steps">
        <div>
          <p className="home-eyebrow">How it works</p>
          <h2 className="home-section__title">From search to parked in three steps</h2>

          <ol
            className="home-steps__list"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onFocus={() => setIsPaused(true)}
            onBlur={() => setIsPaused(false)}
          >
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <button
                  type="button"
                  className={`home-step ${index === active ? 'is-active' : ''}`}
                  aria-current={index === active ? 'step' : undefined}
                  onClick={() => setActive(index)}
                >
                  <span className="home-step__number">{index + 1}</span>
                  <span>
                    <span className="home-step__title">{step.title}</span>
                    <span className="home-step__text">{step.text}</span>
                  </span>
                  {index === active && !isPaused && (
                    <span className="home-step__progress" style={{ animationDuration: `${STEP_MS}ms` }} aria-hidden="true" />
                  )}
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="home-steps__visual" aria-hidden="true">
          <div key={active} className="home-steps__card">
            <ActiveIcon className="home-steps__icon" />
            <p className="home-steps__card-step">Step {active + 1}</p>
            <p className="home-steps__card-title">{STEPS[active].title}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
