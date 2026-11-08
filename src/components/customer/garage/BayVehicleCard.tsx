import type { CSSProperties, ReactNode } from 'react'
import { X } from 'lucide-react'

export interface BayVehicleRow {
  label: string
  value: ReactNode
  /** Draws the value larger, for the fee. */
  emphasis?: boolean
}

/**
 * Popup laid over the 3D lot model with the vehicle parked in a bay. Inline styles, so it looks the same in
 * the staff consoles (Tailwind) and the customer map (customer.css).
 */
export function BayVehicleCard({
  bayCode,
  title,
  badge,
  rows,
  footer,
  onClose,
}: {
  bayCode: string
  title: string
  badge?: { text: string; tone: 'member' | 'guest' | 'mine' }
  rows: BayVehicleRow[]
  footer?: ReactNode
  onClose: () => void
}) {
  const badgeColor = { member: 'var(--map-badge-member)', guest: 'var(--map-badge-guest)', mine: 'var(--map-badge-mine)' }[badge?.tone ?? 'member']
  return (
    <div role="dialog" aria-label={`${title}, bay ${bayCode}`} style={styles.card}>
      <div style={styles.head}>
        <div style={{ minWidth: 0 }}>
          <span style={styles.eyebrow}>{title}</span>
          <span style={styles.code}>Bay {bayCode}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close vehicle details" style={styles.close}>
          <X size={15} aria-hidden />
        </button>
      </div>
      {badge && (
        <span style={{ ...styles.badge, color: badgeColor, borderColor: badgeColor }}>
          {badge.text}
        </span>
      )}
      <dl style={styles.list}>
        {rows.map((row) => (
          <div key={row.label} style={styles.row}>
            <dt style={styles.label}>{row.label}</dt>
            <dd style={{ ...styles.value, ...(row.emphasis ? styles.emphasis : null) }}>{row.value}</dd>
          </div>
        ))}
      </dl>
      {footer && <div style={styles.footer}>{footer}</div>}
    </div>
  )
}

/** Message variant of the card: loading, empty bay, error. */
export function BayVehicleNotice({ bayCode, title, message, onClose }: { bayCode: string; title: string; message: string; onClose: () => void }) {
  return (
    <div role="dialog" aria-label={`${title}, bay ${bayCode}`} style={styles.card}>
      <div style={styles.head}>
        <div>
          <span style={styles.eyebrow}>{title}</span>
          <span style={styles.code}>Bay {bayCode}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close vehicle details" style={styles.close}>
          <X size={15} aria-hidden />
        </button>
      </div>
      <p style={styles.notice} role="status">
        {message}
      </p>
    </div>
  )
}

const styles = {
  card: {
    position: 'absolute',
    top: '0.6rem',
    right: '0.6rem',
    zIndex: 6,
    width: 'min(19rem, calc(100% - 1.2rem))',
    maxHeight: 'calc(100% - 3.6rem)',
    overflowY: 'auto',
    padding: '0.85rem 0.95rem',
    borderRadius: '0.7rem',
    background: 'var(--map-card-bg)',
    border: '1px solid var(--map-card-border)',
    boxShadow: 'var(--map-card-shadow)',
    color: 'var(--map-text)',
    fontSize: '0.8rem',
    backdropFilter: 'blur(6px)',
  },
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' },
  eyebrow: { display: 'block', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--map-muted)' },
  code: { display: 'block', marginTop: '0.1rem', fontSize: '1.05rem', fontWeight: 700, color: 'var(--map-accent)', fontFamily: '"Plus Jakarta Sans", Inter, sans-serif' },
  close: {
    display: 'inline-grid',
    placeItems: 'center',
    width: '1.7rem',
    height: '1.7rem',
    flexShrink: 0,
    borderRadius: '0.4rem',
    border: '1px solid var(--map-card-border)',
    background: 'transparent',
    color: 'var(--map-text)',
    cursor: 'pointer',
  },
  badge: { display: 'inline-block', marginTop: '0.55rem', padding: '0.1rem 0.5rem', borderRadius: '999px', border: '1px solid', fontSize: '0.7rem', fontWeight: 700 },
  list: { margin: '0.65rem 0 0', display: 'grid', gap: '0.4rem' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem' },
  label: { color: 'var(--map-muted)', flexShrink: 0 },
  value: { margin: 0, fontWeight: 600, textAlign: 'right', overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' },
  emphasis: { fontSize: '1rem', color: 'var(--map-good)' },
  footer: { marginTop: '0.7rem', paddingTop: '0.6rem', borderTop: '1px solid var(--map-card-border)', color: 'var(--map-muted)', fontSize: '0.72rem' },
  notice: { margin: '0.6rem 0 0', color: 'var(--map-text-soft)', lineHeight: 1.45 },
} satisfies Record<string, CSSProperties>
