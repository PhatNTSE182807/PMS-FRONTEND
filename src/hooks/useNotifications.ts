import { useCallback, useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { notificationApi, type NotificationModel, type NotificationListModel } from '@/api/notification.service'
import { parkingOpsRealtime, type ParkingOpsEvent } from '@/api/parkingOpsRealtime'
import { queryKeys } from '@/api/queryKeys'
import { useAuth } from '@/hooks/useAuth'
import { USER_TOAST } from '@/lib/userToasts'
import { DUTY_NOTIFICATION_TYPES, dutyKeys } from './useDuty'
import { payrollKeys } from './usePayroll'
import { currentLocale, t } from '@/i18n'
import { tNotification } from '@/i18n/notifications'

const BOOKED_BAY_TYPES = new Set<string>([
  'BookedBayTaken',
  'BookedBayReassigned',
  'BookedBayFreed',
  'BookingCancelledByLot',
  'DepositRefunded',
  'CompensationPaid',
  'VehicleTowed',
])

/** Staff and Manager notices about how full a zone of their lot is. */
const FILL_TYPES = new Set<string>(['LotAlmostFull', 'LotFull', 'LotSpaceAvailable'])

/** Polling without SignalR (demo mode, hub down). */
const NOTIFICATIONS_REFRESH_MS = 30_000
/** Safety net while new notifications arrive as pushes. */
const NOTIFICATIONS_PUSHED_MS = 5 * 60_000

/** Loads the bell's notifications and keeps them up-to-date through SignalR. */
export function useNotifications(take = 30) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isLoggedIn = Boolean(user)

  const query = useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: () => notificationApi.getMine(false, take),
    enabled: isLoggedIn,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    // New notifications are pushed; while the hub is live the timer only covers a missed push
    refetchInterval: parkingOpsRealtime.isAvailable('booking') ? NOTIFICATIONS_PUSHED_MS : NOTIFICATIONS_REFRESH_MS,
  })

  // Real-time: a new notification arrives through the parking-ops hub
  useEffect(() => {
    if (!parkingOpsRealtime.isAvailable('booking')) return

    const unsubscribe = parkingOpsRealtime.subscribe((event: ParkingOpsEvent) => {
      // Back online after a drop: notifications created meanwhile were not pushed
      if (event.type === 'ConnectionRestored') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() })
        return
      }
      if (event.type !== 'NotificationCreated') return

      const { notification, unreadCount } = event

      // Optimistically inject it into the cache
      queryClient.setQueryData<NotificationListModel>(queryKeys.notifications.list(), (prev) => {
        if (!prev) return { items: [notification as NotificationModel], unreadCount }
        const exists = prev.items.some((n) => n.id === notification.id)
        return {
          items: exists ? prev.items : [notification as NotificationModel, ...prev.items].slice(0, take),
          unreadCount,
        }
      })

      // Popup for immediate feedback. The id stops several mounted copies of this hook showing it twice.
      // A check-out closed by the lot Manager (it carries a note) is not a normal exit: it keeps its own text.
      // A taken booked bay moves or cancels the booking and may put money in the wallet: refresh both
      if (BOOKED_BAY_TYPES.has(notification.type)) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all })
        if (notification.type === 'DepositRefunded' || notification.type === 'CompensationPaid')
          window.dispatchEvent(new Event('xxiv-wallet-updated'))
        // The towed vehicle is in another bay and owes a penalty: the map and the fee follow at once
        if (notification.type === 'VehicleTowed') void queryClient.invalidateQueries({ queryKey: queryKeys.parkingSessions.all })
      }

      // A closed cash drawer waits in the Manager's Approval Queue
      if (notification.type === 'CashDrawerClosed') void queryClient.invalidateQueries({ queryKey: queryKeys.cashDrawer.all })
      // Duty board, shift card and leave lists; a paid salary shows in My payslips
      if (DUTY_NOTIFICATION_TYPES.has(notification.type)) void queryClient.invalidateQueries({ queryKey: dutyKeys })
      if (notification.type === 'PayrollPaid' || notification.type === 'PayrollReady')
        void queryClient.invalidateQueries({ queryKey: payrollKeys })

      // Admin: a customer asked for their account to be deleted, so the customer list shows the request
      if (notification.type === 'AccountDeletionRequested') void queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
      if (notification.type === 'LotPricingChanged') void queryClient.invalidateQueries({ queryKey: queryKeys.pricing.all })

      // A zone of the lot filled up or has space again: the capacity numbers on screen are stale
      if (FILL_TYPES.has(notification.type)) void queryClient.invalidateQueries({ queryKey: queryKeys.parking.all })

      const id = `notification-${notification.id}`
      if (notification.type === 'LotFull') toast.warning(tNotification(notification.title), { id, description: tNotification(notification.message), duration: 8000 })
      else if (notification.type === 'CheckIn') toast.success(t(USER_TOAST.checkedIn), { id })
      else if (notification.type === 'CheckOut' && !notification.data?.note) toast.success(t(USER_TOAST.checkedOut), { id })
      else toast.info(tNotification(notification.title), { id, description: tNotification(notification.message), duration: 5000 })
    })

    return unsubscribe
  }, [queryClient, take])

  return query
}

/** Mark one notification as read. */
export function useMarkRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number): Promise<NotificationModel> => notificationApi.markRead(id),
    onSuccess: (updated) => {
      queryClient.setQueryData<NotificationListModel>(queryKeys.notifications.list(), (prev) => {
        if (!prev) return prev
        return {
          items: prev.items.map((n) => (n.id === updated.id ? updated : n)),
          unreadCount: Math.max(0, prev.unreadCount - 1),
        }
      })
    },
  })
}

/** Mark all notifications as read. */
export function useMarkAllRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => {
      queryClient.setQueryData<NotificationListModel>(queryKeys.notifications.list(), (prev) => {
        if (!prev) return prev
        return {
          items: prev.items.map((n) => ({ ...n, readAt: new Date().toISOString(), isRead: true })),
          unreadCount: 0,
        }
      })
    },
  })
}

/** Delete a notification. */
export function useDeleteNotification() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => notificationApi.delete(id),
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.list() })
      const prev = queryClient.getQueryData<NotificationListModel>(queryKeys.notifications.list())
      queryClient.setQueryData<NotificationListModel>(queryKeys.notifications.list(), (old) => {
        if (!old) return old
        const removed = old.items.find((n) => n.id === id)
        return {
          items: old.items.filter((n) => n.id !== id),
          unreadCount: removed && !removed.isRead ? Math.max(0, old.unreadCount - 1) : old.unreadCount,
        }
      })
      return { prev }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKeys.notifications.list(), ctx.prev)
    },
  })
}

/** Format a notification's timestamp as a relative string ("2 min ago", "3 h ago", etc.). */
export function useTimeAgo() {
  return useCallback((iso: string) => {
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
    if (seconds < 60) return t('just now')
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return t('{minutes} min ago', { minutes })
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return t('{hours} h ago', { hours })
    const days = Math.floor(hours / 24)
    if (days < 30) return t('{days} d ago', { days })
    return new Date(iso).toLocaleDateString(currentLocale())
  }, [])
}
