import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { t } from '@/i18n'

/**
 * Background videos of the hero carousel, shown one at a time. `start` (seconds) skips each intro so
 * the hero never shows a black frame: the Lamborghini clip opens with the filmmaker's logo for 4 s,
 * the Pagani clip with a black frame and the BMW clip fades in from black for about 1.5 s.
 */
const HERO_VIDEOS = [
  { src: '/home/videos/lamborghini-revuelto.mp4', start: 4.5 },
  { src: '/home/videos/pagani-huayra.mp4', start: 0.5 },
  { src: '/home/videos/bmw-m3-competition.mp4', start: 1.5 },
]

/** How long each video stays on screen before the carousel moves to the next one. */
const SLIDE_DURATION_MS = 30_000

/** Full-screen video hero: the title in the middle and a Discover button that scrolls to the facilities. */
export function HeroSection() {
  // `active` is the video that should play; `shown` is the one on screen, which changes only once the
  // next video really plays, so the switch never uncovers an empty frame. The previous video stays
  // under the new one (`behind`) until the cross-fade is over.
  const [active, setActive] = useState(0)
  const [shown, setShown] = useState(-1)
  const [behind, setBehind] = useState(-1)
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
  // Users who ask the system for less motion see the first frame of the first video only.
  const [reducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)

  const show = (i: number) => {
    if (i !== active || i === shown) return
    setBehind(shown)
    setShown(i)
  }

  // Drop the previous video once the new one has faded in over it (the fade takes 0.9 s).
  useEffect(() => {
    if (behind < 0) return
    const id = window.setTimeout(() => setBehind(-1), 1000)
    return () => window.clearTimeout(id)
  }, [behind])

  // Move to the next video every 30 seconds.
  useEffect(() => {
    if (reducedMotion) return
    const id = window.setTimeout(() => setActive((i) => (i + 1) % HERO_VIDEOS.length), SLIDE_DURATION_MS)
    return () => window.clearTimeout(id)
  }, [active, reducedMotion])

  // Only the active video plays, from its start; the others pause where they are (the previous one is
  // still fading out, so it is not rewound here but when its turn comes again).
  useEffect(() => {
    videoRefs.current.forEach((video, i) => {
      if (!video) return
      if (i === active && !reducedMotion) {
        if (video.paused) video.currentTime = HERO_VIDEOS[i].start
        video.play().catch(() => {
          /* autoplay blocked: the previous frame stays on screen */
        })
      } else {
        video.pause()
      }
    })
  }, [active, reducedMotion])

  // Load the next video in full ahead of its turn so it can start at once.
  const nextIndex = (active + 1) % HERO_VIDEOS.length

  // Phones can refuse to autoplay (iOS Low Power Mode, data saver): start the video on the first touch,
  // click or scroll instead of leaving the poster up.
  useEffect(() => {
    if (reducedMotion) return
    const resume = () => {
      const video = videoRefs.current[active]
      if (video?.paused) void video.play().catch(() => {})
    }
    const events = ['touchstart', 'pointerdown', 'scroll'] as const
    events.forEach((name) => window.addEventListener(name, resume, { passive: true }))
    // Browsers pause videos in a background tab: start again as soon as the tab is back in view.
    const onVisible = () => document.visibilityState === 'visible' && resume()
    document.addEventListener('visibilitychange', onVisible)
    // Safety net: if the video stops on its own (stalled network, decoder reset), kick it every few seconds.
    const watchdog = window.setInterval(() => document.visibilityState === 'visible' && resume(), 3000)
    return () => {
      events.forEach((name) => window.removeEventListener(name, resume))
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(watchdog)
    }
  }, [active, reducedMotion])

  // Instead of the native loop (which would replay the intro), go back to the video's start when it ends.
  const restart = (i: number) => {
    const video = videoRefs.current[i]
    if (!video || i !== active) return
    video.currentTime = HERO_VIDEOS[i].start
    void video.play().catch(() => {})
  }

  const discover = () => {
    document.getElementById('facilities')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' })
  }

  return (
    <section className="home-hero" id="top">
      <div className="home-hero__media" aria-hidden="true">
        {HERO_VIDEOS.map(({ src, start }, i) => (
          <video
            key={src}
            ref={(el) => {
              videoRefs.current[i] = el
              // React sets `muted` only as a property, but iOS Safari autoplays only videos that carry the
              // muted attribute in the DOM, so write it out as well.
              if (el) {
                el.muted = true
                el.defaultMuted = true
                el.setAttribute('muted', '')
              }
            }}
            className={`home-hero__video${i === shown ? ' is-shown' : ''}${i === behind ? ' is-behind' : ''}`}
            // The media fragment makes the browser load and show the first frame at `start` already.
            src={start > 0 ? `${src}#t=${start}` : src}
            muted
            playsInline
            autoPlay={i === active && !reducedMotion}
            onPlaying={() => show(i)}
            // The very first video shows its first frame as soon as it is loaded, without waiting for
            // playback (and stays as a still frame with reduced motion), so the page never opens black.
            onLoadedData={() => shown < 0 && show(i)}
            onEnded={() => restart(i)}
            // The playing video and the next one load in full; the third only fetches its metadata.
            preload={i === active || i === nextIndex ? 'auto' : 'metadata'}
          />
        ))}
      </div>

      <div className="home-container home-hero__center">
        <h1 className="home-hero__title">XXIV Parking</h1>

        <button type="button" className="home-hero__discover" onClick={discover}>
          {t('Discover')}
          <ChevronDown aria-hidden />
        </button>
      </div>
    </section>
  )
}
