import { useCallback, useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { notificationApi, type NotificationModel, type NotificationListModel } from '@/api/notification.service'
import { parkingOpsRealtime, type ParkingOpsEvent } from '@/api/parkingOpsRealtime'
import { queryKeys } from '@/api/queryKeys'
import { useAuth } from '@/hooks/useAuth'
import { USER_TOAST } from '@/lib/userToasts'

const BOOKED_BAY_TYPES = new Set<string>([
  'BookedBayTaken',
  'BookedBayReassigned',
  'BookedBayFreed',
  'BookingCancelledByLot',
  'DepositRefunded',
  'CompensationPaid',
])

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
  })

  // Real-time: a new notification arrives through the parking-ops hub
  useEffect(() => {
    if (!parkingOpsRealtime.isAvailable('booking')) return

    const unsubscribe = parkingOpsRealtime.subscribe((event: ParkingOpsEvent) => {
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
      }

      // A closed cash drawer waits in the Manager's Approval Queue
      if (notification.type === 'CashDrawerClosed') void queryClient.invalidateQueries({ queryKey: queryKeys.cashDrawer.all })

      const id = `notification-${notification.id}`
      if (notification.type === 'CheckIn') toast.success(USER_TOAST.checkedIn, { id })
      else if (notification.type === 'CheckOut' && !notification.data?.note) toast.success(USER_TOAST.checkedOut, { id })
      else toast.info(notification.title, { id, description: notification.message, duration: 5000 })
    })

    return unsubscribe
  }, [queryClient, take])

  return query
}

/** Test notifications live only in this browser: their negative ids never reach the API. */
let lastLocalId = 0

/** Adds a test notification to the bell and shows its popup; a reload or refetch of the list removes it. */
export function useAddNotification() {
  const queryClient = useQueryClient()
  return useCallback(
    (title: string, message: string) => {
      const notification: NotificationModel = {
        id: --lastLocalId,
        type: 'PriceChanged',
        title,
        message,
        refType: null,
        refId: null,
        eventAt: null,
        data: {},
        createdAt: new Date().toISOString(),
        readAt: null,
        isRead: false,
      }
      queryClient.setQueryData<NotificationListModel>(queryKeys.notifications.list(), (prev) => ({
        items: [notification, ...(prev?.items ?? [])],
        unreadCount: (prev?.unreadCount ?? 0) + 1,
      }))
      toast.info(title, { description: message, duration: 4000 })
    },
    [queryClient],
  )
}

/** Returns the unread count from the notification list (avoids a separate query). */
export function useUnreadCount(): number {
  return useNotifications().data?.unreadCount ?? 0
}

/** Mark one notification as read. */
export function useMarkRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number): Promise<NotificationModel> => {
      if (id >= 0) return notificationApi.markRead(id)
      const local = queryClient.getQueryData<NotificationListModel>(queryKeys.notifications.list())?.items.find((n) => n.id === id)
      return { ...local!, readAt: new Date().toISOString(), isRead: true }
    },
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
    mutationFn: async (id: number) => {
      if (id >= 0) await notificationApi.delete(id)
    },
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
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} min ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days} d ago`
    return new Date(iso).toLocaleDateString()
  }, [])
}
