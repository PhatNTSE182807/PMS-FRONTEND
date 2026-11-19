import { useId, type ComponentProps, type SVGProps } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import '@/styles/vnpay.css'

/** VNPAY brand colors, taken from the official logo. */
const VNPAY_RED = '#E31E25'
const VNPAY_BLUE = '#005BAA'
const VNPAY_LIGHT_BLUE = '#5BC2F0'

/**
 * The VNPAY mark drawn inline (no external logo request): a blue card with a light-blue fingerprint,
 * and a red card folded over it into a V. Decorative, so it is hidden from screen readers by default.
 */
export function VnpayMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  // Unique clip id so several marks on one page do not share a clip path
  const clipId = `vnpay-blue-card-${useId().replace(/:/g, '')}`
  return (
    <svg viewBox="4 6 88 76" aria-hidden="true" focusable="false" className={cn('vnpay-mark', className)} {...props}>
      <defs>
        <clipPath id={clipId}>
          <rect x="14" y="16" width="40" height="40" rx="9" transform="rotate(45 34 36)" />
        </clipPath>
      </defs>
      {/* Blue card, tilted into a diamond */}
      <rect x="14" y="16" width="40" height="40" rx="9" transform="rotate(45 34 36)" fill={VNPAY_BLUE} />
      {/* Fingerprint ridges on the blue card */}
      <g clipPath={`url(#${clipId})`} fill="none" stroke={VNPAY_LIGHT_BLUE} strokeWidth="2.4" strokeLinecap="round">
        <path d="M29.2 38.6 A4 4 0 1 1 36.8 38.6" />
        <path d="M25.2 35.5 A9 9 0 1 1 41.9 41.6" />
        <path d="M21.5 32 A14 14 0 1 1 45.7 45.9" />
        <path d="M18.4 27.8 A19 19 0 0 1 47.6 52.2" />
        <path d="M12.2 28 A24 24 0 0 1 45 60.8" />
      </g>
      {/* Red card over the lower edge of the blue one, rising to the right into a V */}
      <rect x="27" y="33" width="66" height="30" rx="9" transform="rotate(-45 60 48)" fill={VNPAY_RED} />
      {/* White crease where the red card folds over the blue one */}
      <path d="M32.4 60 L49.4 43" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

/** The "VNPAY" wordmark: "VN" in red, "PAY" in blue. */
export function VnpayWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('vnpay-wordmark', className)}>
      <span style={{ color: VNPAY_RED }}>VN</span>
      <span style={{ color: VNPAY_BLUE }}>PAY</span>
    </span>
  )
}

type VnpayButtonProps = Omit<ComponentProps<'button'>, 'children'> & {
  /** Shows a spinner in place of the mark and disables the button. */
  loading?: boolean
  /** Extra word after the wordmark, e.g. "QR". */
  suffix?: string
}

/**
 * Pay-with-VNPAY button, styled like the brand (white card, mark and two-color wordmark) and shared by
 * every screen that offers VNPAY. Layout classes (e.g. `cx-btn` in the customer area) can be passed in;
 * the brand colors in vnpay.css win over them.
 */
export function VnpayButton({
  loading = false,
  suffix,
  disabled,
  className,
  type = 'button',
  'aria-label': ariaLabel,
  ...props
}: VnpayButtonProps) {
  return (
    <button
      type={type}
      className={cn('vnpay-btn', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={ariaLabel ?? `Pay with VNPAY${suffix ? ` ${suffix}` : ''}`}
      {...props}
    >
      {loading ? <Loader2 className="vnpay-btn__spinner" aria-hidden /> : <VnpayMark className="vnpay-btn__mark" />}
      <VnpayWordmark />
      {suffix && <span className="vnpay-btn__suffix">{suffix}</span>}
    </button>
  )
}
