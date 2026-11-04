import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/api/queryKeys'
import { simulationService, walkInSimulationService } from '@/api/simulation.service'
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

/** Simulated walk-ins still inside; refreshed every few seconds so automatic exits show up. */
export function useWalkInSimulation(lotId?: number) {
  return useQuery({
    queryKey: queryKeys.walkInSimulation(lotId),
    queryFn: () => walkInSimulationService.overview(lotId),
    refetchInterval: 3_000,
  })
}

/** Any walk-in action changes the lot: refresh the list, the counters and the 3D map. */
function useWalkInMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>, onDone: (result: TResult) => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      onDone(result)
      void queryClient.invalidateQueries({ queryKey: ['parking-simulation', 'walk-ins'] })
      void queryClient.invalidateQueries({ queryKey: queryKeys.parking.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.layout.all })
    },
    onError: (error) => toastAdminError(error, { fallback: 'The simulation could not do that.' }),
  })
}

export function useDeployWalkIns() {
  return useWalkInMutation(walkInSimulationService.deploy, (r) =>
    r.stoppedReason
      ? toast.warning(`${r.entered} of ${r.requested} vehicles entered. Stopped: ${r.stoppedReason}`)
      : toast.success(`${r.entered} walk-in vehicles entered.`),
  )
}

export function useCheckOutWalkIn() {
  return useWalkInMutation(walkInSimulationService.checkOut, () => toast.success('The vehicle paid and left.'))
}

export function useCheckOutAllWalkIns() {
  return useWalkInMutation(walkInSimulationService.checkOutAll, (r) =>
    toast.success(`${r.checkedOut} vehicles paid and left${r.skipped ? `; ${r.skipped} could not leave yet` : ''}.`),
  )
}

export function useSimulateLostTicket() {
  return useWalkInMutation(
    ({ sessionId, conditionsMet }: { sessionId: number; conditionsMet: boolean }) =>
      walkInSimulationService.reportLostTicket(sessionId, conditionsMet),
    (_r) => toast.success('Lost ticket reported. The Staff decides it in Exceptions & Alerts.'),
  )
}

export function useOccupyBookedBay() {
  return useWalkInMutation(walkInSimulationService.occupyBookedBay, (r) =>
    toast.success(`${r.plate} parked in booked bay ${r.bayCode} (booking ${r.reservationCode}). Check that booking in at the entry lane.`),
  )
}
