import { http } from './axiosClient'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface NotificationModel {
  id: number
  type: 'VehicleApproved' | 'VehicleRejected' | 'CheckIn' | 'CheckOut'
  title: string
  message: string
  refType: string | null
  refId: string | null
  eventAt: string | null
  data: Record<string, string>
  createdAt: string
  readAt: string | null
  isRead: boolean
}

export interface NotificationListModel {
  items: NotificationModel[]
  unreadCount: number
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

const BASE = '/notifications'

export const notificationApi = {
  /** Newest notifications (default 30) and the unread count. */
  getMine: (unreadOnly = false, take = 30) =>
    http.get<NotificationListModel>(`${BASE}?unreadOnly=${unreadOnly}&take=${take}`),

  /** Just the unread count (for the badge). */
  getUnreadCount: () => http.get<number>(`${BASE}/unread-count`),

  /** Marks one notification as read. */
  markRead: (id: number) => http.post<NotificationModel>(`${BASE}/${id}/read`),

  /** Marks all notifications as read. Returns how many changed. */
  markAllRead: () => http.post<number>(`${BASE}/read-all`),

  /** Deletes one notification. */
  delete: (id: number) => http.delete<unknown>(`${BASE}/${id}`),
}
