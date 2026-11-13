import { CircleCheck, Loader2, ScanLine, ShieldAlert, VideoOff } from 'lucide-react'
import type { LaneDirection } from '@/components/features/staff/GateLaneScene'
import { Input, Label } from '@/components/ui/form-controls'
import { ANPR_CONFIDENCE_THRESHOLD, type AnprStatus } from '@/hooks/useAnpr'
import { platesMatch, type LanePlate } from '@/hooks/useLanePlate'
import type { LanePlateRead } from '@/lib/gateLaneSignals'
import { cn } from '@/lib/utils'

const CAMERA_ID: Record<LaneDirection, string> = { entry: 'CAM-01', exit: 'CAM-03' }

const STATUS_TEXT: Record<Exclude<AnprStatus, 'ready'>, string> = {
  off: 'Plate reader turned off: type the plate on the vehicle.',
  offline: 'Camera offline: the plate reader is not answering. Type the plate on the vehicle.',
  untrained: 'Plate reader not trained yet: type the plate on the vehicle.',
}

/** What the read-only "Camera read" box says: the read plate, or why there is none. */
function CameraRead({ anpr, read, vehicleWaiting, direction }: { anpr: AnprStatus; read: LanePlateRead | null; vehicleWaiting: boolean; direction: LaneDirection }) {
  if (read?.state === 'read' && read.plate) {
    const confident = read.confidence >= ANPR_CONFIDENCE_THRESHOLD
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="font-mono text-2xl font-bold tracking-[0.12em] text-slate-950">{read.plate}</span>
        <span
          className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums', confident ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}
          title={confident ? 'The plate reader is sure of this read' : 'Low confidence: check the plate on the vehicle'}
        >
          {Math.round(read.confidence * 100)}% {confident ? 'confidence' : 'low, check it'}
        </span>
      </div>
    )
  }
  let icon = <ScanLine className="size-4 shrink-0" aria-hidden />
  let text: string
  if (read?.state === 'reading') {
    icon = <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
    text = 'Reading the plate…'
  } else if (read?.state === 'failed') {
    icon = <ShieldAlert className="size-4 shrink-0 text-rose-700" aria-hidden />
    text = `Read failed: ${read.message}. Type the plate on the vehicle.`
  } else if (read?.state === 'read') {
    icon = <ShieldAlert className="size-4 shrink-0 text-amber-700" aria-hidden />
    text = 'No plate found in the camera frame. Type the plate on the vehicle.'
  } else if (anpr !== 'ready') {
    icon = <VideoOff className="size-4 shrink-0 text-amber-700" aria-hidden />
    text = STATUS_TEXT[anpr]
  } else {
    text = vehicleWaiting ? 'Waiting for the vehicle to stop at the reading line…' : `Nothing read yet: no vehicle at the ${direction} barrier.`
  }
  return (
    <p className="flex items-start gap-2 text-sm text-slate-700">
      {icon}
      <span>{text}</span>
    </p>
  )
}

/** Whether the Staff plate matches the plate on record, shown under the field so the Staff retypes until it does. */
export function PlateMatch({ plate, recorded, label }: { plate: string; recorded: string; label: string }) {
  if (!plate.trim()) {
    return (
      <p className="flex items-start gap-2 text-sm text-slate-700">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden />
        <span>
          Type the plate on the vehicle: it must match the {label} <span className="font-mono font-bold text-slate-950">{recorded}</span> before the barrier opens.
        </span>
      </p>
    )
  }
  if (platesMatch(plate, recorded)) {
    return (
      <p className="flex items-start gap-2 text-sm font-medium text-emerald-700">
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Matches the {label} <span className="font-mono font-bold">{recorded}</span>.
        </span>
      </p>
    )
  }
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 p-2.5 text-sm font-medium text-rose-800 ring-1 ring-rose-200">
      <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        Plate mismatch: <span className="font-mono font-bold">{plate.trim()}</span> is not the {label} <span className="font-mono font-bold">{recorded}</span>. Check the vehicle and retype the plate; the barrier stays closed until it matches.
      </span>
    </p>
  )
}

/**
 * The lane's plate area: the read-only camera read, the Staff plate below it (filled from each new read, editable),
 * and, when the vehicle has a plate on record, whether the Staff plate matches it.
 */
export function LanePlateArea({
  lane,
  recorded,
  recordedLabel = 'recorded plate',
  disabled = false,
}: {
  lane: LanePlate
  /** The plate on record for the vehicle (booking or parked session); null when there is none to match. */
  recorded?: string | null
  recordedLabel?: string
  disabled?: boolean
}) {
  const inputId = `lane-plate-${lane.direction}`
  const mismatch = Boolean(recorded && lane.plate.trim() && !platesMatch(lane.plate, recorded))
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-well p-3.5 ring-1 ring-slate-200">
        <p className="mb-1.5 flex items-center justify-between gap-2 text-xs font-bold tracking-wider text-slate-700 uppercase">
          <span>Camera read</span>
          <span className="font-mono text-slate-600">{CAMERA_ID[lane.direction]}</span>
        </p>
        <CameraRead anpr={lane.anpr} read={lane.read} vehicleWaiting={lane.vehicleWaiting} direction={lane.direction} />
      </div>
      <div>
        <Label htmlFor={inputId}>Staff plate (filled from the camera, edit if it is wrong)</Label>
        <Input
          id={inputId}
          value={lane.plate}
          disabled={disabled}
          onChange={(e) => lane.setPlate(e.target.value.toUpperCase())}
          placeholder="51A-123.45"
          autoComplete="off"
          aria-invalid={mismatch || undefined}
          className={cn('font-mono text-base uppercase', mismatch && 'ring-2 ring-rose-400')}
        />
      </div>
      {recorded && !disabled && <PlateMatch plate={lane.plate} recorded={recorded} label={recordedLabel} />}
    </div>
  )
}
