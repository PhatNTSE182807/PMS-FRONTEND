import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { identityService } from '@/api/identity.service'
import { queryKeys } from '@/api/queryKeys'
import type { ManagedStaffQuery, UpdateEmployeeCommand, UserStatus } from '@/types/identity.dto'

/** Staff of the signed-in Manager's lots (the backend checks the lot is theirs). */
export function useManagedStaff(query: ManagedStaffQuery) {
  return useQuery({
    queryKey: queryKeys.team.list(query),
    queryFn: () => identityService.getManagedStaff(query),
  })
}

/** Every mutation can move a person between lots or filters, so all staff lists are refetched. */
function useTeamMutation<TVariables, TData>(mutationFn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.staff.all }),
  })
}

export const useCreateManagedStaff = () => useTeamMutation(identityService.createManagedStaff)

/** Saves the details, then moves the person if the lot changed. */
export const useUpdateManagedStaff = () =>
  useTeamMutation(async ({ id, command, parkingLotId }: { id: string; command: UpdateEmployeeCommand; parkingLotId?: string }) => {
    const updated = await identityService.updateManagedStaff(id, command)
    return parkingLotId ? identityService.assignManagedStaffLot(id, parkingLotId) : updated
  })

export const useSetManagedStaffStatus = () =>
  useTeamMutation(({ id, status }: { id: string; status: UserStatus }) => identityService.setManagedStaffStatus(id, status))

export const useDeleteManagedStaff = () => useTeamMutation(identityService.deleteManagedStaff)
