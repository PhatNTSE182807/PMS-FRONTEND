import { useId } from 'react'
import { useLanguage } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * Round button showing the flag of the current language over the whole circle: Vietnam in Vietnamese, the
 * United States in English. A click switches to the other language and flips to its flag. Unstyled like
 * ThemeToggle: each area passes the class of its own icon buttons.
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
      <FlagCircle language={language} />
    </button>
  )
}

/** Stars of the US canton: rows of 4 and 3, inside the part of the canton the circle shows. */
const US_STARS = [
  [5, 3.2], [8.3, 3.2], [11.6, 3.2],
  [3.4, 6.4], [6.7, 6.4], [10, 6.4], [13.3, 6.4],
  [5, 9.6], [8.3, 9.6], [11.6, 9.6],
  [3.4, 12.8], [6.7, 12.8], [10, 12.8], [13.3, 12.8],
]

/** The flag of the current language filling the whole circle. */
function FlagCircle({ language }: { language: 'en' | 'vi' }) {
  const id = useId().replace(/:/g, '')
  const clip = `lang-clip-${id}`
  return (
    // Keyed by language so the flip animation plays on every switch
    <svg
      key={language}
      className="language-toggle__flag"
      viewBox="0 0 32 32"
      width="1em"
      height="1em"
      aria-hidden
      focusable="false"
      style={{ width: 22, height: 22, flexShrink: 0 }}
    >
      <defs>
        <clipPath id={clip}>
          <circle cx="16" cy="16" r="15" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        {language === 'vi' ? (
          // Vietnam: red field, yellow five-pointed star in the middle
          <>
            <rect x="0" y="0" width="32" height="32" fill="#DA251D" />
            <polygon
              fill="#FFCD00"
              points="16,8.5 17.69,13.68 23.13,13.68 18.73,16.89 20.41,22.07 16,18.87 11.59,22.07 13.27,16.89 8.87,13.68 14.31,13.68"
            />
          </>
        ) : (
          // United States: thirteen red and white stripes, blue canton with white stars
          <>
            <rect x="0" y="0" width="32" height="32" fill="#FFFFFF" />
            {Array.from({ length: 7 }, (_, i) => (
              <rect key={i} x="0" y={i * (64 / 13)} width="32" height={32 / 13} fill="#B22234" />
            ))}
            <rect x="0" y="0" width="16" height={(32 / 13) * 7} fill="#3C3B6E" />
            {US_STARS.map(([cx, cy]) => (
              <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="0.9" fill="#FFFFFF" />
            ))}
          </>
        )}
      </g>
      <circle cx="16" cy="16" r="15" fill="none" stroke="rgba(127,127,127,.55)" strokeWidth="1" />
    </svg>
  )
}
