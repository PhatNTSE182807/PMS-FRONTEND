import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Boxes, Gauge, Pause, Play, ShieldCheck, SlidersHorizontal, Zap } from 'lucide-react'

interface HeroSectionProps {
  /** Where "Reserve priority slot" goes: the dashboard when signed in, otherwise sign-up. */
  reserveTo: string
}

/** Background videos of the hero carousel, shown one at a time. */
const HERO_VIDEOS = [
  { src: '/home/videos/lamborghini-revuelto.mp4', label: 'Lamborghini Revuelto' },
  { src: '/home/videos/pagani-huayra.mp4', label: 'Pagani Huayra' },
  { src: '/home/videos/bmw-m3-competition.mp4', label: 'BMW M3 Competition' },
]

/** How long each video stays on screen before the carousel moves to the next one. */
const SLIDE_DURATION_MS = 30_000

export function HeroSection({ reserveTo }: HeroSectionProps) {
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(true)
  // Bumped on every manual slide change so the 30-second progress bar starts over.
  const [timerKey, setTimerKey] = useState(0)
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])

  // Respect users who ask the system for less motion: start paused on the poster frame.
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) setPlaying(false)
  }, [])

  // Time left on the current slide; kept across pause / play so pausing does not restart the 30 seconds.
  const remainingRef = useRef(SLIDE_DURATION_MS)

  // A new slide (automatic or picked) gets the full 30 seconds.
  useEffect(() => {
    remainingRef.current = SLIDE_DURATION_MS
  }, [active, timerKey])

  // Advance to the next video when the slide's time runs out; pausing stores the time left.
  useEffect(() => {
    if (!playing) return
    const startedAt = performance.now()
    const id = window.setTimeout(() => setActive((i) => (i + 1) % HERO_VIDEOS.length), remainingRef.current)
    return () => {
      window.clearTimeout(id)
      remainingRef.current = Math.max(0, remainingRef.current - (performance.now() - startedAt))
    }
  }, [active, playing, timerKey])

  // Only the visible video plays; the others are paused and rewound so they start from the top next time.
  useEffect(() => {
    videoRefs.current.forEach((video, i) => {
      if (!video) return
      if (i === active && playing) {
        video.play().catch(() => {
          /* autoplay blocked: the poster stays visible */
        })
      } else {
        video.pause()
        if (i !== active) video.currentTime = 0
      }
    })
  }, [active, playing])

  const goTo = (index: number) => {
    setActive(index)
    setTimerKey((k) => k + 1)
  }

  return (
    <section className="home-hero" id="top">
      <div className="home-hero__media" aria-hidden="true">
        {HERO_VIDEOS.map((video, i) => (
          <video
            key={video.src}
            ref={(el) => {
              videoRefs.current[i] = el
            }}
            className={`home-hero__video${i === active ? ' is-active' : ''}`}
            src={video.src}
            poster="/home/hero-garage.jpg"
            muted
            loop
            playsInline
            // Load the first video right away; the others only fetch metadata until their turn.
            preload={i === active ? 'auto' : 'metadata'}
          />
        ))}
      </div>
      <div className="home-hero__shade" aria-hidden="true" />
      <div className="home-hero__glow home-hero__glow--teal" aria-hidden="true" />
      <div className="home-hero__glow home-hero__glow--gold" aria-hidden="true" />

      <div className="home-container home-hero__grid">
        <div>
          <h1 className="home-hero__title">
            Next-generation
            <span className="home-hero__title-accent">Parking System</span>
          </h1>

          <p className="home-hero__lead">
            Seamless optical ANPR access, 3D digital twin spatial guidance, and precision slot allocation for prestige
            &amp; performance fleets.
          </p>

          <div className="home-hero__actions">
            <a href="#facilities" className="home-btn home-btn--teal">
              <Boxes aria-hidden />
              Explore 3D bay architecture
            </a>
            <Link to={reserveTo} className="home-btn home-btn--gold-outline">
              <ShieldCheck aria-hidden />
              Reserve priority slot
            </Link>
          </div>

          <ul className="home-hero__features">
            <li>
              <Gauge aria-hidden /> Optical ANPR access
            </li>
            <li>
              <SlidersHorizontal aria-hidden /> Dedicated wide bays
            </li>
            <li>
              <Zap aria-hidden /> Rapid high-power charging
            </li>
          </ul>
        </div>
      </div>

      {/* Slide dots and a pause button */}
      <div className="home-hero__controls">
        <div className="home-hero__dots" role="tablist" aria-label="Background videos">
          {HERO_VIDEOS.map((video, i) => (
            <button
              key={video.src}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={video.label}
              className={`home-hero__dot${i === active ? ' is-active' : ''}`}
              onClick={() => goTo(i)}
            >
              {/* The bar fills over the slide's 30 seconds on the active dot (visual only, the timer is above) */}
              {i === active && (
                <span
                  key={timerKey}
                  className="home-hero__dot-fill"
                  style={{
                    animationDuration: `${SLIDE_DURATION_MS}ms`,
                    animationPlayState: playing ? 'running' : 'paused',
                  }}
                />
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="home-hero__toggle"
          aria-label={playing ? 'Pause background video' : 'Play background video'}
          onClick={() => setPlaying((p) => !p)}
        >
          {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
        </button>
      </div>
    </section>
  )
}
