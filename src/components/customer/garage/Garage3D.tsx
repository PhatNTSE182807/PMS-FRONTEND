import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Bay, BayStatus, GarageFloor } from './garageModel'

export interface Garage3DProps {
  floors: GarageFloor[]
  /** Level to look into: the levels above it are lifted away. null shows the whole building. */
  focusFloor: number | null
  selectedBayId: string | null
  /** The bay the customer booked in this session. */
  myBayId: string | null
  onSelectBay: (bay: Bay) => void
}

/* ------------------------------------------------------------------ */
/* Dimensions (scene units ≈ metres)                                    */
/* ------------------------------------------------------------------ */

const STOREY = 4.4
const SLAB = { width: 46, depth: 26, thickness: 0.5 }
const BAY = {
  car: { width: 3, depth: 5.6, lane: 3.6 },
  motorbike: { width: 1.9, depth: 2.8, lane: 3.2 },
}
const PARAPET = 1.1

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

const PAINTS = [0xf4f4f2, 0x111418, 0xb3121b, 0x1f8a3b, 0xc9ccd1, 0x1d3f73, 0xf4f4f2, 0x5b5f66]

const levelY = (index: number) => index * STOREY

/** Centre of a bay on its level. Rows back onto the long walls and face the central lane. */
function bayCentre(floor: GarageFloor, bay: Bay) {
  const size = BAY[floor.kind]
  const x = -((floor.cols - 1) * size.width) / 2 + bay.col * size.width
  const z = (bay.row === 0 ? -1 : 1) * (size.lane + size.depth / 2)
  return new THREE.Vector3(x, 0, z)
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

/* ------------------------------------------------------------------ */
/* Scene builder                                                        */
/* ------------------------------------------------------------------ */

interface BayObjects {
  bay: Bay
  floor: GarageFloor
  pad: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  light: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>
  vehicle: THREE.Group
}

/** Shared geometry and materials, so a hundred vehicles cost a handful of GPU buffers. */
function makeKit(track: <T>(item: T) => T) {
  const mat = (params: THREE.MeshStandardMaterialParameters) => track(new THREE.MeshStandardMaterial(params))
  const paints = PAINTS.map((color) => mat({ color, metalness: 0.6, roughness: 0.28 }))
  return {
    paints,
    glass: mat({ color: COLOR.glass, metalness: 0.9, roughness: 0.08 }),
    tyre: mat({ color: 0x15171a, roughness: 0.9 }),
    rim: mat({ color: 0xc9ccd1, metalness: 0.9, roughness: 0.3 }),
    headlight: mat({ color: 0xffffff, emissive: 0xfff4d6, emissiveIntensity: 1.2 }),
    taillight: mat({ color: 0x8b0000, emissive: 0xff2b2b, emissiveIntensity: 0.9 }),
    geo: {
      carBody: track(new THREE.BoxGeometry(2.05, 0.62, 4.5)),
      carHood: track(new THREE.BoxGeometry(1.95, 0.12, 1.2)),
      carCabin: track(new THREE.BoxGeometry(1.8, 0.56, 2.3)),
      carRoof: track(new THREE.BoxGeometry(1.7, 0.08, 1.9)),
      wheel: track(new THREE.CylinderGeometry(0.37, 0.37, 0.28, 18)),
      rim: track(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 12)),
      lamp: track(new THREE.BoxGeometry(0.42, 0.14, 0.06)),
      bikeWheel: track(new THREE.TorusGeometry(0.3, 0.08, 8, 18)),
      bikeBody: track(new THREE.BoxGeometry(0.32, 0.38, 1.05)),
      bikeSeat: track(new THREE.BoxGeometry(0.3, 0.1, 0.6)),
      bikeBar: track(new THREE.BoxGeometry(0.7, 0.05, 0.05)),
    },
  }
}

type Kit = ReturnType<typeof makeKit>

