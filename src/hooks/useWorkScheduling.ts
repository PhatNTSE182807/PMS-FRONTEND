import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { workSchedulingApi } from '@/api/workScheduling.service'
import { getErrorMessage } from '@/api/apiError'
import { useAuth } from './useAuth'
import { useEffect } from 'react'
import { parkingOpsRealtime } from '@/api/parkingOpsRealtime'

export const workSchedulingKeys = ['work-scheduling'] as const

export function useWorkScheduling(lotId: string) {
  useAttendanceRealtime(lotId)
  const { user } = useAuth()
  const key = [...workSchedulingKeys, user?.userId, lotId]
  const templates = useQuery({ queryKey: [...key, 'templates'], queryFn: () => workSchedulingApi.templates(lotId) })
  const staff = useQuery({ queryKey: [...key, 'staff'], queryFn: () => workSchedulingApi.staff(lotId) })
  const rosters = useQuery({ queryKey: [...key, 'rosters'], queryFn: () => workSchedulingApi.rosters(lotId), refetchInterval: 10_000, refetchOnReconnect: 'always' })
  return { templates, staff, rosters }
}

/** Keep the persisted notification bell as the fallback when a live push cannot be delivered. */
export function useScheduleMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (operation: () => Promise<unknown>) => operation(),
    onSuccess: () => {
      toast.success('Work schedule saved.')
      void client.invalidateQueries({ queryKey: workSchedulingKeys })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
      void client.invalidateQueries({ queryKey: workSchedulingKeys })
    },
  })
}

export function useMyWorkSchedule(from: string, to: string) {
  useAttendanceRealtime()
  const { user } = useAuth()
  return useQuery({ queryKey: [...workSchedulingKeys, user?.userId, 'mine', from, to],
    queryFn: () => workSchedulingApi.mine(from, to), enabled: Boolean(from && to && from <= to), refetchInterval: 10_000, refetchOnReconnect: 'always' })
}

export function useAttendanceRealtime(lotId?: string) {
  const client = useQueryClient()
  const { user } = useAuth()
  const userId = user?.userId
  useEffect(() => {
    if (!userId || !parkingOpsRealtime.isAvailable('gate')) return
    return parkingOpsRealtime.subscribe(event => {
      if (event.type === 'ConnectionRestored'
        || event.type === 'WorkAttendanceChanged'
        || (event.type === 'NotificationCreated' && ['AttendanceChanged', 'RosterPublished', 'RosterChanged', 'WorkRequestChanged'].includes(event.notification.type)))
        void client.invalidateQueries({ queryKey: workSchedulingKeys })
    }, lotId)
  }, [client, lotId, userId])
}

export function useAttendanceDetail(id: number) {
  const { user } = useAuth()
  return useQuery({ queryKey: [...workSchedulingKeys, user?.userId, 'attendance', id],
    queryFn: () => workSchedulingApi.attendance(id), refetchInterval: 10_000, refetchOnReconnect: 'always' })
}

export function useAttendanceMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (operation: () => Promise<unknown>) => operation(),
    onSuccess: () => { toast.success('Attendance updated.'); void client.invalidateQueries({ queryKey: workSchedulingKeys }) },
    onError: error => { toast.error(getErrorMessage(error)); void client.invalidateQueries({ queryKey: workSchedulingKeys }) } })
}
