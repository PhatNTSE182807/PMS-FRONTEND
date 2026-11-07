import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Camera, DoorOpen, History, Hourglass, Lock, LogIn, LogOut, ScanLine } from 'lucide-react'
import { anprService } from '@/api/anpr.service'
import {
  GateLaneScene,
  type GateLaneSceneHandle,
  type LaneDirection,
  type LanePhase,
  type LaneVehicle,
  type LaneView,
} from '@/components/features/staff/GateLaneScene'
import { useAnprStatus, type AnprStatus } from '@/hooks/useAnpr'
import { useGateLaneQueue } from '@/hooks/useGateLaneQueue'
import { gateLaneSignals, useActiveLane, useLaneSignal } from '@/lib/gateLaneSignals'
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

/** The next vehicle of one lane: the one the Staff is handling first, then the lot's live entries or exits. */
function useLaneSource(direction: LaneDirection, sessions: ParkingSessionDTO[] | undefined) {
  const queue = useGateLaneQueue(sessions, direction === 'entry' ? entryTimeOf : exitTimeOf)
  const queueNext = queue.next
  // The vehicle the Staff is handling at this lane comes first: it waits at the barrier until they open it
  const signal = useLaneSignal(direction)
  const vehicle = signal?.vehicle ?? queue.vehicle
  const signalKey = signal?.vehicle.key
  const done = useCallback(() => (signalKey ? gateLaneSignals.done(direction, signalKey) : queueNext()), [direction, signalKey, queueNext])
  return {
    vehicle,
    open: signal ? signal.open : true,
    /** Vehicles behind the one this lane shows. */
    waiting: queue.waiting + (signal && queue.vehicle ? 1 : 0),
    /** The Staff is handling this vehicle at the lane panel. */
    handled: Boolean(signal),
    done,
  }
}

const NO_OP = () => {}

interface LaneCameraProps {
  ids: Record<LaneView, string>
  direction: LaneDirection
  vehicle: LaneVehicle | null
  open: boolean
  onDone: () => void
  waiting: number
  /** The entry cameras replay how the vehicle at the exit lane came in, so the Staff can compare it. */
  replay: boolean
  now: number
  anpr: AnprStatus
}

