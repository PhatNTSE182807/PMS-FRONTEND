import { Moon, Sun } from 'lucide-react'
import { useColorTheme } from '@/hooks/useColorTheme'

/**
 * Sun/moon button that flips the whole app between light and dark mode. Unstyled: each area passes the
 * class of its own icon buttons.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useColorTheme()
  const label = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'
  return (
    <button type="button" className={className} onClick={toggle} aria-label={label} title={label}>
      {theme === 'light' ? <Moon aria-hidden /> : <Sun aria-hidden />}
    </button>
  )
}
