import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { cn } from '@/lib/utils'

interface QrCodeProps {
  /** Text to encode: a signed reservation QR, a ticket, or a gateway payment URL. */
  value: string
  /** Accessible name. */
  label: string
  className?: string
}

/** A scannable QR code rendered as an inline SVG (dark modules on a light quiet zone, as scanners expect). */
export function QrCode({ value, label, className }: QrCodeProps) {
  const [svg, setSvg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toString(value, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, color: { dark: '#0b141b', light: '#ffffff' } })
      .then((markup) => {
        if (!cancelled) setSvg(markup)
      })
      .catch(() => {
        if (!cancelled) setSvg(null)
      })
    return () => {
      cancelled = true
    }
  }, [value])

  return (
    <div
      role="img"
      aria-label={label}
      className={cn('aspect-square overflow-hidden rounded-lg bg-white [&>svg]:size-full', className)}
      // The markup comes from the qrcode library, not from user input
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  )
}
