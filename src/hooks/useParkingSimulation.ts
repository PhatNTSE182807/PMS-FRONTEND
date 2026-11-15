import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/api/queryKeys'
import { lotRealtime } from '@/api/realtime'
import { invalidateFromPush } from '@/lib/realtimeInvalidate'
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

/** While vehicles are inside, how often the list is re-read so their automatic exits show up. */
const WALK_INS_INSIDE_REFRESH_MS = 10_000
/** With no vehicle inside nothing leaves by itself: a slow safety net only. */
const WALK_INS_IDLE_REFRESH_MS = 60_000

/**
 * Simulated walk-ins of the chosen lot. Every bay change of that lot (a vehicle entering or leaving) arrives on the
 * lot's SignalR channel and refreshes the list, coalesced; polling is only the fallback. It used to poll every
 * 3 seconds even with no vehicle inside.
 */
export function useWalkInSimulation(lotId?: number) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (lotId == null || !lotRealtime.isAvailable()) return
    return lotRealtime.watch(String(lotId), {
      onEvent: () => invalidateFromPush(queryClient, queryKeys.walkInSimulation(lotId)),
      onConnectionChange: () => {},
    })
  }, [lotId, queryClient])

  return useQuery({
    queryKey: queryKeys.walkInSimulation(lotId),
    queryFn: () => walkInSimulationService.overview(lotId),
    refetchInterval: (query) =>
      (query.state.data?.inside.length ?? 0) > 0 ? WALK_INS_INSIDE_REFRESH_MS : WALK_INS_IDLE_REFRESH_MS,
    refetchIntervalInBackground: false,
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.gateRequests.all })
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

export function useCheckOutAllWalkIns() {
  return useWalkInMutation(walkInSimulationService.checkOutAll, (r) =>
    toast.success(`${r.checkedOut} vehicles paid and left${r.skipped ? `; ${r.skipped} could not leave yet` : ''}.`),
  )
}

/** One walk-in for a free bay picked on the 3D model: it queues at the entry lane for the Staff to check in. */
export function useDeployWalkInToBay() {
  return useWalkInMutation(walkInSimulationService.deployToBay, (r) =>
    toast.success(`${r.plateNumber ?? 'A walk-in'} is waiting at the entry lane for bay ${r.slotCode ?? ''}.`, {
      description: 'Check it in on the Staff gate screen (Check-in lane). Several walk-ins queue one after another.',
    }),
  )
}

/** A walk-in parks by mistake in the booked bay picked on the 3D model. */
export function useOccupyBookedBayAt() {
  return useWalkInMutation(
    ({ lotId, slotId }: { lotId: number; slotId: number }) => walkInSimulationService.occupyBookedBay(lotId, slotId),
    (r) =>
      toast.success(
        `${r.plate} parked in booked bay ${r.bayCode} (booking ${r.reservationCode}).` +
          (r.caseId ? ' The lot\'s Staff got the case in Exceptions & Alerts and the customer was told their bay is taken.' : ''),
      ),
  )
}

export function useOccupyBookedBay() {
  return useWalkInMutation((lotId: number) => walkInSimulationService.occupyBookedBay(lotId), (r) =>
    toast.success(
      `${r.plate} parked in booked bay ${r.bayCode} (booking ${r.reservationCode}).` +
        (r.caseId
          ? ' The lot\'s Staff got the case in Exceptions & Alerts and the customer was told their bay is taken.'
          : ' A case for that booking was already open.'),
    ),
  )
}
