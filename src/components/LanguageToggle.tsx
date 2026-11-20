import { useId } from 'react'
import { useLanguage } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * Round button with the flag of Vietnam (left half) and of the United States (right half). The flag of
 * the current language is in full color, the other one faded; a click switches between Vietnamese and
 * English. Unstyled like ThemeToggle: each area passes the class of its own icon buttons.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const { language, toggle } = useLanguage()
  const label = language === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'
  return (
    <button
      type="button"
      className={cn('language-toggle', className)}
      onClick={toggle}
      aria-label={label}
      title={label}
      data-language={language}
    >
      <FlagsCircle active={language} />
    </button>
  )
}

/** The two flags clipped into one circle. */
function FlagsCircle({ active }: { active: 'en' | 'vi' }) {
  const id = useId().replace(/:/g, '')
  const clip = `lang-clip-${id}`
  const faded = { opacity: 0.35, filter: 'grayscale(0.7)', transition: 'opacity .2s, filter .2s' }
  const full = { opacity: 1, filter: 'none', transition: 'opacity .2s, filter .2s' }
  return (
    <svg viewBox="0 0 32 32" width="1em" height="1em" aria-hidden focusable="false" style={{ width: 22, height: 22, flexShrink: 0 }}>
      <defs>
        <clipPath id={clip}>
          <circle cx="16" cy="16" r="15" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        {/* Vietnam: red field, yellow five-pointed star */}
        <g style={active === 'vi' ? full : faded}>
          <rect x="0" y="0" width="16" height="32" fill="#DA251D" />
          <polygon
            fill="#FFCD00"
            points="9,10.2 10.4,14.4 14.8,14.4 11.2,17 12.6,21.2 9,18.6 5.4,21.2 6.8,17 3.2,14.4 7.6,14.4"
          />
        </g>
        {/* United States: thirteen stripes, blue canton with stars */}
        <g style={active === 'en' ? full : faded}>
          <rect x="16" y="0" width="16" height="32" fill="#FFFFFF" />
          {Array.from({ length: 7 }, (_, i) => (
            <rect key={i} x="16" y={i * (32 / 6.5)} width="16" height={32 / 13} fill="#B22234" />
          ))}
          <rect x="16" y="0" width="9" height={(32 / 13) * 7} fill="#3C3B6E" />
          {[
            [18, 2.5], [21, 2.5], [23.5, 2.5],
            [19.5, 5.5], [22.5, 5.5],
            [18, 8.5], [21, 8.5], [23.5, 8.5],
            [19.5, 11.5], [22.5, 11.5],
            [18, 14.5], [21, 14.5], [23.5, 14.5],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="0.75" fill="#FFFFFF" />
          ))}
        </g>
        <line x1="16" y1="0" x2="16" y2="32" stroke="rgba(0,0,0,.25)" strokeWidth="0.6" />
      </g>
      <circle cx="16" cy="16" r="15" fill="none" stroke="rgba(127,127,127,.55)" strokeWidth="1" />
    </svg>
  )
}
