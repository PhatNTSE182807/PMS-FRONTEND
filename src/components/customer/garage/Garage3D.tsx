import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Bay, BayStatus, GarageFloor } from './garageModel'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { buildBikeModel, buildCarModel, type PartSlot } from './vehicleModels'

export interface Garage3DProps {
  floors: GarageFloor[]
  /** Level to look into: the levels above it are lifted away. null shows the whole building. */
  focusFloor: number | null
  selectedBayId: string | null
  /** The bay the customer booked in this session. */
  myBayId: string | null
  onSelectBay: (bay: Bay) => void
  className?: string
}

/* ------------------------------------------------------------------ */
/* Dimensions (scene units ≈ metres)                                    */
/* ------------------------------------------------------------------ */

const STOREY = 4.4
const SLAB_THICKNESS = 0.5
/** Bay sizes; `lane` is the full width of the aisle the bays face. */
const BAY = {
  car: { width: 3, depth: 5.6, lane: 7 },
  motorbike: { width: 1.9, depth: 2.8, lane: 4 },
}
const PARAPET = 1.1

/** Depth taken by a level's rows: bays back to back in pairs around each aisle. */
const rowsDepth = (floor: GarageFloor) => {
  const size = BAY[floor.kind]
  return Math.ceil(floor.rows / 2) * (2 * size.depth + size.lane)
}

/** Footprint shared by every level, sized to the largest of them. */
function footprint(floors: GarageFloor[]) {
  return {
    width: Math.max(30, ...floors.map((f) => f.cols * BAY[f.kind].width)) + 10,
    depth: Math.max(18, ...floors.map(rowsDepth)) + 2,
    thickness: SLAB_THICKNESS,
  }
}

const COLOR = {
  concrete: 0xb9bcbd,
  concreteDark: 0x8f9396,
  asphalt: 0x3a3f44,
  paint: 0xe3e83a,
  grass: 0x58804a,
  sidewalk: 0xc9c9c2,
  road: 0x2f3337,
  glass: 0x1d2a33,
  available: 0x22c55e,
  reserved: 0xe9c349,
  occupied: 0xef4444,
  selected: 0x38bdf8,
  mine: 0xffd166,
}

const STATUS_COLOR: Record<BayStatus, number> = {
  AVAILABLE: COLOR.available,
  RESERVED: COLOR.reserved,
  OCCUPIED: COLOR.occupied,
}

const CAR_PAINTS = [0x4aa3e8, 0xf4f4f2, 0x111418, 0xb3121b, 0xc9ccd1, 0x1d3f73, 0x4aa3e8, 0x5b5f66]
const BIKE_PAINTS = [0xe9e6de, 0x111418, 0xb3121b, 0x2b6e5a, 0xe9e6de, 0x1d3f73]

const levelY = (index: number) => index * STOREY

/** Rows pair up back to back: row 2p faces +z into aisle p, row 2p+1 faces -z into the same aisle. */
const facing = (bay: Bay) => (bay.row % 2 === 0 ? 1 : -1)

/** Centre of a bay on its level. */
function bayCentre(floor: GarageFloor, bay: Bay) {
  const size = BAY[floor.kind]
  const x = -((floor.cols - 1) * size.width) / 2 + bay.col * size.width
  const pairStart = -rowsDepth(floor) / 2 + Math.floor(bay.row / 2) * (2 * size.depth + size.lane)
  const z = pairStart + (bay.row % 2 === 0 ? size.depth / 2 : size.depth + size.lane + size.depth / 2)
  return new THREE.Vector3(x, 0, z)
}

/** z of the centre line of each aisle on a level. */
function aisles(floor: GarageFloor) {
  const size = BAY[floor.kind]
  return Array.from({ length: Math.ceil(floor.rows / 2) }, (_, p) => -rowsDepth(floor) / 2 + p * (2 * size.depth + size.lane) + size.depth + size.lane / 2)
}

/* ------------------------------------------------------------------ */
/* Procedural textures                                                  */
/* ------------------------------------------------------------------ */

