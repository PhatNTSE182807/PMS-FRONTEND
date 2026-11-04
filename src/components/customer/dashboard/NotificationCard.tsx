import { Bell, Check, CheckCheck, LogIn, LogOut, ShieldAlert, ShieldCheck, ShieldX, Tag } from 'lucide-react'
import { useNotifications, useMarkRead, useMarkAllRead, useTimeAgo } from '@/hooks/useNotifications'
import type { NotificationModel } from '@/api/notification.service'

const ICON_MAP: Record<string, typeof Bell> = {
  VehicleApproved: ShieldCheck,
  VehicleRejected: ShieldX,
  CheckIn: LogIn,
  CheckOut: LogOut,
  PriceChanged: Tag,
}

const BADGE_MAP: Record<string, { label: string; className: string }> = {
  VehicleApproved: { label: 'Vehicle Approved', className: 'cx-chip--gold' },
  VehicleRejected: { label: 'Vehicle Rejected', className: 'cx-chip--muted' },
  CheckIn: { label: 'Gate Check-In', className: '' },
  CheckOut: { label: 'Gate Check-Out', className: '' },
  PriceChanged: { label: 'Price Change', className: 'cx-chip--gold' },
}

export function NotificationCard() {
  const { data, isLoading } = useNotifications()
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()
  const timeAgo = useTimeAgo()

  const items = (data?.items ?? []).slice(0, 4)
  const unreadCount = data?.unreadCount ?? 0

  return (
    <section className="cx-card" aria-labelledby="notifications-card-title">
      <div className="cx-card__head" style={{ marginBottom: '1rem' }}>
        <div>
          <h2 className="cx-card__title" id="notifications-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={18} style={{ color: 'var(--cx-gold, #f59e0b)' }} aria-hidden /> Activity Notifications
            {unreadCount > 0 && (
              <span className="cx-chip cx-chip--gold" style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem' }}>
                {unreadCount} new
              </span>
            )}
          </h2>
          <p className="cx-card__subtitle">
            Vehicle approvals, gate check-in &amp; check-out events, price changes
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            className="cx-btn cx-btn--sm cx-btn--ghost"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            style={{ fontSize: '0.75rem' }}
          >
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      <div className="cx-stack" style={{ gap: '0.6rem' }}>
        {isLoading && (
          <p className="cx-card__subtitle" style={{ padding: '1rem 0', textAlign: 'center' }}>
            Loading activity notifications…
          </p>
        )}

        {!isLoading && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--cx-text-muted)' }}>
            <ShieldAlert size={28} style={{ opacity: 0.3, margin: '0 auto 0.5rem' }} />
            <p style={{ margin: 0, fontSize: '0.85rem' }}>No recent activity notifications.</p>
          </div>
        )}

        {items.map((n: NotificationModel) => {
          const Icon = ICON_MAP[n.type] ?? Bell
          const badge = BADGE_MAP[n.type] ?? { label: n.type, className: '' }

          return (
            <div
              key={n.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.7rem 0.85rem',
                borderRadius: 'var(--cx-radius-md, 0.5rem)',
                background: n.isRead ? 'rgba(255, 255, 255, 0.02)' : 'rgba(245, 158, 11, 0.05)',
                border: n.isRead ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(245, 158, 11, 0.25)',
                transition: 'background 0.15s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '0.5rem',
                  background: n.type === 'VehicleApproved'
                    ? 'rgba(34, 197, 94, 0.15)'
                    : n.type === 'VehicleRejected'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'rgba(245, 158, 11, 0.15)',
                  color: n.type === 'VehicleApproved'
                    ? '#22c55e'
                    : n.type === 'VehicleRejected'
                    ? '#ef4444'
                    : '#f59e0b',
                  flexShrink: 0,
                  marginTop: '0.1rem',
                }}
              >
                <Icon size={16} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--cx-text, #ffffff)' }}>{n.title}</strong>
                  <span className={`cx-chip ${badge.className}`} style={{ fontSize: '0.65rem', padding: '0.05rem 0.35rem' }}>
                    {badge.label}
                  </span>
                </div>
                <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.785rem', color: 'var(--cx-text-muted, #9ca3af)', lineHeight: 1.35 }}>
                  {n.message}
                </p>
                <span style={{ fontSize: '0.7rem', color: 'var(--cx-text-subtle, #6b7280)' }}>
                  {timeAgo(n.createdAt)}
                </span>
              </div>

              {!n.isRead && (
                <button
                  type="button"
                  className="cx-btn cx-btn--sm cx-btn--ghost"
                  title="Mark as read"
                  onClick={() => markRead.mutate(n.id)}
                  style={{ padding: '0.25rem', height: 'auto', flexShrink: 0 }}
                >
                  <Check size={14} />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
