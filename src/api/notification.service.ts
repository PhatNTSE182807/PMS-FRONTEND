import { http } from './axiosClient'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface NotificationModel {
  id: number
  type:
    | 'VehicleApproved'
    | 'VehicleRejected'
    | 'CheckIn'
    | 'CheckOut'
    | 'PriceChanged'
    /** A walk-in parked in the customer's booked bay, and what the lot did about it. */
    | 'BookedBayTaken'
    | 'BookedBayReassigned'
    | 'BookedBayFreed'
    | 'BookingCancelledByLot'
    | 'DepositRefunded'
    | 'CompensationPaid'
    /** A parked vehicle's scheduled booking ends soon, or has ended (also sent to the lot's Staff). */
    | 'DepartureSoon'
    | 'DepartureOverdue'
    /** The booked bay was still in use when the hold started, so the booking moved to another bay. */
    | 'BookingBayMoved'
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