function noiseTexture(base: [number, number, number], spread: number, size = 256, boards = false) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const img = ctx.createImageData(size, size)
    for (let i = 0; i < size * size; i++) {
      const n = (Math.random() - 0.5) * spread
      const board = boards && Math.floor((i % size) / 16) % 2 === 0 ? 6 : 0
      img.data[i * 4] = base[0] + n + board
      img.data[i * 4 + 1] = base[1] + n + board
      img.data[i * 4 + 2] = base[2] + n + board
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function skyTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 256)
    g.addColorStop(0, '#4f6f91')
    g.addColorStop(0.55, '#a9bccb')
    g.addColorStop(1, '#e4e9ec')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 16, 256)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function textCanvas(draw: (ctx: CanvasRenderingContext2D) => void, width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (ctx) draw(ctx)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function labelTexture(title: string, sub: string) {
  return textCanvas(
    (ctx) => {
      ctx.fillStyle = 'rgba(6, 15, 22, 0.88)'
      ctx.beginPath()
      ctx.roundRect(4, 4, 504, 120, 22)
      ctx.fill()
      ctx.strokeStyle = 'rgba(233, 195, 73, 0.8)'
      ctx.lineWidth = 4
      ctx.stroke()
      ctx.fillStyle = '#e9c349'
      ctx.font = 'bold 50px "Plus Jakarta Sans", sans-serif'
      ctx.fillText(title, 28, 62)
      ctx.fillStyle = '#dae4ed'
      ctx.font = '600 30px Inter, sans-serif'
      ctx.fillText(sub, 28, 104)
    },
    512,
    128,
  )
}

const floorTitle = (floor: GarageFloor) => `${floor.level} · ${floor.kind === 'car' ? 'Cars' : 'Motorbikes'}`
const floorSub = (floor: GarageFloor) =>
  floor.liveTotal ? `${floor.liveFree} free of ${floor.liveTotal}` : `${floor.bays.length} bays`

/* ------------------------------------------------------------------ */
/* Scene builder                                                        */
/* ------------------------------------------------------------------ */

/**
 * Collects many small static pieces (bay lines, columns, posts…) and merges them into one mesh
 * per material, so a level costs a handful of draw calls instead of hundreds.
 */
function staticBatch() {
  const parts = new Map<THREE.Material, THREE.BufferGeometry[]>()
  const matrix = new THREE.Matrix4()
  const quaternion = new THREE.Quaternion()
  const euler = new THREE.Euler()
  const one = new THREE.Vector3(1, 1, 1)
  const position = new THREE.Vector3()
  return {
    add(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0) {
      const g = geo.clone()
      g.applyMatrix4(matrix.compose(position.set(x, y, z), quaternion.setFromEuler(euler.set(rx, ry, 0)), one))
      const list = parts.get(mat) ?? []
      list.push(g)
      parts.set(mat, list)
    },
    flush(parent: THREE.Object3D, track: <T>(item: T) => T, casters: THREE.Material[] = []) {
      for (const [mat, list] of parts) {
        const merged = mergeGeometries(list, false)
        list.forEach((g) => g.dispose())
        if (!merged) continue
        const mesh = new THREE.Mesh(track(merged), mat)
        mesh.castShadow = casters.includes(mat)
        mesh.receiveShadow = true
        parent.add(mesh)
      }
      parts.clear()
    },
  }
}

/** Shared geometry and materials of the vehicles. */
function makeKit(track: <T>(item: T) => T) {
  const mat = (params: THREE.MeshStandardMaterialParameters) => track(new THREE.MeshStandardMaterial(params))
  const car = buildCarModel()
  const bike = buildBikeModel()
  ;[...car.values(), ...bike.values()].forEach((g) => track(g))
  const materials: Record<PartSlot, THREE.Material> = {
    // White paint tinted per vehicle through the instance colour.
    paint: mat({ color: 0xffffff, metalness: 0.4, roughness: 0.34 }),
    glass: mat({ color: COLOR.glass, metalness: 0.6, roughness: 0.12 }),
    tyre: mat({ color: 0x17191c, roughness: 0.92 }),
    rim: mat({ color: 0xc9ccd1, metalness: 0.85, roughness: 0.3 }),
    trim: mat({ color: 0x1b1e22, metalness: 0.3, roughness: 0.6 }),
    chrome: mat({ color: 0xdfe3e8, metalness: 1, roughness: 0.22 }),
    frame: mat({ color: 0x2a2d31, metalness: 0.5, roughness: 0.5 }),
    seat: mat({ color: 0x3b2a20, roughness: 0.8 }),
    headlight: mat({ color: 0xffffff, emissive: 0xfff4d6, emissiveIntensity: 1.2 }),
    taillight: mat({ color: 0x8b0000, emissive: 0xff2b2b, emissiveIntensity: 0.9 }),
  }
  return { models: { car, motorbike: bike }, materials }
}

/** Everything drawn per bay on one level, as instanced meshes indexed like `floor.bays`. */
interface LevelObjects {
  floor: GarageFloor
  group: THREE.Group
  deckY: number
  centres: THREE.Vector3[]
  pads: THREE.InstancedMesh
  lights: THREE.InstancedMesh
  vehicles: THREE.InstancedMesh[]
  paintColors: THREE.Color[]
  marker: THREE.Mesh
}

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Three.js model of a multi-level concrete car park: motorbikes on the ground level, cars above
 * and an open-air rooftop. The footprint follows the levels' bay layout. Parked vehicles and bay
 * lights follow the live status; clicking a bay reports it.
 *
 * Kept light on purpose: static pieces are merged, bays and vehicles are instanced, shadows are
 * baked once per change and a frame is drawn only when something moved.
 */
export default function Garage3D({ floors, focusFloor, selectedBayId, myBayId, onSelectBay, className }: Garage3DProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<{
    levels: LevelObjects[]
    labels: THREE.Sprite[]
    focusTarget: THREE.Vector3
    hoverId: string | null
    /** Re-applies bay colours, parked vehicles and the marker, then draws a frame. */
    refresh: () => void
    invalidate: (shadows?: boolean) => void
  } | null>(null)

  const latest = useRef({ selectedBayId, myBayId, onSelectBay, floors })
  latest.current = { selectedBayId, myBayId, onSelectBay, floors }

  const layoutKey = floors.map((f) => `${f.level}:${f.kind}:${f.rows}x${f.cols}:${f.bays.length}:${f.bays[0]?.id}`).join('|')

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined

    const disposables: { dispose: () => void }[] = []
    const track = <T,>(item: T): T => {
      if (item && typeof (item as { dispose?: unknown }).dispose === 'function') disposables.push(item as unknown as { dispose: () => void })
      return item
    }

    const SLAB = footprint(floors)
    const span = Math.max(SLAB.width, SLAB.depth)

    /* Renderer, camera, controls */
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    // The scene only changes on demand, so the shadow map is redrawn only then.
    renderer.shadowMap.autoUpdate = false
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1
    host.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.touchAction = 'none'

    const scene = new THREE.Scene()
    scene.background = track(skyTexture())
    scene.fog = new THREE.Fog(0xdfe6ea, span * 2.6, span * 5.5)
    // Soft studio reflections so paint, glass and chrome read as such.
    const pmrem = new THREE.PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    scene.environment = track(pmrem.fromScene(room, 0.04).texture)
    scene.environmentIntensity = 0.55
    room.dispose()
    pmrem.dispose()

    const buildingHeight = floors.length * STOREY
    const camera = new THREE.PerspectiveCamera(38, 1, 0.3, span * 12)
    const viewDistance = Math.hypot(SLAB.width, SLAB.depth) * 0.95 + buildingHeight
    camera.position.copy(new THREE.Vector3(0.62, 0.5, 0.72).normalize().multiplyScalar(viewDistance)).add(new THREE.Vector3(0, buildingHeight / 2, 0))
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.1
    controls.minDistance = 8
    controls.maxDistance = viewDistance * 2.4
    controls.maxPolarAngle = Math.PI * 0.47
    controls.target.set(0, buildingHeight / 2, 0)

    /* Lights */
    scene.add(new THREE.HemisphereLight(0xe6eef5, 0x4d5b3e, 0.75))
    const sun = new THREE.DirectionalLight(0xfff3e0, 2.2)
    sun.position.set(-span * 0.8, span * 1.4, span * 0.9)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.bias = -0.0005
    sun.shadow.normalBias = 0.02
    const reach = span / 2 + 10
    Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: span * 4 })
    scene.add(sun)

    /* Materials */
    const asphaltTex = track(noiseTexture([58, 62, 67], 22))
    asphaltTex.repeat.set(SLAB.width / 5, SLAB.depth / 5)
    const concreteTex = track(noiseTexture([182, 185, 186], 16, 256, true))
    concreteTex.repeat.set(6, 1)
    const std = (p: THREE.MeshStandardMaterialParameters) => track(new THREE.MeshStandardMaterial(p))
    const basic = (p: THREE.MeshBasicMaterialParameters) => track(new THREE.MeshBasicMaterial(p))
    const concrete = std({ color: COLOR.concrete, map: concreteTex, roughness: 0.95 })
    const concreteDark = std({ color: COLOR.concreteDark, roughness: 0.95 })
    const asphalt = std({ color: 0xffffff, map: asphaltTex, roughness: 1 })
    const paint = basic({ color: COLOR.paint })
    const steel = std({ color: 0x6b7178, metalness: 0.8, roughness: 0.35 })
    const darkGlass = std({ color: 0x22313b, metalness: 0.7, roughness: 0.15 })

    /* Ground: grass, sidewalk, road, entrance booth and barrier, trees */
    const site = staticBatch()
    const ground = new THREE.Mesh(track(new THREE.PlaneGeometry(span * 10, span * 10)), std({ color: COLOR.grass, roughness: 1 }))
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.02
    ground.receiveShadow = true
    scene.add(ground)
    const sidewalk = new THREE.Mesh(track(new THREE.BoxGeometry(SLAB.width + 22, 0.12, SLAB.depth + 18)), std({ color: COLOR.sidewalk, roughness: 0.9 }))
    sidewalk.position.y = 0.04
    sidewalk.receiveShadow = true
    scene.add(sidewalk)
    const roadZ = SLAB.depth / 2 + 16
    const road = new THREE.Mesh(track(new THREE.PlaneGeometry(span * 10, 12)), std({ color: COLOR.road, roughness: 1 }))
    road.rotation.x = -Math.PI / 2
    road.position.set(0, 0.11, roadZ)
    scene.add(road)
    const dashGeo = track(new THREE.PlaneGeometry(3, 0.25))
    const roadPaint = basic({ color: 0xf4f4f2 })
    for (let x = -span * 2.5; x <= span * 2.5; x += 7) site.add(dashGeo, roadPaint, x, 0.12, roadZ, -Math.PI / 2)
    const boothX = SLAB.width / 2 - 6
    const boothZ = SLAB.depth / 2 + 6
    const boothMat = std({ color: 0xe9e4d8, roughness: 0.8 })
    site.add(track(new THREE.BoxGeometry(2.4, 2.6, 2.4)), boothMat, boothX, 1.35, boothZ)
    site.add(track(new THREE.BoxGeometry(3, 0.25, 3)), concreteDark, boothX, 2.75, boothZ)
    site.add(track(new THREE.BoxGeometry(6, 0.14, 0.14)), std({ color: 0xffffff, emissive: 0xef4444, emissiveIntensity: 0.25 }), boothX - 4.2, 1.1, boothZ + 1.6)

    const trunkGeo = track(new THREE.CylinderGeometry(0.22, 0.3, 2, 8))
    const leafGeo = track(new THREE.SphereGeometry(1.5, 10, 8))
    const trunkMat = std({ color: 0x6b4a2f, roughness: 1 })
    const leafMat = std({ color: 0x3f7a35, roughness: 0.9 })
    const plantTree = (x: number, z: number) => {
      site.add(trunkGeo, trunkMat, x, 1, z)
      site.add(leafGeo, leafMat, x, 3, z)
    }
    const ringX = SLAB.width / 2 + 8
    const ringZ = SLAB.depth / 2 + 6
    for (let x = -ringX; x <= ringX; x += 8) plantTree(x, -ringZ - 2)
    for (let z = -ringZ + 4; z <= ringZ; z += 8) for (const x of [-ringX - 2, ringX + 2]) plantTree(x, z)

    /* Stair and lift core with the vertical "CAR PARK" sign */
    const coreHeight = buildingHeight + 3
    const coreX = -SLAB.width / 2 - 3
    const coreZ = -SLAB.depth / 2 + 4
    site.add(track(new THREE.BoxGeometry(6, coreHeight, 7)), concrete, coreX, coreHeight / 2, coreZ)
    const windowGeo = track(new THREE.BoxGeometry(0.1, 0.9, 1.2))
    for (let level = 0; level < floors.length + 1; level++) {
      for (const z of [-1.8, 0, 1.8]) site.add(windowGeo, darkGlass, coreX - 3.02, 1.6 + level * STOREY, coreZ + z)
    }
    site.flush(scene, track, [boothMat, concrete, leafMat])
    const signTex = track(
      textCanvas(
        (ctx) => {
          ctx.fillStyle = '#0b141b'
          ctx.fillRect(0, 0, 128, 640)
          ctx.fillStyle = '#e9c349'
          ctx.font = 'bold 92px "Plus Jakarta Sans", sans-serif'
          ctx.textAlign = 'center'
          'CARPARK'.split('').forEach((ch, i) => ctx.fillText(ch, 64, 90 + i * 82))
        },
        128,
        640,
      ),
    )
    const sign = new THREE.Mesh(track(new THREE.BoxGeometry(1.2, Math.min(buildingHeight, 11), 0.25)), [concreteDark, concreteDark, concreteDark, concreteDark, std({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.35 }), concreteDark])
    sign.position.set(SLAB.width / 2 + 0.7, buildingHeight / 2 + 1.5, SLAB.depth / 2 - 0.5)
    scene.add(sign)

    /* Levels */
    const kit = makeKit(track)
    const slabGeo = track(new THREE.BoxGeometry(SLAB.width, SLAB.thickness, SLAB.depth))
    const deckGeo = track(new THREE.PlaneGeometry(SLAB.width - 0.6, SLAB.depth - 0.6))
    const columnGeo = track(new THREE.BoxGeometry(0.7, STOREY - SLAB.thickness, 0.7))
    const longWallGeo = track(new THREE.BoxGeometry(SLAB.width, PARAPET, 0.3))
    const shortWallGeo = track(new THREE.BoxGeometry(0.3, PARAPET, SLAB.depth))
    const railGeo = track(new THREE.BoxGeometry(SLAB.width, 0.08, 0.08))
    const lightGeo = track(new THREE.SphereGeometry(0.16, 8, 6))
    const postGeo = track(new THREE.CylinderGeometry(0.045, 0.045, 0.9, 5))
    const markerGeo = track(new THREE.ConeGeometry(0.55, 1.2, 16))
    const lampPoleGeo = track(new THREE.CylinderGeometry(0.09, 0.12, 4.2, 6))
    const lampHeadGeo = track(new THREE.BoxGeometry(0.5, 0.5, 0.5))
    const lampHeadMat = std({ color: 0x2b2f33, emissive: 0xfff1c1, emissiveIntensity: 0.5 })
    const laneDashGeo = track(new THREE.PlaneGeometry(1.6, 0.18))
    const padMat = basic({ color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false })
    const lightMat = basic({ color: 0xffffff })

    const levels: LevelObjects[] = []
    const labels: THREE.Sprite[] = []
    const blockers: THREE.Object3D[] = []
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0)

    floors.forEach((floor) => {
      const group = new THREE.Group()
      group.position.y = levelY(floor.index)
      group.userData.index = floor.index
      const isRoof = floor.index === floors.length - 1
      const size = BAY[floor.kind]
      const lanes = aisles(floor)
      const batch = staticBatch()

      // Slab (the ground level sits on a low plinth) and asphalt deck
      const lift = floor.index === 0 ? 0.2 : 0
      const slab = new THREE.Mesh(slabGeo, concrete)
      slab.position.y = -SLAB.thickness / 2 + lift
      slab.receiveShadow = true
      slab.castShadow = true
      group.add(slab)
      blockers.push(slab)
      const deck = new THREE.Mesh(deckGeo, asphalt)
      deck.rotation.x = -Math.PI / 2
      deck.position.y = 0.01 + lift
      deck.receiveShadow = true
      group.add(deck)
      const deckY = deck.position.y

      // Parapet walls with a steel rail, open on the right for the ramp
      for (const z of [-SLAB.depth / 2 + 0.15, SLAB.depth / 2 - 0.15]) {
        batch.add(longWallGeo, concrete, 0, deckY + PARAPET / 2, z)
        batch.add(railGeo, steel, 0, deckY + PARAPET + 0.25, z)
      }
      batch.add(shortWallGeo, concrete, -SLAB.width / 2 + 0.15, deckY + PARAPET / 2, 0)

      // Columns up to the next level: along the walls and between back-to-back rows, never in an aisle
      if (!isRoof) {
        const spans = Math.max(4, Math.round(SLAB.width / 11))
        const lines = [-SLAB.depth / 2 + 0.6, SLAB.depth / 2 - 0.6]
        for (let p = 1; p < lanes.length; p++) lines.push((lanes[p - 1] + lanes[p]) / 2)
        for (let i = 0; i <= spans; i++) {
          const x = -SLAB.width / 2 + 0.6 + (i * (SLAB.width - 1.2)) / spans
          for (const z of lines) batch.add(columnGeo, concrete, x, deckY + (STOREY - SLAB.thickness) / 2, z)
        }
      }

      // Aisle centre lines, and street lamps on the open-air roof
      for (const laneZ of lanes) {
        for (let x = -SLAB.width / 2 + 3; x < SLAB.width / 2 - 2; x += 3.2) batch.add(laneDashGeo, paint, x, deckY + 0.02, laneZ, -Math.PI / 2)
        if (isRoof) {
          for (let x = -SLAB.width / 2 + 6; x < SLAB.width / 2 - 3; x += 10) {
            batch.add(lampPoleGeo, steel, x, deckY + 2.1, laneZ)
            batch.add(lampHeadGeo, lampHeadMat, x, deckY + 4.3, laneZ)
          }
        }
      }

      // Bay lines (yellow U shapes) and light posts, merged with the rest of the level
      const sideLineGeo = track(new THREE.PlaneGeometry(0.14, size.depth))
      const backLineGeo = track(new THREE.PlaneGeometry(size.width, 0.14))
      const lastInRow = new Map<number, number>()
      floor.bays.forEach((b) => lastInRow.set(b.row, Math.max(lastInRow.get(b.row) ?? 0, b.col)))
      const centres = floor.bays.map((bay) => bayCentre(floor, bay))
      const lightAt: THREE.Vector3[] = []
      floor.bays.forEach((bay, i) => {
        const c = centres[i]
        const backZ = c.z - facing(bay) * (size.depth / 2)
        batch.add(sideLineGeo, paint, c.x - size.width / 2, deckY + 0.02, c.z, -Math.PI / 2)
        if (bay.col === lastInRow.get(bay.row)) batch.add(sideLineGeo, paint, c.x + size.width / 2, deckY + 0.02, c.z, -Math.PI / 2)
        batch.add(backLineGeo, paint, c.x, deckY + 0.02, backZ, -Math.PI / 2)
        const post = new THREE.Vector3(c.x + size.width / 2 - 0.25, deckY, backZ + facing(bay) * 0.2)
        batch.add(postGeo, steel, post.x, deckY + 0.45, post.z)
        lightAt.push(post.setY(deckY + 1.0))
      })
      batch.flush(group, track, [concrete])

      // Status pads (also the click targets), occupancy lights and vehicles: one instanced mesh each
      const count = floor.bays.length
      const pads = new THREE.InstancedMesh(track(new THREE.PlaneGeometry(size.width - 0.35, size.depth - 0.35)), padMat, count)
      const m = new THREE.Matrix4()
      const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
      const one = new THREE.Vector3(1, 1, 1)
      centres.forEach((c, i) => pads.setMatrixAt(i, m.compose(new THREE.Vector3(c.x, deckY + 0.03, c.z), flat, one)))
      pads.userData.level = floor.index
      group.add(pads)
      const lights = new THREE.InstancedMesh(lightGeo, lightMat, count)
      lightAt.forEach((p, i) => lights.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z)))
      group.add(lights)

      const model = kit.models[floor.kind]
      const palette = floor.kind === 'car' ? CAR_PAINTS : BIKE_PAINTS
      const paintColors = floor.bays.map((_, i) => new THREE.Color(palette[(i * 5 + floor.index * 3) % palette.length]))
      const vehicles = [...model].map(([slot, geo]) => {
        const mesh = new THREE.InstancedMesh(geo, kit.materials[slot], count)
        mesh.castShadow = true
        if (slot === 'paint') paintColors.forEach((color, i) => mesh.setColorAt(i, color))
        for (let i = 0; i < count; i++) mesh.setMatrixAt(i, hidden)
        group.add(mesh)
        return mesh
      })

      // Selection marker, moved onto the selected bay
      const marker = new THREE.Mesh(markerGeo, std({ color: COLOR.selected, emissive: COLOR.selected, emissiveIntensity: 0.8 }))
      marker.rotation.x = Math.PI
      marker.visible = false
      group.add(marker)

      // Level label
      const labelMat = track(new THREE.SpriteMaterial({ map: track(labelTexture(floorTitle(floor), floorSub(floor))), depthTest: false }))
      const label = new THREE.Sprite(labelMat)
      label.scale.set(12, 3, 1)
      label.position.set(-SLAB.width / 2 - 7, deckY + 1.8, SLAB.depth / 2 - 2)
      label.renderOrder = 10
      label.userData.index = floor.index
      group.add(label)
      labels.push(label)

      scene.add(group)
      levels.push({ floor, group, deckY, centres, pads, lights, vehicles, paintColors, marker })
    })

    // Ramps between levels along the right side
    const rampLength = Math.min(20, SLAB.depth - 2)
    const rampGeo = track(new THREE.BoxGeometry(5.5, 0.35, Math.hypot(rampLength, STOREY)))
    for (let i = 0; i < floors.length - 1; i++) {
      const ramp = new THREE.Mesh(rampGeo, concreteDark)
      const dir = i % 2 === 0 ? -1 : 1
      // Belongs to the level it leads up to, so it hides with that level.
      ramp.position.set(SLAB.width / 2 + 3.2, -STOREY / 2, 0)
      ramp.rotation.x = dir * Math.atan2(STOREY, rampLength)
      ramp.castShadow = true
      ramp.receiveShadow = true
      levels[i + 1].group.add(ramp)
    }

    /* On-demand rendering */
    let needsRender = true
    const invalidate = (shadows = false) => {
      needsRender = true
      if (shadows) renderer.shadowMap.needsUpdate = true
    }
    controls.addEventListener('change', () => invalidate())

    /* Bay colours, parked vehicles and the marker, from the latest props */
    const m = new THREE.Matrix4()
    const parkedOf = new Map<THREE.InstancedMesh, boolean[]>()
    const color = new THREE.Color()
    const rotate = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    const scale = new THREE.Vector3(1, 1, 1)
    const reduced = prefersReducedMotion()
    const refresh = () => {
      const state = sceneRef.current
      if (!state) return
      const { selectedBayId: sel, myBayId: mine, floors: current } = latest.current
      let shadowsChanged = false
      for (const level of state.levels) {
        const floor = current.find((f) => f.index === level.floor.index) ?? level.floor
        level.floor = floor
        level.marker.visible = false
        const parked = parkedOf.get(level.pads) ?? []
        floor.bays.forEach((bay, i) => {
          const isMine = bay.id === mine
          const isSelected = bay.id === sel
          const status = isMine ? COLOR.mine : STATUS_COLOR[bay.status]
          const padColor = isSelected ? COLOR.selected : bay.id === state.hoverId ? 0xffffff : bay.status === 'OCCUPIED' && !isMine ? COLOR.asphalt : status
          level.pads.setColorAt(i, color.setHex(padColor))
          level.lights.setColorAt(i, color.setHex(status))

          const show = bay.status === 'OCCUPIED' || isMine
          if (parked[i] !== show) {
            parked[i] = show
            shadowsChanged = true
            const c = level.centres[i]
            const matrix = show
              ? m.compose(new THREE.Vector3(c.x, level.deckY + 0.02, c.z), rotate.setFromAxisAngle(up, facing(bay) === 1 ? 0 : Math.PI), scale)
              : hidden
            for (const mesh of level.vehicles) mesh.setMatrixAt(i, matrix)
          }
          if (isSelected || isMine) {
            const c = level.centres[i]
            level.marker.visible = true
            level.marker.position.set(c.x, level.deckY + 3.2, c.z)
            ;(level.marker.material as THREE.MeshStandardMaterial).emissive.setHex(isMine ? COLOR.mine : COLOR.selected)
          }
        })
        parkedOf.set(level.pads, parked)
        if (level.pads.instanceColor) level.pads.instanceColor.needsUpdate = true
        if (level.lights.instanceColor) level.lights.instanceColor.needsUpdate = true
        for (const mesh of level.vehicles) {
          mesh.instanceMatrix.needsUpdate = true
          mesh.computeBoundingSphere()
        }
      }
      invalidate(shadowsChanged)
    }

    sceneRef.current = { levels, labels, focusTarget: controls.target.clone(), hoverId: null, refresh, invalidate }
    refresh()
    renderer.shadowMap.needsUpdate = true

    /* Size */
    const resize = () => {
      const { clientWidth, clientHeight } = host
      if (!clientWidth || !clientHeight) return
      renderer.setSize(clientWidth, clientHeight, false)
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'
      camera.aspect = clientWidth / clientHeight
      camera.updateProjectionMatrix()
      invalidate()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(host)

    /* Picking: the first thing under the pointer must be a bay pad (slabs block lower levels) */
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const padMeshes = levels.map((l) => l.pads)
    const pick = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const visible = (o: THREE.Object3D) => o.parent?.visible !== false
      const hits = raycaster.intersectObjects([...padMeshes, ...blockers].filter(visible), false)
      const isPad = (o: THREE.Object3D) => o instanceof THREE.InstancedMesh
      const first = hits[0]
      // A slab right under the deck surface of the same level should not hide its own bays.
      const padHit = hits.find((h) => isPad(h.object) && h.instanceId !== undefined)
      if (!padHit || padHit.instanceId === undefined) return null
      if (first && !isPad(first.object) && first.distance < padHit.distance - 0.6) return null
      const level = levels.find((l) => l.pads === padHit.object)
      return level?.floor.bays[padHit.instanceId] ?? null
    }
    let downAt = { x: 0, y: 0 }
    let hoverQueued: PointerEvent | null = null
    const onMove = (event: PointerEvent) => {
      if (event.buttons) return // orbiting: no need to pick
      hoverQueued = event
    }
    const onDown = (event: PointerEvent) => {
      downAt = { x: event.clientX, y: event.clientY }
    }
    const onUp = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 5) return // a drag, not a click
      const bay = pick(event)
      if (bay) latest.current.onSelectBay(bay)
    }
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)

    /* Stop drawing while the model is scrolled out of view */
    let onScreen = true
    const visibility = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      if (onScreen) invalidate()
    })
    visibility.observe(host)

    /* Render loop: draws only when the camera moved or the scene changed */
    let frame = 0
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const state = sceneRef.current
      if (!state || !onScreen) return
      if (hoverQueued) {
        const bay = pick(hoverQueued)
        hoverQueued = null
        renderer.domElement.style.cursor = bay ? 'pointer' : 'grab'
        if ((bay?.id ?? null) !== state.hoverId) {
          state.hoverId = bay?.id ?? null
          refresh()
        }
      }
      if (controls.target.distanceToSquared(state.focusTarget) > 1e-4) {
        controls.target.lerp(state.focusTarget, reduced ? 1 : 0.12)
        invalidate()
      }
      controls.update()
      if (needsRender) {
        needsRender = false
        renderer.render(scene, camera)
      }
    }
    tick()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      visibility.disconnect()
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      controls.dispose()
      levels.forEach((l) => [l.pads, l.lights, ...l.vehicles].forEach((mesh) => mesh.dispose()))
      new Set(disposables).forEach((d) => d.dispose())
      renderer.dispose()
      renderer.domElement.remove()
      sceneRef.current = null
    }
    // Rebuild only when the building layout changes (another lot); live status is applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey])

  /* Live status, selection and the customer's booking */
  useEffect(() => {
    sceneRef.current?.refresh()
  }, [floors, selectedBayId, myBayId])

  /* Level labels follow the live numbers */
  useEffect(() => {
    const state = sceneRef.current
    if (!state) return
    for (const label of state.labels) {
      const floor = floors.find((f) => f.index === label.userData.index)
      if (!floor) continue
      const old = label.material.map
      label.material.map = labelTexture(floorTitle(floor), floorSub(floor))
      label.material.needsUpdate = true
      old?.dispose()
    }
    state.invalidate()
  }, [floors])

  /* Focus a level: lift away the levels above it so you can look inside */
  useEffect(() => {
    const state = sceneRef.current
    if (!state) return
    state.levels.forEach((level) => {
      level.group.visible = focusFloor === null || level.floor.index <= focusFloor
    })
    const top = focusFloor === null ? state.levels.length : focusFloor + 1
    state.focusTarget.set(0, focusFloor === null ? (top * STOREY) / 2 : levelY(focusFloor), 0)
    state.invalidate(true)
  }, [focusFloor, layoutKey])

  return (
    <div
      ref={hostRef}
      className={`garage3d ${className ?? ''}`}
      role="img"
      aria-label="3D model of the car park. Drag to rotate, scroll to zoom, click a bay to select it."
    />
  )
}
