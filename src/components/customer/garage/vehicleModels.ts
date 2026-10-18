import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Low-poly vehicles for the 3D car park: a fastback saloon and a classic roadster motorbike.
 * Each model is baked once into one geometry per material, so a parked vehicle costs a handful
 * of draw calls however many parts it has. Models point their nose at +z and stand on y = 0.
 */

export type PartSlot = 'paint' | 'glass' | 'tyre' | 'rim' | 'trim' | 'chrome' | 'frame' | 'seat' | 'headlight' | 'taillight'
export type VehicleModel = Map<PartSlot, THREE.BufferGeometry>

type Vec = [number, number, number]

class PartBag {
  private parts = new Map<PartSlot, THREE.BufferGeometry[]>()

  add(slot: PartSlot, geo: THREE.BufferGeometry, pos: Vec = [0, 0, 0], rot: Vec | THREE.Quaternion = [0, 0, 0], scale: Vec = [1, 1, 1]) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone()
    geo.dispose()
    g.clearGroups()
    const quaternion = rot instanceof THREE.Quaternion ? rot : new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot))
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...pos), quaternion, new THREE.Vector3(...scale)))
    const list = this.parts.get(slot) ?? []
    list.push(g)
    this.parts.set(slot, list)
  }

  /** A round bar from a to b. */
  rod(slot: PartSlot, a: Vec, b: Vec, radius: number, segments = 8) {
    const from = new THREE.Vector3(...a)
    const to = new THREE.Vector3(...b)
    const mid = from.clone().add(to).multiplyScalar(0.5)
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize())
    this.add(slot, new THREE.CylinderGeometry(radius, radius, from.distanceTo(to), segments), [mid.x, mid.y, mid.z], quaternion)
  }

  bake(): VehicleModel {
    const model: VehicleModel = new Map()
    for (const [slot, list] of this.parts) {
      const merged = mergeGeometries(list, false)
      list.forEach((g) => g.dispose())
      if (merged) model.set(slot, merged)
    }
    return model
  }
}

/** A side profile drawn along x (forward) and y, extruded across the car's width. */
function sideExtrude(shape: THREE.Shape, width: number, bevel: number) {
  const depth = Math.max(0.01, width - bevel * 2)
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 8 })
  g.translate(0, 0, -depth / 2)
  g.rotateY(-Math.PI / 2) // profile x (forward) -> +z
  return g
}

