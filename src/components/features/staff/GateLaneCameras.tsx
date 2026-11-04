import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Camera, DoorOpen, Hourglass, Lock, ScanLine } from 'lucide-react'
import { anprService } from '@/api/anpr.service'
import { GateLaneScene, type GateLaneSceneHandle, type LaneDirection, type LanePhase } from '@/components/features/staff/GateLaneScene'
import { useAnprStatus, type AnprStatus } from '@/hooks/useAnpr'
import { useGateLaneQueue } from '@/hooks/useGateLaneQueue'
import { gateLaneSignals, useLaneSignal } from '@/lib/gateLaneSignals'
import { useNow } from '@/hooks/useNow'
import { cn } from '@/lib/utils'
import type { ParkingSessionDTO } from '@/types/operations.dto'

const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** Below this the gate asks the Staff to confirm the plate (backend Parking:Gate:AnprConfidenceThreshold). */
const ANPR_CONFIDENCE_THRESHOLD = 0.85
/** Frames go to the plate reader at the camera's resolution, the size it was trained on. */
const CAMERA_FRAME = { width: 1280, height: 720 }
/** Let the vehicle settle at the reading line before the frame is taken. */
const READ_DELAY_MS = 300

const ANPR_STATUS_TEXT: Record<AnprStatus, string> = {
  off: '3D lane view',
  offline: 'ANPR offline',
  untrained: 'ANPR not trained',
  ready: 'ANPR ready',
}

/** The plate reader's result for the vehicle at the camera. */
type PlateRead =
  | { key: string; state: 'reading' }
  | { key: string; state: 'read'; plate: string; confidence: number; matches: boolean }
  | { key: string; state: 'failed'; message: string }

const plainPlate = (plate: string) => plate.toUpperCase().replace(/[^0-9A-Z]/g, '')

/** "AI read" line: green when it matches with confidence, amber when the Staff must confirm, red when it differs. */
function ReadChip({ read }: { read: PlateRead }) {
  if (read.state === 'reading') {
    return <span className="rounded-md bg-black/75 px-2 py-0.5 font-mono text-xs font-bold text-slate-900">AI reading…</span>
  }
  if (read.state === 'failed') {
    return <span className="rounded-md bg-black/75 px-2 py-0.5 font-mono text-xs font-bold text-rose-500">AI read failed: {read.message}</span>
  }
  const confident = read.confidence >= ANPR_CONFIDENCE_THRESHOLD
  const tone = !read.plate ? 'text-rose-500' : !confident ? 'text-amber-500' : read.matches ? 'text-emerald-500' : 'text-rose-500'
  const verdict = !read.plate ? 'No plate read' : !confident ? 'Staff check' : read.matches ? 'Match' : 'Mismatch'
  return (
    <span className={cn('rounded-md bg-black/75 px-2 py-0.5 font-mono text-xs font-bold', tone)}>
      AI read {read.plate || '—'} • {Math.round(read.confidence * 100)}% • {verdict}
    </span>
  )
}

// Module-level so the lane queues keep a stable reference
const entryTimeOf = (s: ParkingSessionDTO) => s.entryTime
const exitTimeOf = (s: ParkingSessionDTO) => s.exitTime

const PHASE_TEXT: Record<LanePhase, string> = {
  idle: 'Lane clear • Barrier closed',
  arriving: 'Vehicle approaching',
  reading: 'Vehicle at the barrier • Waiting for Staff',
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

function LaneCamera({ id, direction, sessions, now, anpr }: { id: string; direction: LaneDirection; sessions: ParkingSessionDTO[] | undefined; now: number; anpr: AnprStatus }) {
  const queue = useGateLaneQueue(sessions, direction === 'entry' ? entryTimeOf : exitTimeOf)
  const queueNext = queue.next
  // The vehicle the Staff is handling at this lane comes first: it waits at the barrier until they open it
  const signal = useLaneSignal(direction)
  const vehicle = signal?.vehicle ?? queue.vehicle
  const open = signal ? signal.open : true
  const waiting = queue.waiting + (signal && queue.vehicle ? 1 : 0)
  const signalKey = signal?.vehicle.key
  const next = useCallback(() => (signalKey ? gateLaneSignals.done(direction, signalKey) : queueNext()), [direction, signalKey, queueNext])
  const [phase, setPhase] = useState<LanePhase>('idle')
  const [read, setRead] = useState<PlateRead | null>(null)
  const [score, setScore] = useState({ reads: 0, matches: 0 })
  const scene = useRef<GateLaneSceneHandle>(null)
  const label = direction === 'entry' ? 'Entry lane' : 'Exit lane'
  const PhaseIcon = PHASE_ICON[phase]
  const showPlate = vehicle && (phase === 'reading' || phase === 'passing')
  const currentRead = read && vehicle && read.key === vehicle.key ? read : null

  // Once per vehicle: when it stops at the camera, send the frame to the plate reader
  useEffect(() => {
    if (phase !== 'reading' || anpr !== 'ready' || !vehicle || read?.key === vehicle.key) return
    const { key, plate: recorded } = vehicle
    const controller = new AbortController()
    setRead({ key, state: 'reading' })
    const timer = window.setTimeout(async () => {
      try {
        const frame = await scene.current?.captureFrame({ size: CAMERA_FRAME, type: 'image/jpeg' })
        if (!frame) throw new Error('no camera frame')
        const result = await anprService.read(frame.image, controller.signal)
        const best = result.plates[0]
        const matches = Boolean(best?.plate) && plainPlate(best.plate) === plainPlate(recorded)
        setRead({ key, state: 'read', plate: best?.plate ?? '', confidence: best?.confidence ?? 0, matches })
        setScore((s) => ({ reads: s.reads + 1, matches: s.matches + (matches ? 1 : 0) }))
      } catch (e) {
        if (controller.signal.aborted) return
        setRead({ key, state: 'failed', message: e instanceof Error ? e.message : 'unknown error' })
      }
    }, READ_DELAY_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
    // Runs when the vehicle reaches the camera; `read` is only checked to read each vehicle once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, anpr, vehicle])

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
        <GateLaneScene ref={scene} direction={direction} vehicle={vehicle} open={open} onPhase={setPhase} onDone={next} className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2 font-mono text-[11px] font-bold tracking-wider uppercase">
          <span className="rounded bg-black/60 px-1.5 py-0.5 text-slate-950">
            {id} [{label}]
          </span>
          <span className={cn('rounded bg-black/60 px-1.5 py-0.5', anpr === 'ready' ? 'text-emerald-500' : 'text-amber-500')}>{ANPR_STATUS_TEXT[anpr]}</span>
        </div>
        {showPlate && (
          <div className="pointer-events-none absolute inset-x-0 top-11 flex flex-col items-center gap-1.5">
            <span className="rounded bg-indigo-300 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-950 uppercase">Recorded plate</span>
            <span className="rounded-md bg-black/75 px-3 py-1 font-mono text-base font-bold tracking-[0.15em] text-slate-950 ring-1 ring-slate-300">
              {vehicle.plate}
            </span>
            {currentRead && <ReadChip read={currentRead} />}
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
          {score.reads > 0 && (
            <span className="font-mono text-slate-700" title="Plates the AI read the same as the recorded plate, since this screen was opened">
              AI {score.matches}/{score.reads}
            </span>
          )}
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
  const anpr = useAnprStatus()
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <LaneCamera id="CAM-01" direction="entry" sessions={sessions} now={now} anpr={anpr} />
      <LaneCamera id="CAM-02" direction="exit" sessions={history} now={now} anpr={anpr} />
    </div>
  )
}
