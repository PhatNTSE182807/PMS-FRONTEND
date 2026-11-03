import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { buildBikeModel, buildCarModel, type PartSlot, type VehicleModel } from '@/components/customer/garage/vehicleModels'
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

export interface LaneFrame {
  image: Blob
  width: number
  height: number
  /** Plate position in the frame, 0..1 from the top-left corner; null when no plate is in view. */
  plateBox: { x: number; y: number; width: number; height: number } | null
}

export interface GateLaneSceneHandle {
  captureFrame: () => Promise<LaneFrame | null>
}

interface GateLaneSceneProps {
  direction: LaneDirection
  vehicle: LaneVehicle | null
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
const T_TOTAL = T_ARRIVE + T_READ + T_PASS + 0.6

/** Rear plate of every vehicle stops here, about 3.7 m in front of the camera. */
const READ_Z = -5
const CAMERA_POS = new THREE.Vector3(0.9, 2.2, -8.4)
const CAMERA_TARGET = new THREE.Vector3(0, 0.5, -2.2)
const BARRIER_Z = 0.7

/** Where the rear plate sits on each model (models face +z, rear at -z). */
const REAR_PLATE: Record<LaneVehicleKind, { shape: PlateShape; y: number; z: number; tilt: number }> = {
  car: { shape: 'long', y: 0.57, z: -2.47, tilt: 0 },
  motorbike: { shape: 'square', y: 0.79, z: -0.86, tilt: 0.2 },
}

const PAINTS = [0xd9dde2, 0x1d2329, 0x9a1f24, 0x2f4f7a, 0x6e7378, 0xf1f1ee, 0x2e5e4e, 0xb88a2c]

const easeOut = (t: number) => 1 - (1 - t) ** 3
const easeIn = (t: number) => t ** 3
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

function hash(text: string) {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(h)
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

export function GateLaneScene({ direction, vehicle, onPhase, onDone, className, ref }: GateLaneSceneProps) {
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
    play: () => void
    current: { group: THREE.Group; plate: THREE.Mesh; kind: LaneVehicleKind; startedAt: number; dispose: () => void } | null
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

    const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 60)
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
    const car = buildCarModel()
    const bike = buildBikeModel()
    ;[...car.values(), ...bike.values()].forEach((g) => track(g))
    const materials: Record<PartSlot, THREE.Material> = {
      paint: std({ color: 0xffffff, metalness: 0.45, roughness: 0.32 }),
      glass: std({ color: 0x1b2833, metalness: 0.6, roughness: 0.12 }),
      tyre: std({ color: 0x17191c, roughness: 0.92 }),
      rim: std({ color: 0xc9ccd1, metalness: 0.85, roughness: 0.3 }),
      trim: std({ color: 0x1b1e22, metalness: 0.3, roughness: 0.6 }),
      chrome: std({ color: 0xdfe3e8, metalness: 1, roughness: 0.22 }),
      frame: std({ color: 0x2a2d31, metalness: 0.5, roughness: 0.5 }),
      seat: std({ color: 0x3b2a20, roughness: 0.8 }),
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
      const t = (performance.now() - current.startedAt) / 1000
      const stopZ = READ_Z - REAR_PLATE[current.kind].z
      let z: number
      if (t < T_ARRIVE) {
        z = stopZ - 14 * (1 - easeOut(t / T_ARRIVE))
        setPhase('arriving')
      } else if (t < T_ARRIVE + T_READ) {
        z = stopZ
        setPhase('reading')
      } else {
        z = stopZ + 24 * easeIn(clamp01((t - T_ARRIVE - T_READ) / T_PASS))
        setPhase('passing')
      }
      current.group.position.z = z

      // The barrier lifts near the end of the reading and drops once the vehicle is through
      const openAt = T_ARRIVE + T_READ - T_BARRIER * 0.6
      const closeAt = T_ARRIVE + T_READ + T_PASS - 0.4
      const lift = t < closeAt ? clamp01((t - openAt) / T_BARRIER) : 1 - clamp01((t - closeAt) / T_BARRIER)
      barrier.rotation.z = (Math.PI / 2) * 0.94 * easeOut(lift)

      render()
      if (t >= T_TOTAL) {
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

    stage.current = { renderer, scene, camera, barrier, models: { car, motorbike: bike }, materials, render, play, current: null }

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

  /* A new vehicle: build it with its own paint and plate, then start the pass */
  useEffect(() => {
    const s = stage.current
    if (!s || !vehicle) return
    s.current?.dispose()

    const group = new THREE.Group()
    const paint = (s.materials.paint as THREE.MeshStandardMaterial).clone()
    paint.color.setHex(PAINTS[hash(vehicle.plate) % PAINTS.length])
    for (const [slot, geometry] of s.models[vehicle.kind]) {
      group.add(new THREE.Mesh(geometry, slot === 'paint' ? paint : s.materials[slot]))
    }

    const spot = REAR_PLATE[vehicle.kind]
    const size = PLATE_SIZE[spot.shape]
    const plateTexture = new THREE.CanvasTexture(drawPlate(vehicle.plate, spot.shape))
    plateTexture.colorSpace = THREE.SRGBColorSpace
    plateTexture.anisotropy = s.renderer.capabilities.getMaxAnisotropy()
    const plateGeometry = new THREE.PlaneGeometry(size.width, size.height)
    const plateMaterial = new THREE.MeshStandardMaterial({ map: plateTexture, roughness: 0.45, emissive: 0xffffff, emissiveMap: plateTexture, emissiveIntensity: 0.12 })
    const plate = new THREE.Mesh(plateGeometry, plateMaterial)
    plate.position.set(0, spot.y, spot.z - 0.005)
    plate.rotation.set(spot.tilt, Math.PI, 0)
    group.add(plate)
    if (vehicle.kind === 'car') {
      // Cars carry a plate at the front too
      const front = new THREE.Mesh(plateGeometry, plateMaterial)
      front.position.set(0, 0.36, 2.48)
      group.add(front)
    }
    group.position.set(vehicle.kind === 'car' ? 0 : 0.4, 0, -30)
    s.scene.add(group)

    s.current = {
      group,
      plate,
      kind: vehicle.kind,
      startedAt: performance.now(),
      dispose: () => {
        s.scene.remove(group)
        paint.dispose()
        plateTexture.dispose()
        plateGeometry.dispose()
        plateMaterial.dispose()
      },
    }
    s.play()
  }, [vehicle])

  useImperativeHandle(ref, () => ({
    captureFrame: () => {
      const s = stage.current
      if (!s) return Promise.resolve(null)
      // Draw and read in the same task: the drawing buffer is not kept between frames
      s.render()
      const canvas = s.renderer.domElement
      let plateBox: LaneFrame['plateBox'] = null
      const current = s.current
      if (current) {
        current.group.updateMatrixWorld(true)
        const { width, height } = PLATE_SIZE[REAR_PLATE[current.kind].shape]
        const corners = [
          [-width / 2, -height / 2],
          [width / 2, -height / 2],
          [width / 2, height / 2],
          [-width / 2, height / 2],
        ].map(([x, y]) => new THREE.Vector3(x, y, 0).applyMatrix4(current.plate.matrixWorld).project(s.camera))
        if (corners.every((c) => c.z < 1)) {
          const xs = corners.map((c) => (c.x + 1) / 2)
          const ys = corners.map((c) => (1 - c.y) / 2)
          const x = clamp01(Math.min(...xs))
          const y = clamp01(Math.min(...ys))
          const w = clamp01(Math.max(...xs)) - x
          const h = clamp01(Math.max(...ys)) - y
          if (w > 0 && h > 0) plateBox = { x, y, width: w, height: h }
        }
      }
      return new Promise((resolve) =>
        canvas.toBlob((blob) => resolve(blob ? { image: blob, width: canvas.width, height: canvas.height, plateBox } : null), 'image/png'),
      )
    },
  }))

  return <div ref={hostRef} className={cn('h-full w-full', className)} />
}