function LaneCamera({ ids, direction, vehicle, open, onDone, waiting, replay, now, anpr }: LaneCameraProps) {
  const next = onDone
  const [phase, setPhase] = useState<LanePhase>('idle')
  const [read, setRead] = useState<PlateRead | null>(null)
  const [score, setScore] = useState({ reads: 0, matches: 0 })
  const scene = useRef<GateLaneSceneHandle>(null)
  const frontScene = useRef<GateLaneSceneHandle>(null)
  const label = direction === 'entry' ? 'Entry lane' : 'Exit lane'
  const PhaseIcon = replay ? History : PHASE_ICON[phase]
  const phaseText = replay ? (phase === 'reading' ? 'Check-in replay • Compare with the exit lane' : 'Check-in replay') : PHASE_TEXT[phase]
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
        // A replay shows the same vehicle as the exit lane: count it once, at the exit lane
        if (!replay) setScore((s) => ({ reads: s.reads + 1, matches: s.matches + (matches ? 1 : 0) }))
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

  const snapshot = async (view: LaneView) => {
    const frame = await (view === 'rear' ? scene : frontScene).current?.captureFrame()
    if (!frame) {
      toast.error('The camera frame could not be captured.')
      return
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    downloadFrame(frame.image, `${ids[view].toLowerCase()}-${vehicle?.plate.replace(/[^A-Z0-9]/gi, '') ?? 'empty'}-${stamp}.png`)
  }

  /** One camera of the lane; both show the same pass, the rear one reads the plate. */
  const tile = (view: LaneView) => (
    <figure className="relative aspect-video overflow-hidden rounded-lg bg-[#060f16] ring-1 ring-slate-200">
      {view === 'rear' ? (
        <GateLaneScene ref={scene} direction={direction} view="rear" vehicle={vehicle} open={open} onPhase={setPhase} onDone={next} className="absolute inset-0" />
      ) : (
        <GateLaneScene ref={frontScene} direction={direction} view="front" vehicle={vehicle} open={open} className="absolute inset-0" />
      )}
      <figcaption className="pointer-events-none absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-2 font-mono text-[11px] font-bold tracking-wider uppercase">
        <span className="rounded bg-black/60 px-1.5 py-0.5 text-slate-950">
          {ids[view]} · {VIEW_TEXT[view]}
        </span>
        {view === 'rear' && (
          <span className={cn('rounded bg-black/60 px-1.5 py-0.5', anpr === 'ready' ? 'text-emerald-500' : 'text-amber-500')}>{ANPR_STATUS_TEXT[anpr]}</span>
        )}
      </figcaption>
      {view === 'rear' && showPlate && (
        <div className="pointer-events-none absolute inset-x-0 top-10 flex flex-col items-center gap-1.5">
          <span className="rounded bg-indigo-300 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-950 uppercase">
            {replay ? 'Plate at check-in' : 'Recorded plate'}
          </span>
          <span className="rounded-md bg-black/75 px-3 py-1 font-mono text-base font-bold tracking-[0.15em] text-slate-950 ring-1 ring-slate-300">
            {vehicle.plate}
          </span>
          {currentRead && <ReadChip read={currentRead} />}
        </div>
      )}
      <div className="absolute inset-x-2.5 bottom-2.5 flex items-end justify-between gap-2 font-mono text-[11px] font-bold tracking-wider text-slate-900 uppercase">
        {replay ? (
          <span className="pointer-events-none flex items-center gap-1.5 rounded bg-black/60 px-1.5 py-0.5 text-amber-500">
            <History className="size-3" aria-hidden /> Replay · Check-in
          </span>
        ) : (
          <span className="pointer-events-none flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-rose-500" aria-hidden /> Live · {clock.format(now)}
          </span>
        )}
        <button
          type="button"
          className="rounded bg-black/50 p-1 text-slate-900 hover:bg-black/70 hover:text-slate-950"
          title="Save this camera frame"
          aria-label={`Save the ${label.toLowerCase()} ${VIEW_TEXT[view].toLowerCase()} frame`}
          onClick={() => void snapshot(view)}
        >
          <Camera className="size-3.5" aria-hidden />
        </button>
      </div>
    </figure>
  )

  return (
    <section aria-label={label} className="space-y-2">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs font-bold tracking-wider uppercase">
        <span className="flex items-center gap-2 text-slate-950">
          {direction === 'entry' ? <LogIn className="size-4 text-emerald-500" aria-hidden /> : <LogOut className="size-4 text-rose-500" aria-hidden />}
          {label}
        </span>
        <span
          className={cn('flex items-center gap-2', replay ? 'text-amber-500' : phase === 'passing' ? 'text-indigo-700' : phase === 'idle' ? 'text-slate-700' : 'text-amber-500')}
          aria-live="polite"
        >
          <PhaseIcon className="size-4" aria-hidden /> {phaseText}
        </span>
        <span className="flex items-center gap-3 font-mono text-slate-700">
          {(vehicle || waiting > 0) && (
            <span>
              {vehicle ? (vehicle.kind === 'motorbike' ? 'Motorbike' : vehicle.kind === 'suv' ? '7-seat car' : 'Car') : ''}
              {vehicle && waiting > 0 ? ' • ' : ''}
              {waiting > 0 ? `${waiting} waiting` : ''}
            </span>
          )}
          {score.reads > 0 && <span title="Plates the AI read the same as the recorded plate, since this screen was opened">AI {score.matches}/{score.reads}</span>}
        </span>
      </header>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {tile('rear')}
        {tile('front')}
      </div>
    </section>
  )
}

const VIEW_TEXT: Record<LaneView, string> = { rear: 'Rear camera', front: 'Front camera' }

type LaneSource = ReturnType<typeof useLaneSource>

/** Vehicles at a lane the board does not show, for the "waiting" hint in its header. */
const atLane = (source: LaneSource) => source.waiting + (source.vehicle ? 1 : 0)

/** Check-in board: the entry cameras show the vehicle coming in; the exit cameras stay empty. */
function CheckInBoard({ entry, exit, now, anpr }: { entry: LaneSource; exit: LaneSource; now: number; anpr: AnprStatus }) {
  return (
    <div className="space-y-5">
      <LaneCamera ids={{ rear: 'CAM-01', front: 'CAM-02' }} direction="entry" vehicle={entry.vehicle} open={entry.open} onDone={entry.done} waiting={entry.waiting} replay={false} now={now} anpr={anpr} />
      <LaneCamera ids={{ rear: 'CAM-03', front: 'CAM-04' }} direction="exit" vehicle={null} open={false} onDone={NO_OP} waiting={atLane(exit)} replay={false} now={now} anpr={anpr} />
    </div>
  )
}

/**
 * Check-out board: the exit cameras show the vehicle leaving and the entry cameras replay how it came in, stopped at
 * the reading line, so the Staff can check that the plate is the same.
 */
function CheckOutBoard({ entry, exit, now, anpr }: { entry: LaneSource; exit: LaneSource; now: number; anpr: AnprStatus }) {
  const exitVehicle = exit.vehicle
  // Its own key, so the entry cameras play the check-in drive from the start
  const replayVehicle = useMemo<LaneVehicle | null>(() => (exitVehicle ? { ...exitVehicle, key: `check-in-${exitVehicle.key}` } : null), [exitVehicle])
  return (
    <div className="space-y-5">
      {/* The replay stops at the reading line: the barrier stays down */}
      <LaneCamera ids={{ rear: 'CAM-01', front: 'CAM-02' }} direction="entry" vehicle={replayVehicle} open={false} onDone={NO_OP} waiting={atLane(entry)} replay={Boolean(replayVehicle)} now={now} anpr={anpr} />
      <LaneCamera ids={{ rear: 'CAM-03', front: 'CAM-04' }} direction="exit" vehicle={exitVehicle} open={exit.open} onDone={exit.done} waiting={exit.waiting} replay={false} now={now} anpr={anpr} />
    </div>
  )
}

/**
 * The gate cameras as 3D lanes, two per lane: the entry lane on top, the exit lane below. In each lane the rear
 * camera reads the plate on the back of the vehicle and the front camera faces its front (cars carry a plate
 * at both ends). Each tab of the lane panel has its own four cameras, shown with that tab:
 * - Check-in: the entry cameras show the vehicle coming in, the exit cameras stay empty;
 * - Check-out: the exit cameras show the vehicle leaving and the entry cameras replay how it came in.
 * Both boards stay mounted and run on their own, so switching tabs never restarts a vehicle waiting on the other one.
 */
export function GateLaneCameras({ sessions, history }: { sessions: ParkingSessionDTO[] | undefined; history: ParkingSessionDTO[] | undefined }) {
  const now = useNow(1000)
  const anpr = useAnprStatus()
  const entry = useLaneSource('entry', sessions)
  const exit = useLaneSource('exit', history)
  // The board of the lane panel's open tab (check-in when the panel is not there)
  const showExit = useActiveLane() === 'exit'

  return (
    <>
      <div hidden={showExit} aria-label="Check-in cameras">
        <CheckInBoard entry={entry} exit={exit} now={now} anpr={anpr} />
      </div>
      <div hidden={!showExit} aria-label="Check-out cameras">
        <CheckOutBoard entry={entry} exit={exit} now={now} anpr={anpr} />
      </div>
    </>
  )
}
