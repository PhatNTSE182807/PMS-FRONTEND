import { LiveLotModel } from '@/components/features/lots/LiveLotModel'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useParkingLots } from '@/hooks/useParking'
import type { HubPerformanceDTO } from '@/types/dashboard.dto'

interface HubModelDialogProps {
  hub: HubPerformanceDTO | null
  onOpenChange: (open: boolean) => void
}

/**
 * The live 3D model of one hub: booked bays, vehicles parked in them, and walk-ins (drawn from the zone
 * counters) — every vehicle inside, refreshed as the gates and sensors report them.
 */
export function HubModelDialog({ hub, onOpenChange }: HubModelDialogProps) {
  // The lot list knows the code and building template the model starts from
  const lots = useParkingLots()
  const lot = hub ? lots.data?.find((l) => l.id === String(hub.lotId)) : undefined
  const id = hub ? String(hub.lotId) : ''

  return (
    <Dialog open={hub !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        {hub && (
          <>
            <DialogHeader>
              <DialogTitle>{hub.lotName}</DialogTitle>
              <DialogDescription>{hub.location}</DialogDescription>
            </DialogHeader>
            <LiveLotModel
              className="p-0 ring-0"
              lots={[{ id, code: lot?.code ?? '', name: hub.lotName, layoutTemplate: lot?.layoutTemplate }]}
              lotId={id}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