/** Fastback saloon, about 4.8 m long and 1.9 m wide. */
export function buildCarModel(): VehicleModel {
  const bag = new PartBag()

  const body = new THREE.Shape()
  body.moveTo(-2.3, 0.32)
  body.lineTo(-1.95, 0.32)
  body.absarc(-1.45, 0.38, 0.5, Math.PI, 0, true) // rear wheel arch
  body.lineTo(0.95, 0.32)
  body.absarc(1.45, 0.38, 0.5, Math.PI, 0, true) // front wheel arch
  body.lineTo(2.3, 0.32)
  body.quadraticCurveTo(2.44, 0.46, 2.36, 0.66) // nose
  body.quadraticCurveTo(2.2, 0.84, 1.6, 0.9) // bonnet
  body.lineTo(1.05, 0.98)
  body.lineTo(-1.55, 0.98) // shoulder line
  body.quadraticCurveTo(-2.15, 0.99, -2.32, 0.88) // boot lip
  body.quadraticCurveTo(-2.44, 0.66, -2.3, 0.32) // tail
  bag.add('paint', sideExtrude(body, 1.9, 0.1))

  const cabin = new THREE.Shape()
  cabin.moveTo(-1.78, 0.96)
  cabin.quadraticCurveTo(-1.1, 1.2, -0.55, 1.36) // long sloping rear glass
  cabin.quadraticCurveTo(0, 1.42, 0.35, 1.36)
  cabin.quadraticCurveTo(0.75, 1.2, 1.08, 0.96) // raked windscreen
  cabin.lineTo(-1.78, 0.96)
  bag.add('glass', sideExtrude(cabin, 1.62, 0.06))

  const roof = new THREE.Shape()
  roof.moveTo(-0.66, 1.41)
  roof.quadraticCurveTo(0, 1.54, 0.44, 1.41)
  roof.lineTo(0.44, 1.36)
  roof.quadraticCurveTo(0, 1.49, -0.66, 1.36)
  roof.lineTo(-0.66, 1.41)
  bag.add('paint', sideExtrude(roof, 1.5, 0.03))

  // Pillars between the side windows
  for (const x of [-0.79, 0.79]) bag.add('paint', new THREE.BoxGeometry(0.06, 0.4, 0.1), [x, 1.2, -0.05], [-0.12, 0, 0])

  // Single-frame grille, lights, mirrors, sills
  bag.add('trim', new THREE.BoxGeometry(0.86, 0.3, 0.1), [0, 0.5, 2.46], [0.15, 0, 0])
  bag.add('chrome', new THREE.BoxGeometry(0.9, 0.04, 0.11), [0, 0.66, 2.44], [0.15, 0, 0])
  for (const x of [-0.66, 0.66]) {
    bag.add('headlight', new THREE.BoxGeometry(0.44, 0.08, 0.2), [x, 0.74, 2.36], [0.45, x > 0 ? 0.2 : -0.2, 0])
    bag.add('paint', new THREE.BoxGeometry(0.2, 0.12, 0.1), [x * 1.48, 1.05, 0.88])
    bag.add('trim', new THREE.BoxGeometry(0.04, 0.12, 1.9), [x * 1.46, 0.36, 0])
  }
  bag.add('taillight', new THREE.BoxGeometry(1.6, 0.07, 0.08), [0, 0.86, -2.42])
  for (const x of [-0.62, 0.62]) bag.add('taillight', new THREE.BoxGeometry(0.36, 0.12, 0.08), [x, 0.82, -2.42])
  bag.add('trim', new THREE.BoxGeometry(1.5, 0.16, 0.12), [0, 0.4, -2.38])

  // Wheels: tyre, alloy and a dark centre
  for (const [x, z] of [[-0.86, 1.45], [0.86, 1.45], [-0.86, -1.45], [0.86, -1.45]] as const) {
    bag.add('tyre', new THREE.CylinderGeometry(0.36, 0.36, 0.26, 26), [x, 0.36, z], [0, 0, Math.PI / 2])
    bag.add('rim', new THREE.CylinderGeometry(0.24, 0.24, 0.27, 20), [x, 0.36, z], [0, 0, Math.PI / 2])
    bag.add('trim', new THREE.CylinderGeometry(0.07, 0.07, 0.28, 10), [x, 0.36, z], [0, 0, Math.PI / 2])
  }
  return bag.bake()
}

