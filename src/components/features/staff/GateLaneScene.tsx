import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { buildCoupeModel } from '@/components/customer/garage/carModels'
import { buildBikeModel, type PartSlot, type VehicleModel } from '@/components/customer/garage/vehicleModels'
import { drawPlate, PLATE_SIZE, type PlateShape } from '@/lib/vnPlate'
import { cn } from '@/lib/utils'

/**
 * One gate lane in 3D, seen by its fixed ANPR camera. Each vehicle drives up to the reading line,
 * stops with its rear plate in front of the camera, the barrier lifts and it drives through.
 * The canvas is a stand-in for a real camera feed: `captureFrame` hands out the frame (and where
 * the plate is in it) the same way a camera would, so a plate reader can be plugged in later.
 */

export type LaneDirection = 'entry' | 'exit'
export type LaneVehicleKind = 'car' | 'motorbike'
/** idle: lane empty; arriving: driving up; reading: stopped at the camera; passing: barrier open, driving through. */
export type LanePhase = 'idle' | 'arriving' | 'reading' | 'passing'

export interface LaneVehicle {
  /** Unique per pass through the lane (a new key replays the animation). */
  key: string
  plate: string
  kind: LaneVehicleKind
}

/** A box in the frame, 0..1 from the top-left corner. */
export interface FrameBox {
  x: number
  y: number
  width: number
  height: number
}

export interface LaneFrame {
  image: Blob
  width: number
  height: number
  /** Plate position in the frame; null when no plate is in view. */
  plateBox: FrameBox | null
  /** Each character printed on the plate and where it is in the frame (separators are left out). */
  chars: { char: string; box: FrameBox }[]
}

/** One posed, still picture of the lane for the plate reader's training images. */
export interface LaneSample {
  plate: string
  kind: LaneVehicleKind
  /** Metres left/right of the lane centre and before/after the reading line. */
  offsetX: number
  offsetZ: number
  /** Vehicle turned away from the lane axis, in radians. */
  yaw: number
  /** Camera moved from its mount (metres) and its field of view (degrees). */
  camera: { dx: number; dy: number; dz: number; fov: number }
  /** Overall brightness, 1 = normal. */
  exposure: number
  /** 0 = barrier down, 1 = fully up. */
  barrierLift: number
  /** 0..1: dirt and wear on the plate. */
  grime: number
  paint: number
}

export interface GateLaneSceneHandle {
  /** The current frame; `size` draws it at that resolution (as the real camera would send it). */
  captureFrame: (options?: { size?: { width: number; height: number }; type?: 'image/png' | 'image/jpeg' }) => Promise<LaneFrame | null>
  /** Poses the sample, draws it at the given size and returns the labelled frame (JPEG). */
  renderSample: (sample: LaneSample, size: { width: number; height: number }) => Promise<LaneFrame | null>
}

interface GateLaneSceneProps {
  direction: LaneDirection
  vehicle: LaneVehicle | null
  /**
   * The barrier may open for the vehicle. False: it drives up and waits at the closed barrier until this
   * turns true (the Staff opened it). True from the start: it drives up, stops briefly and drives through.
   */
  open?: boolean
  onPhase?: (phase: LanePhase) => void
  /** The vehicle has left the picture: the next one can come. */
  onDone?: () => void
  className?: string
  ref?: Ref<GateLaneSceneHandle>
}

/* Timeline of one pass, in seconds */
const T_ARRIVE = 3
const T_READ = 1.8
const T_BARRIER = 0.8
const T_PASS = 2.6

/** Rear plate of every vehicle stops here, about 3.7 m in front of the camera. */
const READ_Z = -5
const CAMERA_POS = new THREE.Vector3(0.9, 2.2, -8.4)
const CAMERA_TARGET = new THREE.Vector3(0, 0.5, -2.2)
const BARRIER_Z = 0.7
export const CAMERA_FOV = 34

/** Where the rear plate sits on each model (models face +z, rear at -z). */
const REAR_PLATE: Record<LaneVehicleKind, { shape: PlateShape; y: number; z: number; tilt: number }> = {
  car: { shape: 'long', y: 0.57, z: -2.47, tilt: 0 },
  motorbike: { shape: 'square', y: 0.79, z: -0.86, tilt: 0.2 },
}

