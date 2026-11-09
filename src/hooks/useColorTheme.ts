import { useSyncExternalStore } from 'react'
import { readTheme, setTheme, subscribeTheme, type ColorTheme } from '@/lib/theme'

/** The app's light/dark mode (see lib/theme.ts) and a way to flip it. */
export function useColorTheme() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, (): ColorTheme => 'dark')
  return { theme, setTheme, toggle: () => setTheme(theme === 'light' ? 'dark' : 'light') }
}
