import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { identityService } from '@/api/identity.service'
import { queryKeys } from '@/api/queryKeys'
import type { StaffListQuery, UpdateUserCommand, UserStatus } from '@/types/identity.dto'

export function useStaffList(query: StaffListQuery) {
  return useQuery({
    queryKey: queryKeys.staff.list(query),
    queryFn: () => identityService.getStaff(query),
  })
}

/** Every staff mutation can move rows between filtered pages, so the whole list is refetched. */
function useStaffMutation<TVariables, TData>(mutationFn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.staff.all }),
  })
}

export const useCreateStaff = () => useStaffMutation(identityService.createStaff)

export const useUpdateStaff = () =>
  useStaffMutation(({ id, command }: { id: string; command: UpdateUserCommand }) => identityService.updateStaff(id, command))

export const useSetStaffStatus = () =>
  useStaffMutation(({ id, status }: { id: string; status: UserStatus }) => identityService.setStaffStatus(id, status))

export function useResetStaffPassword() {
  return useMutation({ mutationFn: identityService.resetStaffPassword })
}
