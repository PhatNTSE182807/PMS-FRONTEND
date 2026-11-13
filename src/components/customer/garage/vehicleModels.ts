import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Vehicles for the 3D car park: the shared part bag and a classic roadster motorbike (the cars are in
 * carModels.ts). Each model is baked once into one geometry per material, so a parked vehicle costs a
 * handful of draw calls however many parts it has. Models point their nose at +z and stand on y = 0.
 */

export type PartSlot = 'paint' | 'glass' | 'tyre' | 'rim' | 'trim' | 'chrome' | 'frame' | 'seat' | 'interior' | 'caliper' | 'headlight' | 'taillight'
export type VehicleModel = Map<PartSlot, THREE.BufferGeometry>

export type Vec = [number, number, number]

export class PartBag {
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