function makeCar(kit: Kit, paint: THREE.Material) {
  const car = new THREE.Group()
  const body = new THREE.Mesh(kit.geo.carBody, paint)
  body.position.y = 0.62
  const hood = new THREE.Mesh(kit.geo.carHood, paint)
  hood.position.set(0, 0.98, 1.45)
  const cabin = new THREE.Mesh(kit.geo.carCabin, kit.glass)
  cabin.position.set(0, 1.2, -0.25)
  const roof = new THREE.Mesh(kit.geo.carRoof, paint)
  roof.position.set(0, 1.5, -0.3)
  car.add(body, hood, cabin, roof)
  for (const [x, z] of [[-0.98, 1.45], [0.98, 1.45], [-0.98, -1.45], [0.98, -1.45]]) {
    const wheel = new THREE.Mesh(kit.geo.wheel, kit.tyre)
    wheel.rotation.z = Math.PI / 2
    wheel.position.set(x, 0.37, z)
    const rim = new THREE.Mesh(kit.geo.rim, kit.rim)
    rim.rotation.z = Math.PI / 2
    rim.position.set(x, 0.37, z)
    car.add(wheel, rim)
  }
  for (const x of [-0.65, 0.65]) {
    const head = new THREE.Mesh(kit.geo.lamp, kit.headlight)
    head.position.set(x, 0.72, 2.26)
    const tail = new THREE.Mesh(kit.geo.lamp, kit.taillight)
    tail.position.set(x, 0.75, -2.26)
    car.add(head, tail)
  }
  car.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true
  })
  return car
}

function makeBike(kit: Kit, paint: THREE.Material) {
  const bike = new THREE.Group()
  for (const z of [-0.55, 0.55]) {
    const wheel = new THREE.Mesh(kit.geo.bikeWheel, kit.tyre)
    wheel.rotation.y = Math.PI / 2
    wheel.position.set(0, 0.38, z)
    bike.add(wheel)
  }
  const body = new THREE.Mesh(kit.geo.bikeBody, paint)
  body.position.y = 0.66
  const seat = new THREE.Mesh(kit.geo.bikeSeat, kit.tyre)
  seat.position.set(0, 0.9, -0.15)
  const bar = new THREE.Mesh(kit.geo.bikeBar, kit.rim)
  bar.position.set(0, 1.05, 0.45)
  bike.add(body, seat, bar)
  bike.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true
  })
  return bike
}

function makeTree(trunkMat: THREE.Material, leafMat: THREE.Material, trunkGeo: THREE.BufferGeometry, leafGeo: THREE.BufferGeometry) {
  const tree = new THREE.Group()
  const trunk = new THREE.Mesh(trunkGeo, trunkMat)
  trunk.position.y = 1
  const crown = new THREE.Mesh(leafGeo, leafMat)
  crown.position.y = 3
  crown.castShadow = true
  tree.add(trunk, crown)
  return tree
}

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Three.js model of a three-level concrete car park: L1 motorbikes, L2 cars and an open-air
 * rooftop L3. Parked vehicles and bay lights follow the live status; clicking a bay reports it.
 */
