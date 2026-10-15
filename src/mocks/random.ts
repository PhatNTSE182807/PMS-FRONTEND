/**
 * Deterministic pseudo-random helpers, so mock data is identical on every reload
 * (screenshots, demos and bug reports stay reproducible).
 */

/** Mulberry32 PRNG: returns a function producing floats in [0, 1). */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a hash of a string, used to seed per-entity randomness (e.g. per lot and day). */
export function hashString(value: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export const randomInt = (random: () => number, min: number, max: number) =>
  Math.floor(random() * (max - min + 1)) + min

export const pick = <T>(random: () => number, items: readonly T[]): T => items[Math.floor(random() * items.length)]

/** Fisher-Yates shuffle into a new array. */
export function shuffle<T>(random: () => number, items: readonly T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** Random float in [1 - spread, 1 + spread]. */
export const jitter = (random: () => number, spread: number) => 1 - spread + random() * spread * 2