/** Classic roadster motorbike: spoked wheels, round headlamp, teardrop tank, about 2 m long. */
export function buildBikeModel(): VehicleModel {
  const bag = new PartBag()
  const wheelY = 0.34

  for (const z of [-0.66, 0.66]) {
    bag.add('tyre', new THREE.TorusGeometry(0.28, 0.06, 10, 30), [0, wheelY, z], [0, Math.PI / 2, 0])
    bag.add('chrome', new THREE.TorusGeometry(0.235, 0.014, 6, 30), [0, wheelY, z], [0, Math.PI / 2, 0])
    bag.add('chrome', new THREE.CylinderGeometry(0.055, 0.055, 0.14, 12), [0, wheelY, z], [0, 0, Math.PI / 2])
    for (let k = 0; k < 8; k++) {
      const angle = (k / 8) * Math.PI * 2
      const side = k % 2 === 0 ? 0.05 : -0.05
      bag.rod('chrome', [side, wheelY, z], [0, wheelY + Math.sin(angle) * 0.23, z + Math.cos(angle) * 0.23], 0.006, 4)
    }
  }

  // Front fork, headlamp, handlebar with grips and round mirrors
  for (const x of [-0.07, 0.07]) bag.rod('chrome', [x, wheelY, 0.66], [x, 0.98, 0.46], 0.026)
  bag.add('frame', new THREE.BoxGeometry(0.22, 0.05, 0.08), [0, 0.98, 0.46])
  bag.add('chrome', new THREE.CylinderGeometry(0.11, 0.1, 0.14, 20), [0, 0.98, 0.6], [Math.PI / 2, 0, 0])
  bag.add('headlight', new THREE.CylinderGeometry(0.088, 0.088, 0.02, 20), [0, 0.98, 0.675], [Math.PI / 2, 0, 0])
  for (const s of [-1, 1]) {
    bag.rod('chrome', [s * 0.07, 1.0, 0.46], [s * 0.12, 1.1, 0.42], 0.016)
    bag.rod('tyre', [s * 0.27, 1.1, 0.42], [s * 0.4, 1.1, 0.42], 0.026)
    bag.rod('chrome', [s * 0.24, 1.1, 0.42], [s * 0.3, 1.38, 0.36], 0.009)
    bag.add('chrome', new THREE.CylinderGeometry(0.065, 0.065, 0.02, 16), [s * 0.3, 1.43, 0.36], [Math.PI / 2, 0, 0])
  }
  bag.rod('chrome', [-0.3, 1.1, 0.42], [0.3, 1.1, 0.42], 0.016)

  // Mudguards: open hoops over the wheels
  bag.add('paint', new THREE.TorusGeometry(0.33, 0.05, 6, 18, Math.PI * 0.55), [0, wheelY, 0.66], [0, Math.PI / 2, Math.PI * 0.35], [1, 1, 1.6])
  bag.add('paint', new THREE.TorusGeometry(0.33, 0.05, 6, 18, Math.PI * 0.6), [0, wheelY, -0.66], [0, Math.PI / 2, Math.PI * 0.05], [1, 1, 1.6])

  // Frame and swingarm
  bag.rod('frame', [0, 0.98, 0.48], [0, 0.9, -0.5], 0.025)
  bag.rod('frame', [0, 0.98, 0.48], [0, 0.4, 0.2], 0.025)
  bag.rod('frame', [0, 0.4, 0.2], [0, 0.42, -0.12], 0.025)
  bag.rod('frame', [0, 0.42, -0.12], [0, 0.9, -0.32], 0.025)
  for (const x of [-0.1, 0.1]) {
    bag.rod('frame', [x, 0.42, -0.1], [x, wheelY, -0.66], 0.022)
    bag.rod('chrome', [x * 1.2, 0.88, -0.44], [x * 1.2, 0.38, -0.6], 0.025)
  }

  // Tank, seat, side cover
  bag.add('paint', new THREE.SphereGeometry(1, 18, 12), [0, 0.98, 0.16], [-0.12, 0, 0], [0.2, 0.14, 0.34])
  bag.add('seat', new THREE.CapsuleGeometry(0.11, 0.42, 4, 12), [0, 0.93, -0.33], [Math.PI / 2, 0, 0], [1.15, 1, 0.55])
  bag.add('paint', new THREE.BoxGeometry(0.22, 0.18, 0.26), [0, 0.72, -0.24])

  // Engine block with a finned cylinder, and the exhaust
  bag.add('frame', new THREE.BoxGeometry(0.26, 0.28, 0.36), [0, 0.5, 0.04])
  bag.add('chrome', new THREE.CylinderGeometry(0.09, 0.09, 0.26, 14), [0, 0.74, 0.14], [-0.3, 0, 0])
  for (let i = 0; i < 4; i++) bag.add('chrome', new THREE.CylinderGeometry(0.13, 0.13, 0.014, 14), [0, 0.66 + i * 0.055, 0.12 + i * 0.016], [-0.3, 0, 0])
  bag.add('chrome', new THREE.CylinderGeometry(0.1, 0.1, 0.06, 16), [0.15, 0.48, 0.06], [0, 0, Math.PI / 2])
  bag.rod('chrome', [0.08, 0.66, 0.22], [0.16, 0.32, 0.1], 0.028)
  bag.rod('chrome', [0.16, 0.32, 0.1], [0.18, 0.42, -0.74], 0.045, 12)

  // Rear light, number plate, side stand
  bag.add('taillight', new THREE.BoxGeometry(0.1, 0.06, 0.05), [0, 0.9, -0.8])
  bag.add('trim', new THREE.BoxGeometry(0.17, 0.11, 0.01), [0, 0.78, -0.84], [-0.2, 0, 0])
  bag.rod('frame', [-0.1, 0.4, -0.05], [-0.24, 0.02, -0.14], 0.014)

  return bag.bake()
}