export default function Garage3D({ floors, focusFloor, selectedBayId, myBayId, onSelectBay }: Garage3DProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<{
    bays: Map<string, BayObjects>
    levels: THREE.Group[]
    labels: THREE.Sprite[]
    focusTarget: THREE.Vector3
    hoverId: string | null
  } | null>(null)

  const latest = useRef({ selectedBayId, myBayId, onSelectBay, focusFloor })
  latest.current = { selectedBayId, myBayId, onSelectBay, focusFloor }

  const layoutKey = floors.map((f) => `${f.level}:${f.kind}:${f.bays.length}:${f.bays[0]?.id}`).join('|')

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined

    const disposables: { dispose: () => void }[] = []
    const track = <T,>(item: T): T => {
      if (item && typeof (item as { dispose?: unknown }).dispose === 'function') disposables.push(item as unknown as { dispose: () => void })
      return item
    }

    /* Renderer, camera, controls */
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    host.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.touchAction = 'none'

    const scene = new THREE.Scene()
    scene.background = track(skyTexture())
    scene.fog = new THREE.Fog(0xdfe6ea, 120, 260)

    const buildingHeight = floors.length * STOREY
    const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 600)
    camera.position.set(40, buildingHeight + 20, 48)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 20
    controls.maxDistance = 160
    controls.maxPolarAngle = Math.PI * 0.47
    controls.target.set(0, buildingHeight / 2, 0)

    /* Lights */
    scene.add(new THREE.HemisphereLight(0xe6eef5, 0x4d5b3e, 1.1))
    const sun = new THREE.DirectionalLight(0xfff3e0, 2.4)
    sun.position.set(-40, 70, 45)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.bias = -0.0004
    Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 200 })
    scene.add(sun)

    /* Materials */
    const asphaltTex = track(noiseTexture([58, 62, 67], 22))
    asphaltTex.repeat.set(10, 6)
    const concreteTex = track(noiseTexture([182, 185, 186], 16, 256, true))
    concreteTex.repeat.set(6, 1)
    const std = (p: THREE.MeshStandardMaterialParameters) => track(new THREE.MeshStandardMaterial(p))
    const concrete = std({ color: COLOR.concrete, map: concreteTex, roughness: 0.95 })
    const concreteDark = std({ color: COLOR.concreteDark, roughness: 0.95 })
    const asphalt = std({ color: 0xffffff, map: asphaltTex, roughness: 1 })
    const paint = track(new THREE.MeshBasicMaterial({ color: COLOR.paint }))
    const steel = std({ color: 0x6b7178, metalness: 0.8, roughness: 0.35 })
    const darkGlass = std({ color: 0x22313b, metalness: 0.7, roughness: 0.15 })

    /* Ground: grass, sidewalk, road, entrance booth and barrier, trees */
    const ground = new THREE.Mesh(track(new THREE.PlaneGeometry(400, 400)), std({ color: COLOR.grass, roughness: 1 }))
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.02
    ground.receiveShadow = true
    scene.add(ground)
    const sidewalk = new THREE.Mesh(track(new THREE.BoxGeometry(SLAB.width + 22, 0.12, SLAB.depth + 18)), std({ color: COLOR.sidewalk, roughness: 0.9 }))
    sidewalk.position.y = 0.04
    sidewalk.receiveShadow = true
    scene.add(sidewalk)
    const road = new THREE.Mesh(track(new THREE.PlaneGeometry(400, 12)), std({ color: COLOR.road, roughness: 1 }))
    road.rotation.x = -Math.PI / 2
    road.position.set(0, 0.11, SLAB.depth / 2 + 16)
    road.receiveShadow = true
    scene.add(road)
    const dashGeo = track(new THREE.PlaneGeometry(3, 0.25))
    const roadPaint = track(new THREE.MeshBasicMaterial({ color: 0xf4f4f2 }))
    for (let x = -120; x <= 120; x += 7) {
      const dash = new THREE.Mesh(dashGeo, roadPaint)
      dash.rotation.x = -Math.PI / 2
      dash.position.set(x, 0.12, SLAB.depth / 2 + 16)
      scene.add(dash)
    }
    const booth = new THREE.Mesh(track(new THREE.BoxGeometry(2.4, 2.6, 2.4)), std({ color: 0xe9e4d8, roughness: 0.8 }))
    booth.position.set(SLAB.width / 2 - 6, 1.35, SLAB.depth / 2 + 6)
    booth.castShadow = true
    scene.add(booth)
    const boothRoof = new THREE.Mesh(track(new THREE.BoxGeometry(3, 0.25, 3)), concreteDark)
    boothRoof.position.set(booth.position.x, 2.75, booth.position.z)
    scene.add(boothRoof)
    const arm = new THREE.Mesh(track(new THREE.BoxGeometry(6, 0.14, 0.14)), std({ color: 0xffffff, emissive: 0xef4444, emissiveIntensity: 0.25 }))
    arm.position.set(booth.position.x - 4.2, 1.1, booth.position.z + 1.6)
    scene.add(arm)

    const trunkGeo = track(new THREE.CylinderGeometry(0.22, 0.3, 2, 8))
    const leafGeo = track(new THREE.SphereGeometry(1.5, 12, 10))
    const trunkMat = std({ color: 0x6b4a2f, roughness: 1 })
    const leafMat = std({ color: 0x3f7a35, roughness: 0.9 })
    const ringX = SLAB.width / 2 + 8
    const ringZ = SLAB.depth / 2 + 6
    for (let x = -ringX; x <= ringX; x += 8) {
      for (const z of [-ringZ - 2]) {
        const tree = makeTree(trunkMat, leafMat, trunkGeo, leafGeo)
        tree.position.set(x, 0, z)
        scene.add(tree)
      }
    }
    for (let z = -ringZ + 4; z <= ringZ; z += 8) {
      for (const x of [-ringX - 2, ringX + 2]) {
        const tree = makeTree(trunkMat, leafMat, trunkGeo, leafGeo)
        tree.position.set(x, 0, z)
        scene.add(tree)
      }
    }

    /* Stair and lift core with the vertical "CAR PARK" sign */
    const coreHeight = buildingHeight + 3
    const core = new THREE.Mesh(track(new THREE.BoxGeometry(6, coreHeight, 7)), concrete)
    core.position.set(-SLAB.width / 2 - 3, coreHeight / 2, -SLAB.depth / 2 + 4)
    core.castShadow = true
    core.receiveShadow = true
    scene.add(core)
    const windowGeo = track(new THREE.BoxGeometry(0.1, 0.9, 1.2))
    for (let level = 0; level < floors.length + 1; level++) {
      for (const z of [-1.8, 0, 1.8]) {
        const pane = new THREE.Mesh(windowGeo, darkGlass)
        pane.position.set(core.position.x - 3.02, 1.6 + level * STOREY, core.position.z + z)
        scene.add(pane)
      }
    }
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
    const lightGeo = track(new THREE.SphereGeometry(0.16, 12, 10))
    const markerGeo = track(new THREE.ConeGeometry(0.55, 1.2, 16))
    const lampPoleGeo = track(new THREE.CylinderGeometry(0.09, 0.12, 4.2, 8))
    const lampHeadGeo = track(new THREE.BoxGeometry(0.5, 0.5, 0.5))
    const lampHeadMat = std({ color: 0x2b2f33, emissive: 0xfff1c1, emissiveIntensity: 0.5 })

    const bays = new Map<string, BayObjects>()
    const levels: THREE.Group[] = []
    const labels: THREE.Sprite[] = []
    const blockers: THREE.Object3D[] = []

    floors.forEach((floor) => {
      const level = new THREE.Group()
      level.position.y = levelY(floor.index)
      level.userData.index = floor.index
      const isRoof = floor.index === floors.length - 1
      const size = BAY[floor.kind]

      // Slab (the ground level sits on a low plinth) and asphalt deck
      const slab = new THREE.Mesh(slabGeo, concrete)
      slab.position.y = -SLAB.thickness / 2 + (floor.index === 0 ? 0.2 : 0)
      slab.receiveShadow = true
      slab.castShadow = true
      level.add(slab)
      blockers.push(slab)
      const deck = new THREE.Mesh(deckGeo, asphalt)
      deck.rotation.x = -Math.PI / 2
      deck.position.y = 0.01 + (floor.index === 0 ? 0.2 : 0)
      deck.receiveShadow = true
      level.add(deck)
      const deckY = deck.position.y

      // Parapet walls with a steel rail, open at the front-right for the ramp
      for (const z of [-SLAB.depth / 2 + 0.15, SLAB.depth / 2 - 0.15]) {
        const wall = new THREE.Mesh(longWallGeo, concrete)
        wall.position.set(0, deckY + PARAPET / 2, z)
        wall.castShadow = true
        wall.receiveShadow = true
        level.add(wall)
        const rail = new THREE.Mesh(railGeo, steel)
        rail.position.set(0, deckY + PARAPET + 0.25, z)
        level.add(rail)
      }
      const endWall = new THREE.Mesh(shortWallGeo, concrete)
      endWall.position.set(-SLAB.width / 2 + 0.15, deckY + PARAPET / 2, 0)
      endWall.castShadow = true
      level.add(endWall)

      // Columns up to the next level
      if (!isRoof) {
        for (let x = -SLAB.width / 2 + 0.6; x <= SLAB.width / 2 - 0.5; x += (SLAB.width - 1.2) / 4) {
          for (const z of [-SLAB.depth / 2 + 0.6, 0, SLAB.depth / 2 - 0.6]) {
            if (z === 0 && Math.abs(x) < SLAB.width / 2 - 1) continue // keep the lane clear
            const column = new THREE.Mesh(columnGeo, concrete)
            column.position.set(x, deckY + (STOREY - SLAB.thickness) / 2, z)
            column.castShadow = true
            level.add(column)
          }
        }
      }

      // Lane centre line
      const laneDashGeo = track(new THREE.PlaneGeometry(1.6, 0.18))
      for (let x = -SLAB.width / 2 + 3; x < SLAB.width / 2 - 2; x += 3.2) {
        const dash = new THREE.Mesh(laneDashGeo, paint)
        dash.rotation.x = -Math.PI / 2
        dash.position.set(x, deckY + 0.02, 0)
        level.add(dash)
      }

      // Rooftop street lamps, like an open-air deck
      if (isRoof) {
        for (let x = -SLAB.width / 2 + 6; x < SLAB.width / 2 - 3; x += 10) {
          const pole = new THREE.Mesh(lampPoleGeo, steel)
          pole.position.set(x, deckY + 2.1, 0)
          pole.castShadow = true
          const head = new THREE.Mesh(lampHeadGeo, lampHeadMat)
          head.position.set(x, deckY + 4.3, 0)
          level.add(pole, head)
        }
      }

      // Bay lines (yellow U shapes), status pads, indicator lights and vehicles
      const sideLineGeo = track(new THREE.PlaneGeometry(0.14, size.depth))
      const backLineGeo = track(new THREE.PlaneGeometry(size.width, 0.14))
      const padGeo = track(new THREE.PlaneGeometry(size.width - 0.35, size.depth - 0.35))
      floor.bays.forEach((bay, i) => {
        const c = bayCentre(floor, bay)
        const sign = bay.row === 0 ? -1 : 1
        for (const dx of bay.col === floor.cols - 1 ? [-size.width / 2, size.width / 2] : [-size.width / 2]) {
          const line = new THREE.Mesh(sideLineGeo, paint)
          line.rotation.x = -Math.PI / 2
          line.position.set(c.x + dx, deckY + 0.02, c.z)
          level.add(line)
        }
        const back = new THREE.Mesh(backLineGeo, paint)
        back.rotation.x = -Math.PI / 2
        back.position.set(c.x, deckY + 0.02, c.z + sign * (size.depth / 2))
        level.add(back)

        const pad = new THREE.Mesh(padGeo, track(new THREE.MeshBasicMaterial({ color: STATUS_COLOR[bay.status], transparent: true, opacity: 0.22, depthWrite: false })))
        pad.rotation.x = -Math.PI / 2
        pad.position.set(c.x, deckY + 0.03, c.z)
        pad.userData.bayId = bay.id
        level.add(pad)

        // Occupancy light on the wall behind the bay (red = taken, green = free)
        const light = new THREE.Mesh(lightGeo, track(new THREE.MeshStandardMaterial({ color: STATUS_COLOR[bay.status], emissive: STATUS_COLOR[bay.status], emissiveIntensity: 1.6 })))
        light.position.set(c.x, deckY + PARAPET - 0.25, sign * (SLAB.depth / 2 - 0.35))
        level.add(light)

        const paintMat = kit.paints[(i * 5 + floor.index * 3) % kit.paints.length]
        const vehicle = floor.kind === 'car' ? makeCar(kit, paintMat) : makeBike(kit, paintMat)
        vehicle.position.set(c.x, deckY + 0.02, c.z)
        vehicle.rotation.y = bay.row === 0 ? 0 : Math.PI // nose towards the lane
        vehicle.visible = bay.status === 'OCCUPIED'
        level.add(vehicle)

        bays.set(bay.id, { bay, floor, pad, light, vehicle })
      })

      // Selection marker, moved onto the selected bay
      const marker = new THREE.Mesh(markerGeo, std({ color: COLOR.selected, emissive: COLOR.selected, emissiveIntensity: 0.8 }))
      marker.rotation.x = Math.PI
      marker.visible = false
      marker.userData.isMarker = true
      level.add(marker)

      // Level label
      const labelMat = track(new THREE.SpriteMaterial({ map: track(labelTexture(`${floor.level} · ${floor.kind === 'car' ? 'Cars' : 'Motorbikes'}`, `${floor.liveFree} free of ${floor.liveTotal}`)), depthTest: false }))
      const label = new THREE.Sprite(labelMat)
      label.scale.set(12, 3, 1)
      label.position.set(-SLAB.width / 2 - 7, deckY + 1.8, SLAB.depth / 2 - 2)
      label.renderOrder = 10
      label.userData.index = floor.index
      level.add(label)
      labels.push(label)

      scene.add(level)
      levels.push(level)
    })

    // Ramps between levels along the right side
    const rampLength = 20
    const rampGeo = track(new THREE.BoxGeometry(5.5, 0.35, Math.hypot(rampLength, STOREY)))
    for (let i = 0; i < floors.length - 1; i++) {
      const ramp = new THREE.Mesh(rampGeo, concreteDark)
      const dir = i % 2 === 0 ? -1 : 1
      // Belongs to the level it leads up to, so it hides with that level.
      ramp.position.set(SLAB.width / 2 + 3.2, -STOREY / 2, 0)
      ramp.rotation.x = dir * Math.atan2(STOREY, rampLength)
      ramp.castShadow = true
      ramp.receiveShadow = true
      levels[i + 1].add(ramp)
    }

    sceneRef.current = { bays, levels, labels, focusTarget: controls.target.clone(), hoverId: null }

    /* Size */
    const resize = () => {
      const { clientWidth, clientHeight } = host
      if (!clientWidth || !clientHeight) return
      renderer.setSize(clientWidth, clientHeight, false)
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'
      camera.aspect = clientWidth / clientHeight
      camera.updateProjectionMatrix()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(host)

    /* Picking: the first thing under the pointer must be a bay pad (slabs block lower levels) */
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const pads = [...bays.values()].map((b) => b.pad)
    const pick = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const visible = (o: THREE.Object3D) => o.parent?.visible !== false
      const hits = raycaster.intersectObjects([...pads, ...blockers].filter(visible), false)
      const first = hits.find((h) => h.object.userData.bayId || blockers.includes(h.object))
      // A slab right under the deck surface of the same level should not hide its own bays.
      const bayHit = hits.find((h) => h.object.userData.bayId)
      if (!bayHit) return null
      if (first && !first.object.userData.bayId && first.distance < bayHit.distance - 0.6) return null
      return bays.get(bayHit.object.userData.bayId as string) ?? null
    }
    let downAt = { x: 0, y: 0 }
    const onMove = (event: PointerEvent) => {
      const hit = pick(event)
      if (sceneRef.current) sceneRef.current.hoverId = hit?.bay.id ?? null
      renderer.domElement.style.cursor = hit ? 'pointer' : 'grab'
    }
    const onDown = (event: PointerEvent) => {
      downAt = { x: event.clientX, y: event.clientY }
    }
    const onUp = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 5) return // a drag, not a click
      const hit = pick(event)
      if (hit) latest.current.onSelectBay(hit.bay)
    }
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)

    /* Render loop */
    const reduced = prefersReducedMotion()
    const clock = new THREE.Clock()
    let frame = 0
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const t = clock.getElapsedTime()
      const state = sceneRef.current
      if (state) {
        controls.target.lerp(state.focusTarget, 0.08)
        const { selectedBayId: sel, myBayId: mine } = latest.current
        for (const level of state.levels) {
          const marker = level.children.find((c) => c.userData.isMarker)
          if (marker) marker.visible = false
        }
        for (const { bay, floor, pad, light } of state.bays.values()) {
          const isMine = bay.id === mine
          const isSelected = bay.id === sel
          const isHover = bay.id === state.hoverId
          const status = isMine ? COLOR.mine : STATUS_COLOR[bay.status]
          pad.material.color.setHex(isSelected ? COLOR.selected : isMine ? COLOR.mine : status)
          pad.material.opacity = isSelected || isMine ? 0.6 + (reduced ? 0 : Math.sin(t * 4) * 0.15) : isHover ? 0.5 : bay.status === 'OCCUPIED' ? 0 : 0.22
          light.material.color.setHex(status)
          light.material.emissive.setHex(status)
          if (isSelected || isMine) {
            const level = state.levels[floor.index]
            const marker = level?.children.find((c) => c.userData.isMarker)
            if (marker) {
              marker.visible = true
              marker.position.set(pad.position.x, pad.position.y + 3.2 + (reduced ? 0 : Math.sin(t * 3) * 0.3), pad.position.z)
              ;((marker as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive.setHex(isMine ? COLOR.mine : COLOR.selected)
            }
          }
        }
      }
      controls.update()
      renderer.render(scene, camera)
    }
    tick()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      controls.dispose()
      new Set(disposables).forEach((d) => d.dispose())
      renderer.dispose()
      renderer.domElement.remove()
      sceneRef.current = null
    }
    // Rebuild only when the building layout changes (another lot); live status is applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey])

  /* Live status: park or remove vehicles and refresh the level labels */
  useEffect(() => {
    const state = sceneRef.current
    if (!state) return
    for (const floor of floors) {
      for (const bay of floor.bays) {
        const objects = state.bays.get(bay.id)
        if (!objects) continue
        objects.bay = bay
        objects.floor = floor
        objects.vehicle.visible = bay.status === 'OCCUPIED' || bay.id === myBayId
      }
    }
    for (const label of state.labels) {
      const floor = floors.find((f) => f.index === label.userData.index)
      if (!floor) continue
      const old = label.material.map
      label.material.map = labelTexture(`${floor.level} · ${floor.kind === 'car' ? 'Cars' : 'Motorbikes'}`, `${floor.liveFree} free of ${floor.liveTotal}`)
      label.material.needsUpdate = true
      old?.dispose()
    }
  }, [floors, myBayId])

  /* Focus a level: lift away the levels above it so you can look inside */
  useEffect(() => {
    const state = sceneRef.current
    if (!state) return
    state.levels.forEach((level) => {
      level.visible = focusFloor === null || (level.userData.index as number) <= focusFloor
    })
    const top = focusFloor === null ? state.levels.length : focusFloor + 1
    state.focusTarget.set(0, focusFloor === null ? (top * STOREY) / 2 : levelY(focusFloor), 0)
  }, [focusFloor, layoutKey])

  return <div ref={hostRef} className="garage3d" role="img" aria-label="3D model of the car park. Drag to rotate, scroll to zoom, click a bay to select it." />
}
