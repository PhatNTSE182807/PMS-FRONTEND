import { useCallback, useSyncExternalStore } from 'react'

export type CustomerTheme = 'dark' | 'light'

const KEY = 'cx-theme'
const listeners = new Set<() => void>()
/** The choice made in this page, used when the browser blocks storage. */
let picked: CustomerTheme | null = null

function read(): CustomerTheme {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // Storage blocked: fall back to the choice made in this page
  }
  return picked ?? 'dark'
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Another tab changed the theme
  const onStorage = (e: StorageEvent) => e.key === KEY && listener()
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/**
 * Light or dark mode of the customer area, remembered in this browser. Dark is the default. Set it as
 * data-cx-theme on the .cx root (see customer-light.css).
 */
export function useCustomerTheme() {
  const theme = useSyncExternalStore(subscribe, read, () => 'dark' as const)
  const setTheme = useCallback((next: CustomerTheme) => {
    picked = next
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Storage blocked: the choice lasts until the page reloads
    }
    listeners.forEach((l) => l())
  }, [])
  return { theme, setTheme, toggle: () => setTheme(theme === 'light' ? 'dark' : 'light') }
}
