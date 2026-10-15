import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { profileService } from '@/api/profile.service'
import { queryKeys } from '@/api/queryKeys'
import { session } from '@/lib/session'
import type { UpdateVehicleCommand } from '@/types/profile.dto'

export function useProfile() {
  return useQuery({ queryKey: queryKeys.profile.me(), queryFn: profileService.getProfile })
}

export function useVehicles() {
  return useQuery({ queryKey: queryKeys.profile.vehicles(), queryFn: profileService.getVehicles })
}

export function useVehicleTypes() {
  return useQuery({
    queryKey: queryKeys.profile.vehicleTypes(),
    queryFn: profileService.getVehicleTypes,
    staleTime: 60 * 60 * 1000,
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: profileService.updateProfile,
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.profile.me(), profile)
      session.updateUser({
        fullName: profile.fullName,
        email: profile.email,
        phoneNumber: profile.phoneNumber,
        avatarUrl: profile.avatarUrl ?? undefined,
      })
    },
  })
}

/** Vehicle mutations share one invalidation, because "default" changes touch several rows. */
function useVehicleMutation<TVariables, TData>(mutationFn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.profile.all }),
  })
}

export const useAddVehicle = () => useVehicleMutation(profileService.addVehicle)

export const useUpdateVehicle = () =>
  useVehicleMutation(({ vehicleId, command }: { vehicleId: string; command: UpdateVehicleCommand }) =>
    profileService.updateVehicle(vehicleId, command),
  )

export const useDeleteVehicle = () => useVehicleMutation(profileService.deleteVehicle)

export const useSetDefaultVehicle = () => useVehicleMutation(profileService.setDefaultVehicle)

export function useChangePassword() {
  return useMutation({ mutationFn: profileService.changePassword })
}
