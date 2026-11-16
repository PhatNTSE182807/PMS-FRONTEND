import { useQuery } from '@tanstack/react-query'
import { workSchedulingApi } from '@/api/workScheduling.service'
import { useAuth } from './useAuth'
import { workSchedulingKeys } from './useWorkScheduling'

export function useRotationSetup(lotId: string) {
  const { user } = useAuth()
  const key = [...workSchedulingKeys, user?.userId, lotId]
  const groups = useQuery({ queryKey: [...key, 'rotation-groups'], queryFn: () => workSchedulingApi.rotationGroups(lotId) })
  const cycles = useQuery({ queryKey: [...key, 'rotation-cycles'], queryFn: () => workSchedulingApi.rotationCycles(lotId) })
  return { groups, cycles }
}
