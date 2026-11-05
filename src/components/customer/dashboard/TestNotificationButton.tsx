import { Bell } from 'lucide-react'
import { useAddNotification } from '@/hooks/useNotifications'

/** Development only: sends a test notification to check the bell and its popup by eye. */
export function TestNotificationButton() {
  const addNotification = useAddNotification()

  return (
    <button
      type="button"
      className="cx-btn cx-btn--ghost"
      onClick={() => addNotification('Price Changed', 'A new price is waiting to be applied.')}
    >
      <Bell aria-hidden /> Test Notification
    </button>
  )
}
