/**
 * Light or dark mode of the whole app (every role and the public pages), remembered in this browser.
 * Dark is the default. The choice sits on <html data-theme="light|dark">; each area's stylesheet swaps its
 * colors under html[data-theme='light'] (admin.css, customer-light.css, home.css, auth.css).
 */
export type ColorTheme = 'dark' | 'light'

const KEY = 'xxiv-theme'
/** The customer area stored its choice here before every role had the toggle. */
const LEGACY_KEY = 'cx-theme'
const listeners = new Set<() => void>()
/** The choice made in this page, used when the browser blocks storage. */
let picked: ColorTheme | null = null

export function readTheme(): ColorTheme {
  try {
    const saved = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // Storage blocked: fall back to the choice made in this page
  }
  return picked ?? 'dark'
}

function apply(theme: ColorTheme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

export function setTheme(theme: ColorTheme) {
  picked = theme
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // Storage blocked: the choice lasts until the page reloads
  }
  apply(theme)
  listeners.forEach((l) => l())
}

export function subscribeTheme(listener: () => void) {
  listeners.add(listener)
  // Another tab changed the theme
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return
    apply(readTheme())
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

// Applied before the first render, so a light page never flashes dark
apply(readTheme())
