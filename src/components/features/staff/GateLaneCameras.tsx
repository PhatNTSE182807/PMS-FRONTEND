import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Camera, DoorOpen, Hourglass, Lock, ScanLine } from 'lucide-react'
import { GateLaneScene, type GateLaneSceneHandle, type LaneDirection, type LanePhase } from '@/components/features/staff/GateLaneScene'
import { useGateLaneQueue } from '@/hooks/useGateLaneQueue'
import { useNow } from '@/hooks/useNow'
import { cn } from '@/lib/utils'
import type { ParkingSessionDTO } from '@/types/operations.dto'

const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

// Module-level so the lane queues keep a stable reference
const entryTimeOf = (s: ParkingSessionDTO) => s.entryTime
const exitTimeOf = (s: ParkingSessionDTO) => s.exitTime

const PHASE_TEXT: Record<LanePhase, string> = {
  idle: 'Lane clear • Barrier closed',
  arriving: 'Vehicle approaching',
  reading: 'Vehicle at the camera • Reading plate',
  passing: 'Barrier open • Vehicle passing',
}

const PHASE_ICON: Record<LanePhase, typeof Lock> = {
  idle: Lock,
  arriving: Hourglass,
  reading: ScanLine,
  passing: DoorOpen,
}

/** Saves the camera's current frame as a PNG (to collect images for the plate reader). */
function downloadFrame(image: Blob, name: string) {
  const url = URL.createObjectURL(image)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

function LaneCamera({ id, direction, sessions, now }: { id: string; direction: LaneDirection; sessions: ParkingSessionDTO[] | undefined; now: number }) {
  const { vehicle, waiting, next } = useGateLaneQueue(sessions, direction === 'entry' ? entryTimeOf : exitTimeOf)
  const [phase, setPhase] = useState<LanePhase>('idle')
  const scene = useRef<GateLaneSceneHandle>(null)
  const label = direction === 'entry' ? 'Entry lane' : 'Exit lane'
  const PhaseIcon = PHASE_ICON[phase]
  const showPlate = vehicle && (phase === 'reading' || phase === 'passing')

  const snapshot = async () => {
    const frame = await scene.current?.captureFrame()
    if (!frame) {
      toast.error('The camera frame could not be captured.')
      return
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    downloadFrame(frame.image, `${id.toLowerCase()}-${vehicle?.plate.replace(/[^A-Z0-9]/gi, '') ?? 'empty'}-${stamp}.png`)
  }

  return (
    <figure className="overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200">
      <div className="relative aspect-video overflow-hidden bg-[#060f16]">
        <GateLaneScene ref={scene} direction={direction} vehicle={vehicle} onPhase={setPhase} onDone={next} className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2 font-mono text-[11px] font-bold tracking-wider uppercase">
          <span className="rounded bg-black/60 px-1.5 py-0.5 text-slate-950">
            {id} [{label}]
          </span>
          <span className="rounded bg-black/60 px-1.5 py-0.5 text-amber-500">3D lane view</span>
        </div>
        {showPlate && (
          <div className="pointer-events-none absolute inset-x-0 top-11 flex flex-col items-center gap-1.5">
            <span className="rounded bg-indigo-300 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-950 uppercase">Recorded plate</span>
            <span className="rounded-md bg-black/75 px-3 py-1 font-mono text-base font-bold tracking-[0.15em] text-slate-950 ring-1 ring-slate-300">
              {vehicle.plate}
            </span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-2 font-mono text-[11px] font-bold tracking-wider text-slate-900 uppercase">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-rose-500" aria-hidden /> Live
          </span>
          <span>{clock.format(now)}</span>
        </div>
      </div>
      <figcaption className="flex items-center justify-between gap-3 px-4 py-3 text-xs font-bold tracking-wider uppercase">
        <span className={cn('flex items-center gap-2', phase === 'passing' ? 'text-indigo-700' : phase === 'idle' ? 'text-slate-700' : 'text-amber-500')} aria-live="polite">
          <PhaseIcon className="size-4" aria-hidden /> {PHASE_TEXT[phase]}
        </span>
        <span className="flex items-center gap-3">
          {vehicle && (
            <span className="font-mono text-slate-700">
              {vehicle.kind === 'motorbike' ? 'Motorbike' : 'Car'}
              {waiting > 0 ? ` • ${waiting} waiting` : ''}
            </span>
          )}
          <button
            type="button"
            className="rounded p-1 text-slate-700 hover:bg-slate-100 hover:text-slate-950"
            title="Save this camera frame"
            aria-label={`Save the ${label.toLowerCase()} camera frame`}
            onClick={() => void snapshot()}
          >
            <Camera className="size-4" aria-hidden />
          </button>
        </span>
      </figcaption>
    </figure>
  )
}

/**
 * The two gate cameras as 3D lanes: every vehicle that enters or leaves the lot while the screen is open
 * drives through its lane with its own number plate.
 */
export function GateLaneCameras({ sessions, history }: { sessions: ParkingSessionDTO[] | undefined; history: ParkingSessionDTO[] | undefined }) {
  const now = useNow(1000)
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <LaneCamera id="CAM-01" direction="entry" sessions={sessions} now={now} />
      <LaneCamera id="CAM-02" direction="exit" sessions={history} now={now} />
    </div>
  )
}
