import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/api/queryKeys'
import { simulationService } from '@/api/simulation.service'
import { toastAdminError } from '@/lib/adminToasts'
import type { UpdateParkingSimulationCommand } from '@/types/simulation.dto'

/** The Admin's parking simulation and the normal values it replaces. */
export function useParkingSimulation() {
  return useQuery({ queryKey: queryKeys.parkingSimulation, queryFn: simulationService.get })
}

/** Saves the simulation; it applies to every lot at once. */
export function useUpdateParkingSimulation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (command: UpdateParkingSimulationCommand) => simulationService.update(command),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.parkingSimulation, saved)
      toast.success(saved.enabled ? 'Parking simulation is on in every lot.' : 'Parking simulation is off: normal rules apply.')
    },
    onError: (error) => toastAdminError(error, { fallback: 'Could not save the parking simulation.' }),
  })
}
