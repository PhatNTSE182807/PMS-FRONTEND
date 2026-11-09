import { useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDeleteNotification, useMarkAllRead, useMarkRead, useNotifications, useTimeAgo } from '@/hooks/useNotifications'
import { cn } from '@/lib/utils'
import type { NotificationModel } from '@/api/notification.service'

/** Dot colour per notification type: a taken bay needs action, the rest are done. */
const TONE: Record<string, string> = {
  BookedBayTaken: 'bg-rose-500',
  BookedBayReassigned: 'bg-indigo-500',
  CompensationPaid: 'bg-emerald-500',
  DepositRefunded: 'bg-emerald-500',
  DepartureOverdue: 'bg-amber-500',
  CashDrawerClosed: 'bg-amber-500',
}

/** A cash drawer closed off the expected cash stands out from one that balances. */
const toneOf = (n: NotificationModel) =>
  n.type === 'CashDrawerClosed' && Number(n.data?.difference ?? 0) !== 0 ? 'bg-rose-500' : TONE[n.type] ?? 'bg-slate-400'

/**
 * Notification bell of the Staff and Manager consoles (same API and live push as the customer bell).
 * Staff: booked bays a walk-in took, bookings moved to another bay, the compensation sent to customers, and booked
 * vehicles that stayed past their time.
 * Manager: cash drawers their Staff closed, and how each taken booked bay was handled (moved, or compensated).
 */
export function ConsoleNotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { data, isLoading } = useNotifications()
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()
  const remove = useDeleteNotification()
  const timeAgo = useTimeAgo()
  const items = data?.items ?? []
  const unread = data?.unreadCount ?? 0

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative"
      >
        <Bell />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="region"
          aria-label="Notifications"
          className="absolute right-0 z-30 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden max-sm:fixed max-sm:inset-x-4 max-sm:top-16 max-sm:w-auto rounded-xl bg-white shadow-xl ring-1 ring-slate-200"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <p className="font-semibold text-slate-950">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline disabled:opacity-60"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                <CheckCheck className="size-3.5" aria-hidden /> Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-[26rem] divide-y divide-slate-200 overflow-y-auto">
            {isLoading && <li className="px-4 py-6 text-center text-sm text-slate-600">Loading…</li>}
            {!isLoading && items.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-slate-600">No notifications yet.</li>
            )}
            {items.map((n) => (
              <li key={n.id} className={cn('group flex gap-3 px-4 py-3', !n.isRead && 'bg-slate-50')}>
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', toneOf(n), n.isRead && 'opacity-40')} aria-hidden />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => !n.isRead && markRead.mutate(n.id)}>
                  <p className={cn('text-sm text-slate-950', !n.isRead && 'font-semibold')}>{n.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-700">{n.message}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{timeAgo(n.createdAt)}</p>
                </button>
                <button
                  type="button"
                  aria-label="Delete notification"
                  className="self-start rounded p-1 text-slate-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-rose-600 focus:opacity-100"
                  onClick={() => remove.mutate(n.id)}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
