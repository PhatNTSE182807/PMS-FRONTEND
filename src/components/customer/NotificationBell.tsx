import { useEffect, useRef, useState } from 'react'
import { Bell, Check, CheckCheck, Trash2, Car, ShieldCheck, ShieldX, LogIn, LogOut as LogOutIcon } from 'lucide-react'
import { useNotifications, useMarkRead, useMarkAllRead, useDeleteNotification, useTimeAgo } from '@/hooks/useNotifications'
import type { NotificationModel } from '@/api/notification.service'

const ICON_MAP: Record<string, typeof Bell> = {
  VehicleApproved: ShieldCheck,
  VehicleRejected: ShieldX,
  CheckIn: LogIn,
  CheckOut: LogOutIcon,
}

const COLOR_MAP: Record<string, string> = {
  VehicleApproved: 'cx-notif__icon--success',
  VehicleRejected: 'cx-notif__icon--danger',
  CheckIn: 'cx-notif__icon--info',
  CheckOut: 'cx-notif__icon--warning',
}

/** Notification bell with dropdown for the customer nav bar. */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { data, isLoading } = useNotifications()
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()
  const deleteNotif = useDeleteNotification()
  const timeAgo = useTimeAgo()

  const items = data?.items ?? []
  const unreadCount = data?.unreadCount ?? 0

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const handleClick = (n: NotificationModel) => {
    if (!n.isRead) markRead.mutate(n.id)
  }

  return (
    <div className="cx-notif" ref={ref}>
      <button
        type="button"
        className="cx-btn cx-btn--ghost cx-notif__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="cx-notif__badge" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="cx-notif__dropdown" role="region" aria-label="Notifications">
          <div className="cx-notif__header">
            <h3 className="cx-notif__title">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                className="cx-notif__mark-all"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          <div className="cx-notif__list">
            {isLoading && (
              <div className="cx-notif__empty">Loading…</div>
            )}
            {!isLoading && items.length === 0 && (
              <div className="cx-notif__empty">
                <Car size={32} />
                <p>No notifications yet</p>
              </div>
            )}
            {items.map((n) => {
              const Icon = ICON_MAP[n.type] ?? Bell
              const colorClass = COLOR_MAP[n.type] ?? ''
              return (
                <div
                  key={n.id}
                  className={`cx-notif__item ${n.isRead ? '' : 'cx-notif__item--unread'}`}
                  onClick={() => handleClick(n)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleClick(n) }}
                >
                  <div className={`cx-notif__icon ${colorClass}`}>
                    <Icon size={18} />
                  </div>
                  <div className="cx-notif__content">
                    <p className="cx-notif__item-title">{n.title}</p>
                    <p className="cx-notif__item-msg">{n.message}</p>
                    <span className="cx-notif__time">{timeAgo(n.createdAt)}</span>
                  </div>
                  <div className="cx-notif__actions">
                    {!n.isRead && (
                      <button
                        type="button"
                        className="cx-notif__action-btn"
                        title="Mark as read"
                        onClick={(e) => { e.stopPropagation(); markRead.mutate(n.id) }}
                      >
                        <Check size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="cx-notif__action-btn cx-notif__action-btn--danger"
                      title="Delete"
                      onClick={(e) => { e.stopPropagation(); deleteNotif.mutate(n.id) }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
