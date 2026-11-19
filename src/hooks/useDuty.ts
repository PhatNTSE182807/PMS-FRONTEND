import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { dutyApi } from '@/api/duty.service'
import { getErrorMessage } from '@/api/apiError'
import { parkingOpsRealtime } from '@/api/parkingOpsRealtime'
import { useAuth } from './useAuth'
import type { DutySlot } from '@/types/duty.dto'

export const dutyKeys = ['duty'] as const

/** Notification types that change what the duty board, the shift card or the leave lists show. */
export const DUTY_NOTIFICATION_TYPES = new Set(['DutyShiftChanged', 'DutyAbsent', 'DutyAttendanceChanged', 'DutyLeaveRequested', 'DutyLeaveDecided'])

/** Refreshes duty data on the lot's refresh signal, a duty notice, or a reconnect (polling is the fallback). */
export function useDutyRealtime(lotId?: string) {
  const client = useQueryClient()
  const { user } = useAuth()
  const userId = user?.userId
  useEffect(() => {
    if (!userId || !parkingOpsRealtime.isAvailable('gate')) return
    return parkingOpsRealtime.subscribe((event) => {
      if (event.type === 'ConnectionRestored' || event.type === 'DutyScheduleChanged'
        || (event.type === 'NotificationCreated' && DUTY_NOTIFICATION_TYPES.has(event.notification.type)))
        void client.invalidateQueries({ queryKey: dutyKeys })
    }, lotId)
  }, [client, lotId, userId])
}

/**
 * Duty pushes and duty notices refresh these lists while SignalR is live, so the timer is only a safety net then;
 * demo mode (no hub) keeps a 15 s poll.
 */
const live = {
  refetchInterval: () => (parkingOpsRealtime.isAvailable('gate') ? 2 * 60_000 : 15_000),
  refetchOnReconnect: 'always' as const,
}

export function useManagerDutyWeek(lotId: string, start: string) {
  useDutyRealtime(lotId)
  const { user } = useAuth()
  return useQuery({ queryKey: [...dutyKeys, user?.userId, 'week', lotId, start], queryFn: () => dutyApi.week(lotId, start), ...live })
}

export function useDutyCandidates(lotId: string, date: string, slot: DutySlot, excludeEmployeeId?: number, enabled = true) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...dutyKeys, user?.userId, 'candidates', lotId, date, slot, excludeEmployeeId],
    queryFn: () => dutyApi.candidates(lotId, date, slot, excludeEmployeeId),
    enabled,
  })
}

export function useLotLeave(lotId: string) {
  const { user } = useAuth()
  return useQuery({ queryKey: [...dutyKeys, user?.userId, 'leave', lotId], queryFn: () => dutyApi.lotLeave(lotId), ...live })
}

export function useStaffDutyWeek(start: string) {
  useDutyRealtime()
  const { user } = useAuth()
  return useQuery({ queryKey: [...dutyKeys, user?.userId, 'my-week', start], queryFn: () => dutyApi.myWeek(start), ...live })
}

/** Whether the signed-in Staff is on shift: drives the POS lock, the shift card and the Off duty page. */
export function useDutyStatus(enabled = true) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...dutyKeys, user?.userId, 'status'], queryFn: dutyApi.status, enabled: enabled && Boolean(user?.userId),
    refetchInterval: 30_000, refetchOnReconnect: 'always', refetchOnWindowFocus: true,
  })
}

export function useMyLeave() {
  const { user } = useAuth()
  return useQuery({ queryKey: [...dutyKeys, user?.userId, 'my-leave'], queryFn: dutyApi.myLeave, ...live })
}

export function useLeavePreview(from: string, to: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...dutyKeys, user?.userId, 'leave-preview', from, to],
    queryFn: () => dutyApi.previewLeave(from, to),
    enabled: Boolean(from && to),
  })
}

/** Runs a duty change, shows the result and refreshes every duty view. */
export function useDutyMutation(successMessage: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (operation: () => Promise<unknown>) => operation(),
    onSuccess: () => {
      toast.success(successMessage)
      void client.invalidateQueries({ queryKey: dutyKeys })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
      void client.invalidateQueries({ queryKey: dutyKeys })
    },
  })
}