/** Plates are drawn larger than real life so Staff can read them on the small camera view. */
const PLATE_SCALE = 1.5

const PAINTS = [0xd9dde2, 0x1d2329, 0x9a1f24, 0x2f4f7a, 0x6e7378, 0xf1f1ee, 0x2e5e4e, 0xb88a2c]

const easeOut = (t: number) => 1 - (1 - t) ** 3
const easeIn = (t: number) => t ** 3
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

function hash(text: string) {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(h)
}

/** A vehicle placed in the scene, with its rear plate and where each character is on it. */
interface BuiltVehicle {
  group: THREE.Group
  plate: THREE.Mesh
  kind: LaneVehicleKind
  /** Character boxes in the plate's own coordinates (metres, centre of the plate at 0,0). */
  glyphs: { char: string; x0: number; y0: number; x1: number; y1: number }[]
  dispose: () => void
}

/** Dirt, scratches and fading on a plate canvas, so the training images are not all spotless. */
function soilPlate(canvas: HTMLCanvasElement, amount: number) {
  const ctx = canvas.getContext('2d')
  if (!ctx || amount <= 0) return
  const { width, height } = canvas
  ctx.save()
  ctx.globalAlpha = 0.18 * amount
  ctx.fillStyle = '#6b5a3e'
  ctx.fillRect(0, 0, width, height)
  for (let i = 0; i < 40 * amount; i++) {
    ctx.globalAlpha = 0.1 + Math.random() * 0.35 * amount
    ctx.fillStyle = Math.random() < 0.7 ? '#4a3b28' : '#d9d4c7'
    const r = (0.01 + Math.random() * 0.05) * height
    ctx.beginPath()
    ctx.ellipse(Math.random() * width, Math.random() * height, r * (1 + Math.random() * 3), r, Math.random() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** Builds a vehicle with its paint and plate, out of sight until it is positioned. */
function buildVehicle(
  s: { scene: THREE.Scene; renderer: THREE.WebGLRenderer; models: Record<LaneVehicleKind, VehicleModel>; materials: Record<PartSlot, THREE.Material> },
  plateText: string,
  kind: LaneVehicleKind,
  paintHex: number,
  grime = 0,
): BuiltVehicle {
  const group = new THREE.Group()
  const paint = (s.materials.paint as THREE.MeshStandardMaterial).clone()
  paint.color.setHex(paintHex)
  for (const [slot, geometry] of s.models[kind]) {
    group.add(new THREE.Mesh(geometry, slot === 'paint' ? paint : s.materials[slot]))
  }

  const spot = REAR_PLATE[kind]
  const size = PLATE_SIZE[spot.shape]
  const drawn = drawPlate(plateText, spot.shape)
  soilPlate(drawn.canvas, grime)
  const plateTexture = new THREE.CanvasTexture(drawn.canvas)
  plateTexture.colorSpace = THREE.SRGBColorSpace
  plateTexture.anisotropy = s.renderer.capabilities.getMaxAnisotropy()
  const plateGeometry = new THREE.PlaneGeometry(size.width, size.height)
  const plateMaterial = new THREE.MeshStandardMaterial({ map: plateTexture, roughness: 0.45, emissive: 0xffffff, emissiveMap: plateTexture, emissiveIntensity: 0.12 })
  const plate = new THREE.Mesh(plateGeometry, plateMaterial)
  plate.position.set(0, spot.y, spot.z - 0.005)
  plate.rotation.set(spot.tilt, Math.PI, 0)
  plate.scale.setScalar(PLATE_SCALE)
  group.add(plate)
  if (kind === 'car') {
    // Cars carry a plate at the front too
    const front = new THREE.Mesh(plateGeometry, plateMaterial)
    front.position.set(0, 0.36, 2.48)
    front.scale.setScalar(PLATE_SCALE)
    group.add(front)
  }
  group.position.set(kind === 'car' ? 0 : 0.4, 0, -30)
  s.scene.add(group)

  // Canvas pixels -> plate metres (texture u runs along the plane's local x, v upwards)
  const toLocalX = (px: number) => (px / drawn.canvas.width - 0.5) * size.width
  const toLocalY = (py: number) => (0.5 - py / drawn.canvas.height) * size.height
  const glyphs = drawn.glyphs.map((g) => ({ char: g.char, x0: toLocalX(g.x), x1: toLocalX(g.x + g.width), y0: toLocalY(g.y + g.height), y1: toLocalY(g.y) }))

  return {
    group,
    plate,
    kind,
    glyphs,
    dispose: () => {
      s.scene.remove(group)
      paint.dispose()
      plateTexture.dispose()
      plateGeometry.dispose()
      plateMaterial.dispose()
    },
  }
}

/** Where a rectangle on the plate lands in the frame; null when it is out of view. */
function projectBox(plate: THREE.Mesh, camera: THREE.Camera, x0: number, y0: number, x1: number, y1: number): FrameBox | null {
  const corners = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ].map(([x, y]) => new THREE.Vector3(x, y, 0).applyMatrix4(plate.matrixWorld).project(camera))
  if (!corners.every((c) => c.z < 1)) return null
  const xs = corners.map((c) => (c.x + 1) / 2)
  const ys = corners.map((c) => (1 - c.y) / 2)
  if (Math.max(...xs) <= 0 || Math.min(...xs) >= 1 || Math.max(...ys) <= 0 || Math.min(...ys) >= 1) return null
  const x = clamp01(Math.min(...xs))
  const y = clamp01(Math.min(...ys))
  const width = clamp01(Math.max(...xs)) - x
  const height = clamp01(Math.max(...ys)) - y
  return width > 0 && height > 0 ? { x, y, width, height } : null
}

/** Plate and character boxes of a vehicle in the current frame. */
function labelsOf(vehicle: BuiltVehicle, camera: THREE.Camera): Pick<LaneFrame, 'plateBox' | 'chars'> {
  vehicle.group.updateMatrixWorld(true)
  const { width, height } = PLATE_SIZE[REAR_PLATE[vehicle.kind].shape]
  const plateBox = projectBox(vehicle.plate, camera, -width / 2, -height / 2, width / 2, height / 2)
  const chars = vehicle.glyphs.flatMap((g) => {
    const box = projectBox(vehicle.plate, camera, g.x0, g.y0, g.x1, g.y1)
    return box ? [{ char: g.char, box }] : []
  })
  return { plateBox, chars: plateBox ? chars : [] }
}

/** Red and white stripes for the barrier arm. */
function stripeTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 16
  const ctx = canvas.getContext('2d')!
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#d7262e' : '#f2f2f2'
    ctx.fillRect(i * 32, 0, 32, 16)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** The lit sign over the lane. */
function signTexture(direction: LaneDirection) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = direction === 'entry' ? '#0f6b3a' : '#8a1c1c'
  ctx.fillRect(0, 0, 512, 128)
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 72px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(direction === 'entry' ? 'ENTRY ▲' : 'EXIT ▲', 256, 68)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function GateLaneScene({ direction, vehicle, open = true, onPhase, onDone, className, ref }: GateLaneSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const callbacks = useRef({ onPhase, onDone })
  useEffect(() => {
    callbacks.current = { onPhase, onDone }
  }, [onPhase, onDone])

  // Live objects of the scene, filled by the set-up effect
  const stage = useRef<{
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    barrier: THREE.Object3D
    models: Record<LaneVehicleKind, VehicleModel>
    materials: Record<PartSlot, THREE.Material>
    render: () => void
    resize: () => void
    play: () => void
    /** openAt: when the barrier starts lifting (performance.now() time); null while waiting for the Staff. */
    current: (BuiltVehicle & { startedAt: number; openAt: number | null }) | null
  } | null>(null)

  /* Static scene: lane, booth, barrier, walls, lights and the camera */
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const disposables: { dispose: () => void }[] = []
    const track = <T extends { dispose: () => void }>(item: T) => {
      disposables.push(item)
      return item
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0f14)
    scene.fog = new THREE.Fog(0x0a0f14, 14, 34)
    const pmrem = new THREE.PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    scene.environment = track(pmrem.fromScene(room, 0.04).texture)
    scene.environmentIntensity = 0.35
    room.dispose()
    pmrem.dispose()

    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 16 / 9, 0.1, 60)
    camera.position.copy(CAMERA_POS)
    camera.lookAt(CAMERA_TARGET)

    const std = (params: THREE.MeshStandardMaterialParameters) => track(new THREE.MeshStandardMaterial(params))
    const box = (w: number, h: number, d: number) => track(new THREE.BoxGeometry(w, h, d))
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(x, y, z)
      scene.add(mesh)
      return mesh
    }

    /* Floor, lane lines, kerbs and the side wall */
    const asphalt = std({ color: 0x2a2e33, roughness: 0.85, metalness: 0.05 })
    const yellow = std({ color: 0xe8c22e, roughness: 0.6 })
    const white = std({ color: 0xe9ecef, roughness: 0.6 })
    const concrete = std({ color: 0x5b6168, roughness: 0.9 })
    const floor = add(track(new THREE.PlaneGeometry(14, 70)), asphalt, 0, 0, 8)
    floor.rotation.x = -Math.PI / 2
    for (const x of [-1.7, 1.7]) add(box(0.12, 0.01, 70), yellow, x, 0.005, 8)
    add(box(3.3, 0.01, 0.3), white, 0, 0.006, READ_Z - 0.3) // reading line
    for (let z = -4; z < 30; z += 3) add(box(0.14, 0.01, 1.4), white, 0, 0.006, z + 3.5) // dashed centre after the barrier
    add(box(1.4, 0.18, 9), concrete, -2.55, 0.09, -1) // island with the booth
    add(box(0.3, 4.2, 70), concrete, 3.6, 2.1, 8) // side wall
    add(box(0.3, 4.2, 70), concrete, -4.4, 2.1, 8)
    add(box(9, 0.2, 70), std({ color: 0x1c2127, roughness: 0.95 }), -0.4, 4.2, 8) // ceiling

    /* Pillars and ceiling light strips */
    const pillar = std({ color: 0x6d737a, roughness: 0.8 })
    const stripe = std({ color: 0xf2c230, roughness: 0.6 })
    const lightStrip = std({ color: 0xffffff, emissive: 0xf4f7ff, emissiveIntensity: 2.2 })
    for (let z = -6; z < 34; z += 7) {
      add(box(0.5, 4.2, 0.5), pillar, 3.2, 2.1, z)
      add(box(0.52, 0.5, 0.52), stripe, 3.2, 0.25, z)
      add(box(0.18, 0.04, 2.4), lightStrip, 0, 4.08, z + 1)
      const lamp = new THREE.PointLight(0xf1f4ff, 9, 9, 1.6)
      lamp.position.set(0, 3.8, z + 1)
      scene.add(lamp)
    }
    scene.add(new THREE.HemisphereLight(0xcfd8e3, 0x1a1d21, 0.55))
    const key = new THREE.DirectionalLight(0xffffff, 0.6)
    key.position.set(3, 6, -9)
    scene.add(key)

    /* Ticket booth at the reading line and the barrier */
    const boothBody = std({ color: 0x2b3a47, roughness: 0.5, metalness: 0.3 })
    const glass = std({ color: 0x8fd3ff, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.35 })
    add(box(1.1, 2.3, 1.6), boothBody, -2.6, 1.33, 0.2)
    add(box(1.12, 0.9, 1.2), glass, -2.6, 1.7, 0.2)
    add(box(0.35, 1.25, 0.3), boothBody, -2.05, 0.8, READ_Z + 0.2) // ticket and QR kiosk
    add(box(0.28, 0.2, 0.02), std({ color: 0x0b1b2b, emissive: 0x2a8cff, emissiveIntensity: 0.9 }), -2.05, 1.2, READ_Z + 0.36)
    add(box(0.32, 1.1, 0.32), std({ color: 0xc9a227, roughness: 0.5 }), -1.95, 0.55, BARRIER_Z) // barrier post

    const stripes = track(stripeTexture())
    stripes.wrapS = THREE.RepeatWrapping
    stripes.repeat.set(2, 1)
    const barrier = new THREE.Group()
    barrier.position.set(-1.95, 1.0, BARRIER_Z)
    const arm = new THREE.Mesh(box(3.6, 0.09, 0.07), std({ map: stripes, roughness: 0.5 }))
    arm.position.x = 1.8
    barrier.add(arm)
    scene.add(barrier)

    const sign = add(track(new THREE.PlaneGeometry(1.6, 0.4)), track(new THREE.MeshBasicMaterial({ map: track(signTexture(direction)) })), 0, 3.5, BARRIER_Z + 1)
    sign.rotation.y = Math.PI

    /* Vehicles: shared geometry and materials */
    const car = buildCoupeModel()
    const bike = buildBikeModel()
    ;[...car.values(), ...bike.values()].forEach((g) => track(g))
    const materials: Record<PartSlot, THREE.Material> = {
      paint: std({ color: 0xffffff, metalness: 0.45, roughness: 0.32, side: THREE.DoubleSide }),
      glass: std({ color: 0x1b2833, metalness: 0.6, roughness: 0.12, transparent: true, opacity: 0.78, side: THREE.DoubleSide }),
      tyre: std({ color: 0x17191c, roughness: 0.92 }),
      rim: std({ color: 0xc9ccd1, metalness: 0.85, roughness: 0.3 }),
      trim: std({ color: 0x1b1e22, metalness: 0.3, roughness: 0.6 }),
      chrome: std({ color: 0xdfe3e8, metalness: 1, roughness: 0.22 }),
      frame: std({ color: 0x2a2d31, metalness: 0.5, roughness: 0.5 }),
      seat: std({ color: 0x3b2a20, roughness: 0.8 }),
      interior: std({ color: 0xa8784f, roughness: 0.75 }),
      caliper: std({ color: 0xb3121b, roughness: 0.4 }),
      headlight: std({ color: 0xffffff, emissive: 0xfff4d6, emissiveIntensity: 1.2 }),
      taillight: std({ color: 0x8b0000, emissive: 0xff2b2b, emissiveIntensity: 1.1 }),
    }

    const render = () => renderer.render(scene, camera)

    /* Animation: runs only while a vehicle is in the lane */
    let frame = 0
    let lastPhase: LanePhase | null = null
    const setPhase = (phase: LanePhase) => {
      if (phase === lastPhase) return
      lastPhase = phase
      callbacks.current.onPhase?.(phase)
    }
    const tick = () => {
      frame = 0
      const current = stage.current?.current
      if (!current) {
        barrier.rotation.z = 0
        setPhase('idle')
        render()
        return
      }
      const now = performance.now()
      const t = (now - current.startedAt) / 1000
      const stopZ = READ_Z - REAR_PLATE[current.kind].z
      const opening = current.openAt != null && now >= current.openAt
      if (!opening) {
        // Driving up, then waiting at the reading line with the barrier down
        const arrived = t >= T_ARRIVE
        current.group.position.z = arrived ? stopZ : stopZ - 14 * (1 - easeOut(t / T_ARRIVE))
        barrier.rotation.z = 0
        setPhase(arrived ? 'reading' : 'arriving')
        render()
        // Nothing moves while it waits for the Staff: the loop starts again when the barrier opens
        if (arrived && current.openAt == null) return
        frame = requestAnimationFrame(tick)
        return
      }

      // The barrier lifts; the vehicle moves off once it is half up, then the barrier drops behind it
      const u = (now - current.openAt!) / 1000
      const drive = Math.max(0, u - T_BARRIER * 0.6)
      current.group.position.z = stopZ + 24 * easeIn(clamp01(drive / T_PASS))
      const lift = drive < T_PASS - 0.4 ? clamp01(u / T_BARRIER) : 1 - clamp01((drive - (T_PASS - 0.4)) / T_BARRIER)
      barrier.rotation.z = (Math.PI / 2) * 0.94 * easeOut(lift)
      setPhase('passing')
      render()

      if (drive >= T_PASS + 0.6) {
        current.dispose()
        if (stage.current) stage.current.current = null
        barrier.rotation.z = 0
        setPhase('idle')
        render()
        callbacks.current.onDone?.()
        return
      }
      frame = requestAnimationFrame(tick)
    }
    const play = () => {
      if (!frame) frame = requestAnimationFrame(tick)
    }

    const resize = () => {
      const { width, height } = host.getBoundingClientRect()
      if (!width || !height) return
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      render()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()

    stage.current = { renderer, scene, camera, barrier, models: { car, motorbike: bike }, materials, render, resize, play, current: null }

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      stage.current?.current?.dispose()
      stage.current = null
      disposables.forEach((item) => item.dispose())
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [direction])

  const openRef = useRef(open)
  useEffect(() => {
    openRef.current = open
  }, [open])

  /* A new vehicle: build it with its own paint and plate, then drive it up */
  useEffect(() => {
    const s = stage.current
    if (!s) return
    if (!vehicle) {
      // The Staff refused (or moved on from) the waiting vehicle: it leaves the picture; one already let through drives on
      if (s.current && s.current.openAt == null) {
        s.current.dispose()
        s.current = null
        s.play()
      }
      return
    }
    s.current?.dispose()
    const startedAt = performance.now()
    s.current = {
      ...buildVehicle(s, vehicle.plate, vehicle.kind, PAINTS[hash(vehicle.plate) % PAINTS.length]),
      startedAt,
      // Already allowed through: a short stop at the camera, then the barrier lifts
      openAt: openRef.current ? startedAt + (T_ARRIVE + T_READ) * 1000 : null,
    }
    s.play()
  }, [vehicle])

  /* The Staff opened the barrier: lift it as soon as the vehicle has driven up */
  useEffect(() => {
    const s = stage.current
    if (!open || !s?.current || s.current.openAt != null) return
    s.current.openAt = Math.max(performance.now(), s.current.startedAt + T_ARRIVE * 1000)
    s.play()
  }, [open, vehicle])

  useImperativeHandle(ref, () => ({
    captureFrame: (options) => {
      const s = stage.current
      if (!s) return Promise.resolve(null)
      const { renderer, camera } = s
      const size = options?.size
      const pixelRatio = renderer.getPixelRatio()
      if (size) {
        // Draw at the camera's own resolution, whatever the size on screen
        renderer.setPixelRatio(1)
        renderer.setSize(size.width, size.height, false)
        camera.aspect = size.width / size.height
        camera.updateProjectionMatrix()
      }
      // Draw and read in the same task: the drawing buffer is not kept between frames
      s.render()
      const canvas = renderer.domElement
      const width = canvas.width
      const height = canvas.height
      const labels = s.current ? labelsOf(s.current, camera) : { plateBox: null, chars: [] }
      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob ? { image: blob, width, height, ...labels } : null), options?.type ?? 'image/png', 0.92)
        if (size) {
          renderer.setPixelRatio(pixelRatio)
          s.resize()
        }
      })
    },

    renderSample: (sample, size) => {
      const s = stage.current
      // Only on a lane with no live vehicle, so the training pose never fights the animation
      if (!s || s.current) return Promise.resolve(null)
      const { renderer, camera, barrier } = s
      const vehicle = buildVehicle(s, sample.plate, sample.kind, sample.paint, sample.grime)
      const stopZ = READ_Z - REAR_PLATE[sample.kind].z
      vehicle.group.position.set((sample.kind === 'car' ? 0 : 0.4) + sample.offsetX, 0, stopZ + sample.offsetZ)
      vehicle.group.rotation.y = sample.yaw

      // Pose: camera off its mount, brightness, barrier; drawn at a fixed size
      const exposure = renderer.toneMappingExposure
      const pixelRatio = renderer.getPixelRatio()
      renderer.setPixelRatio(1)
      renderer.setSize(size.width, size.height, false)
      renderer.toneMappingExposure = 1.05 * sample.exposure
      camera.aspect = size.width / size.height
      camera.fov = sample.camera.fov
      camera.position.copy(CAMERA_POS).add(new THREE.Vector3(sample.camera.dx, sample.camera.dy, sample.camera.dz))
      camera.lookAt(CAMERA_TARGET)
      camera.updateProjectionMatrix()
      barrier.rotation.z = (Math.PI / 2) * 0.94 * sample.barrierLift

      s.render()
      const canvas = renderer.domElement
      const labels = labelsOf(vehicle, camera)
      return new Promise<LaneFrame | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob ? { image: blob, width: size.width, height: size.height, ...labels } : null), 'image/jpeg', 0.92)
        // toBlob has copied the picture: put the lane back as it was
        vehicle.dispose()
        renderer.toneMappingExposure = exposure
        renderer.setPixelRatio(pixelRatio)
        camera.fov = CAMERA_FOV
        camera.position.copy(CAMERA_POS)
        camera.lookAt(CAMERA_TARGET)
        barrier.rotation.z = 0
        s.resize()
      })
    },
  }))

  return <div ref={hostRef} className={cn('h-full w-full', className)} />
}
