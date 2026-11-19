import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

/** Background videos of the hero carousel, shown one at a time. */
const HERO_VIDEOS = [
  '/home/videos/lamborghini-revuelto.mp4',
  '/home/videos/pagani-huayra.mp4',
  '/home/videos/bmw-m3-competition.mp4',
]

/** How long each video stays on screen before the carousel moves to the next one. */
const SLIDE_DURATION_MS = 30_000

/** Full-screen video hero: the title in the middle and a Discover button that scrolls to the facilities. */
export function HeroSection() {
  const [active, setActive] = useState(0)
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
  // Users who ask the system for less motion see the poster frame only.
  const [reducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)

  // Move to the next video every 30 seconds.
  useEffect(() => {
    if (reducedMotion) return
    const id = window.setTimeout(() => setActive((i) => (i + 1) % HERO_VIDEOS.length), SLIDE_DURATION_MS)
    return () => window.clearTimeout(id)
  }, [active, reducedMotion])

  // Only the visible video plays; the others are paused and rewound so they start from the top next time.
  useEffect(() => {
    videoRefs.current.forEach((video, i) => {
      if (!video) return
      if (i === active && !reducedMotion) {
        video.play().catch(() => {
          /* autoplay blocked: the poster stays visible */
        })
      } else {
        video.pause()
        if (i !== active) video.currentTime = 0
      }
    })
  }, [active, reducedMotion])

  const discover = () => {
    document.getElementById('facilities')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' })
  }

  return (
    <section className="home-hero" id="top">
      <div className="home-hero__media" aria-hidden="true">
        {HERO_VIDEOS.map((src, i) => (
          <video
            key={src}
            ref={(el) => {
              videoRefs.current[i] = el
            }}
            className={`home-hero__video${i === active ? ' is-active' : ''}`}
            src={src}
            poster="/home/hero-garage.jpg"
            muted
            loop
            playsInline
            // Load the first video right away; the others only fetch metadata until their turn.
            preload={i === active ? 'auto' : 'metadata'}
          />
        ))}
      </div>

      <div className="home-container home-hero__center">
        <h1 className="home-hero__title">
          Next-generation
          <span className="home-hero__title-accent">Parking System</span>
        </h1>

        <button type="button" className="home-hero__discover" onClick={discover}>
          Discover
          <ChevronDown aria-hidden />
        </button>
      </div>
    </section>
  )
}
