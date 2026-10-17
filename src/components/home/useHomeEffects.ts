import { useEffect, useRef, useState } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Animates from the previous value to `target` (ease-out); jumps straight there with reduced motion. */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0)
  const fromRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    if (prefersReducedMotion() || from === target) {
      fromRef.current = target
      setValue(target)
      return undefined
    }

    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs)
      const eased = 1 - (1 - progress) ** 3
      setValue(Math.round(from + (target - from) * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      fromRef.current = target
    }
  }, [target, durationMs])

  return value
}

/** Adds `is-visible` once the element scrolls into view (used for the fade-up reveals). */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return undefined
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      element.classList.add('is-visible')
      return undefined
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return ref
}

/** Index that advances every `intervalMs`, paused while `paused` is true or motion is reduced. */
export function useRotatingIndex(length: number, intervalMs: number, paused = false): [number, (index: number) => void] {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (paused || prefersReducedMotion() || length < 2) return undefined
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % length), intervalMs)
    return () => window.clearInterval(timer)
  }, [length, intervalMs, paused])

  return [index, setIndex]
}
