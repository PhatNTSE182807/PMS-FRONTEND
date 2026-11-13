import * as THREE from 'three'
import { PartBag, type PartSlot, type Vec, type VehicleModel } from './vehicleModels'

/**
 * The cars of the 3D car park: a 4-seat grand tourer and a 7-seat SUV. The shell is one surface lofted through
 * cross-sections that follow side and plan curves. Its ends close in a rounded dome and its bottom edge rises over
 * the wheels, which gives a round nose and tail and true wheel arches. Lights, grilles and panel lines are drawn on
 * that surface, so they follow its curve. Generic cars: no maker's badge or plate text.
 * Models point their nose at +z and stand on y = 0. Keep them light: every parked car draws all of it.
 */

type Keys = [number, number][]
type Curve = (x: number) => number
type Point = [number, number]
type Range = number | Curve
type Surface = (a: number, b: number) => Vec

/** A smooth curve through the keys that never overshoots them (monotone cubic). */
function curve(keys: Keys): Curve {
  const slopes = keys.slice(1).map(([x, y], i) => (y - keys[i][1]) / (x - keys[i][0]))
  const tangents = keys.map((_, i) => {
    if (i === 0) return slopes[0]
    if (i === keys.length - 1) return slopes[i - 1]
    return slopes[i - 1] * slopes[i] <= 0 ? 0 : (2 * slopes[i - 1] * slopes[i]) / (slopes[i - 1] + slopes[i])
  })
  return (x) => {
    if (x <= keys[0][0]) return keys[0][1]
    const last = keys.length - 1
    if (x >= keys[last][0]) return keys[last][1]
    let i = 0
    while (x > keys[i + 1][0]) i++
    const h = keys[i + 1][0] - keys[i][0]
    const t = (x - keys[i][0]) / h
    const t2 = t * t
    const t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * keys[i][1] + (t3 - 2 * t2 + t) * h * tangents[i] + (-2 * t3 + 3 * t2) * keys[i + 1][1] + (t3 - t2) * h * tangents[i + 1]
  }
}

/** The point at t (0..1) of a smooth line through a section's control points. */
function along(points: Point[], t: number): Point {
  const at = Math.min(0.9999, Math.max(0, t)) * (points.length - 1)
  const i = Math.floor(at)
  const f = at - i
  const p0 = points[Math.max(0, i - 1)]
  const p1 = points[i]
  const p2 = points[i + 1]
  const p3 = points[Math.min(points.length - 1, i + 2)]
  const blend = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (c - a) * f + (2 * a - 5 * b + 4 * c - d) * f * f + (3 * b - a - 3 * c + d) * f * f * f)
  return [blend(p0[0], p1[0], p2[0], p3[0]), blend(p0[1], p1[1], p2[1], p3[1])]
}

const linspace = (from: number, to: number, count: number) => Array.from({ length: count + 1 }, (_, i) => from + ((to - from) * i) / count)
const value = (range: Range, at: number) => (typeof range === 'number' ? range : range(at))

/** A surface through a grid of points. Rows run along the car and columns up its side; `flip` turns its face over. */
function gridGeometry(rows: Vec[][], { mirror = false, offset = 0, centreSeam = false, flip = false } = {}) {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const columns = rows[0].length
  rows.forEach((row) =>
    row.forEach(([x, y, z]) => {
      positions.push(mirror ? -x : x, y, z)
      uvs.push(0, 0)
    }),
  )
  for (let i = 0; i < rows.length - 1; i++) {
    for (let j = 0; j < columns - 1; j++) {
      const a = i * columns + j
      const b = a + columns
      const c = a + 1
      const d = b + 1
      if (mirror !== flip) indices.push(a, b, c, c, b, d)
      else indices.push(a, c, b, c, d, b)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const normal = geometry.getAttribute('normal')
  const position = geometry.getAttribute('position')
  if (centreSeam) {
    // The two halves meet along the centre line: without this the crown shows a crease there
    for (let i = 0; i < rows.length; i++) {
      const v = i * columns + columns - 1
      const n = new THREE.Vector3(0, normal.getY(v), normal.getZ(v)).normalize()
      normal.setXYZ(v, n.x, n.y, n.z)
    }
  }
  if (offset) {
    for (let v = 0; v < position.count; v++) {
      position.setXYZ(v, position.getX(v) + normal.getX(v) * offset, position.getY(v) + normal.getY(v) * offset, position.getZ(v) + normal.getZ(v) * offset)
    }
  }
  return geometry
}

/** Both sides of a surface. */
function addBothSides(bag: PartBag, slot: PartSlot, rows: Vec[][], offset = 0, centreSeam = false) {
  bag.add(slot, gridGeometry(rows, { offset, centreSeam }))
  bag.add(slot, gridGeometry(rows, { mirror: true, offset, centreSeam }))
}

/** A thin line through the given points. */
function addLine(bag: PartBag, slot: PartSlot, points: Vec[], radius: number, closed = false) {
  const path = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed)
  bag.add(slot, new THREE.TubeGeometry(path, Math.max(3, points.length), radius, 3, closed))
}

const mirrored = (points: Vec[]): Vec[] => points.map(([x, y, z]) => [-x, y, z])

function addLineBothSides(bag: PartBag, slot: PartSlot, points: Vec[], radius: number) {
  addLine(bag, slot, points, radius)
  addLine(bag, slot, mirrored(points), radius)
}

/** A part of a surface; its ends across the rows may follow curves. */
function patch(surface: Surface, a0: number, a1: number, b0: Range, b1: Range, rows = 8, columns = 3): Vec[][] {
  return linspace(a0, a1, rows).map((a) => linspace(value(b0, a), value(b1, a), columns).map((b) => surface(a, b)))
}

/** Half a lens: 0 at both ends of a..b and 1 in the middle, for shapes that come to a point. */
const lens = (a: number, from: number, to: number) => Math.sin(Math.PI * Math.min(1, Math.max(0, (a - from) / (to - from))))

interface CarSpec {
  /** Ends of the body along z. */
  tail: number
  nose: number
  /** How far back the rounding of each end reaches; stops short of the wheel arches. */
  noseDepth: number
  tailDepth: number
  /** Roundness of the ends: 2 is a circle, higher is a blunter end with round corners. */
  endPower: number
  axles: [number, number]
  wheelRadius: number
  tyreWidth: number
  trackX: number
  archRadius: number
  /** Half the body's width along its length, in plan. */
  halfWidth: Keys
  /** Height of the crease along the top of the side. */
  shoulder: Keys
  /** Height of the body's centre line. */
  top: Keys
  /** Height of the underside. */
  floor: Keys
  /** Height the cabin rises from. */
  belt: Keys
  /** Height of the cabin's centre line; it reaches the belt at both ends. */
  roof: Keys
  /** Where the cabin starts and ends on the body. */
  cowl: number
  deck: number
  /** Where the roof panel starts and ends. */
  header: number
  rearHeader: number
  /** How far the side glass leans in, as a share of the cabin height. */
  tumblehome: number
  /** The cabin's width at its rear end, as a share of its full width. */
  rearTaper: number
}

/** Named heights around a body section, as its t value. The control points are in `sectionPoints`. */
const SECTION_POINTS = 11
const T = {
  sill: 2 / SECTION_POINTS,
  rocker: 3 / SECTION_POINTS,
  door: 4 / SECTION_POINTS,
  crease: 6 / SECTION_POINTS,
  wing: 8 / SECTION_POINTS,
  crown: 9 / SECTION_POINTS,
}

/** The lofted shell of a car: surface points on the body, on its nose and tail, and on the cabin. */
function shell(spec: CarSpec) {
  const halfWidth = curve(spec.halfWidth)
  const shoulder = curve(spec.shoulder)
  const top = curve(spec.top)
  const floor = curve(spec.floor)
  const belt = curve(spec.belt)
  const roof = curve(spec.roof)
  const noseStart = spec.nose - spec.noseDepth
  const tailStart = spec.tail + spec.tailDepth

  /** The arch lifts the bottom edge of the side, which cuts a true wheel opening. */
  const bottom = (z: number) => {
    let y = floor(z)
    for (const axle of spec.axles) {
      const d = Math.abs(z - axle)
      if (d < spec.archRadius) y = Math.max(y, spec.wheelRadius + Math.sqrt(spec.archRadius ** 2 - d * d))
    }
    return y
  }

  const sectionPoints = (z: number): Point[] => {
    const w = halfWidth(z)
    const s = shoulder(z)
    const b = Math.min(bottom(z), s - 0.04)
    const c = Math.max(top(z), s + 0.02)
    const h = s - b
    return [
      [0, b],
      [0.6 * w, b],
      [0.93 * w, b],
      [0.985 * w, b + 0.16 * h],
      [0.995 * w, b + 0.5 * h],
      [1.0 * w, s - 0.14 * h],
      [0.99 * w, s],
      [0.955 * w, s + 0.16 * (c - s) + 0.015],
      [0.84 * w, s + 0.52 * (c - s)],
      [0.58 * w, s + 0.86 * (c - s)],
      [0.28 * w, s + 0.98 * (c - s)],
      [0, c],
    ]
  }

  /** How far the section has shrunk at z: 1 along the car, down to 0 at the tip of the nose and the tail. */
  const closing = (z: number) => {
    const u = z > noseStart ? (z - noseStart) / spec.noseDepth : z < tailStart ? (tailStart - z) / spec.tailDepth : 0
    return u <= 0 ? 1 : u >= 1 ? 0 : (1 - u ** spec.endPower) ** (1 / spec.endPower)
  }

  const middle = (points: Point[]) => (points[0][1] + points[points.length - 1][1]) / 2

  /** A point on the body: t runs from the middle of the underside (0) up the side to the centre of the bonnet or deck (1). */
  const body: Surface = (z, t) => {
    const points = sectionPoints(z)
    const cy = middle(points)
    const k = closing(z)
    const [x, y] = along(points, t)
    return [x * k, cy + (y - cy) * k, z]
  }

  /** The point of the rounded nose or tail in front of (x, y): an end-on view of the body's surface. */
  const end = (x: number, y: number, isNose: boolean): Vec => {
    const samples = linspace(0, 1, 22)
    const reach = (z: number) => {
      const points = sectionPoints(z)
      const cy = middle(points)
      const angle = Math.atan2(y - cy, Math.abs(x))
      // The section's distance from its centre in that direction, between the two samples either side of it
      let radius = 0
      let lastAngle = -Math.PI / 2
      let lastRadius = cy - points[0][1]
      for (const t of samples) {
        const [px, py] = along(points, t)
        const sampleAngle = Math.atan2(py - cy, px)
        const sampleRadius = Math.hypot(px, py - cy)
        if (angle <= sampleAngle) {
          const span = sampleAngle - lastAngle
          radius = span > 1e-6 ? lastRadius + ((sampleRadius - lastRadius) * (angle - lastAngle)) / span : sampleRadius
          break
        }
        lastAngle = sampleAngle
        lastRadius = sampleRadius
        radius = sampleRadius
      }
      return Math.hypot(x, y - cy) / (radius * closing(z))
    }
    // Bisect along the car: the surface is where the point stops being inside the closing section
    let inside = isNose ? noseStart : tailStart
    let outside = isNose ? spec.nose : spec.tail
    for (let i = 0; i < 12; i++) {
      const z = (inside + outside) / 2
      if (reach(z) < 1) inside = z
      else outside = z
    }
    return [x, y, inside]
  }

  /** A point on the cabin: u runs from the belt (0) up the glass and over to the roof's centre (1). */
  const cabin: Surface = (z, u) => {
    const low = belt(z)
    const height = Math.max(0.001, roof(z) - low)
    // The cabin narrows towards both ends and with the rounded tail, so its pillars run into the body instead of flaring out
    const rear = spec.rearTaper + (1 - spec.rearTaper) * Math.min(1, Math.max(0, (z - spec.deck) / 0.7))
    const front = 0.9 + 0.1 * Math.min(1, Math.max(0, (spec.cowl - z) / 0.5))
    const w = halfWidth(z) * closing(z) * 0.88 * rear * front
    const lean = spec.tumblehome * height
    const [x, y] = along(
      [
        [w, low],
        [w - 0.38 * lean, low + 0.42 * height],
        [w - 0.84 * lean, low + 0.8 * height],
        [(w - lean) * 0.78, low + 0.95 * height],
        [(w - lean) * 0.4, low + 0.995 * height],
        [0, low + height],
      ],
      u,
    )
    return [x, y, z]
  }

  return { body, cabin, nose: (x: number, y: number) => end(x, y, true), tail: (x: number, y: number) => end(x, y, false) }
}

type Shell = ReturnType<typeof shell>

/** Stations along the car: packed over the arches so their curve stays round, and over the rounded ends. */
function stations(spec: CarSpec) {
  const noseStart = spec.nose - spec.noseDepth
  const tailStart = spec.tail + spec.tailDepth
  const list = linspace(tailStart, noseStart, 8)
  const quarter = (i: number) => (i / 7) * (Math.PI / 2)
  for (let i = 0; i <= 7; i++) {
    list.push(noseStart + spec.noseDepth * Math.sin(quarter(i)), tailStart - spec.tailDepth * Math.sin(quarter(i)))
  }
  for (const axle of spec.axles) {
    for (let i = 0; i <= 8; i++) list.push(axle + spec.archRadius * Math.cos((i / 8) * Math.PI))
  }
  return [...new Set(list.map((z) => Math.round(z * 1000) / 1000))].sort((a, b) => a - b)
}

/** A rounded rectangle as the range of y over x, for a patch on the nose or the tail. */
function roundedRange(cx: number, cy: number, width: number, height: number, radius: number) {
  const inset = (x: number) => {
    const over = Math.abs(x - cx) - (width / 2 - radius)
    return over <= 0 ? 0 : radius - Math.sqrt(Math.max(0, radius * radius - over * over))
  }
  return { x0: cx - width / 2, x1: cx + width / 2, y0: (x: number) => cy - height / 2 + inset(x), y1: (x: number) => cy + height / 2 - inset(x) }
}

/** The stations of a rounded rectangle's rows: close together in its corners, where its outline bends. */
function roundedRows(x0: number, x1: number, radius: number) {
  const corner = (i: number) => radius * (1 - Math.cos((i / 3) * (Math.PI / 2)))
  return [...[0, 1, 2].map((i) => x0 + corner(i)), ...linspace(x0 + radius, x1 - radius, 6), ...[2, 1, 0].map((i) => x1 - corner(i))]
}

/** A rounded rectangle lying on the nose or the tail, with an optional bright frame round it. */
function addEndPanel(bag: PartBag, slot: PartSlot, surface: Surface, isNose: boolean, cx: number, cy: number, width: number, height: number, radius: number, frame?: PartSlot) {
  const range = roundedRange(cx, cy, width, height, radius)
  // Enough rows and columns to follow the curve of the end: a coarser panel sinks into the body at its middle
  const rows = roundedRows(range.x0, range.x1, radius).map((x) => linspace(range.y0(x), range.y1(x), 5).map((y) => surface(x, y)))
  bag.add(slot, gridGeometry(rows, { offset: 0.012, flip: isNose }))
  if (frame) {
    const xs = linspace(range.x0, range.x1, 7)
    const lift = isNose ? 0.009 : -0.009
    const lower = xs.map((x) => surface(x, range.y0(x)))
    const upper = [...xs].reverse().map((x) => surface(x, range.y1(x)))
    addLine(bag, frame, [...lower, ...upper].map(([x, y, z]) => [x, y, z + lift]), 0.008, true)
  }
}

function addWheel(bag: PartBag, x: number, z: number, spec: CarSpec, spokes: number, caliper: boolean) {
  const r = spec.wheelRadius
  const half = spec.tyreWidth / 2
  const side = Math.sign(x)
  const y = r
  const axis = [0, 0, Math.PI / 2] as Vec
  // Tyre: a turned profile with rounded shoulders and a bulged wall
  const tyre = [
    [r * 0.74, -half * 0.96],
    [r * 0.86, -half],
    [r * 0.96, -half * 0.86],
    [r, -half * 0.6],
    [r, half * 0.6],
    [r * 0.96, half * 0.86],
    [r * 0.86, half],
    [r * 0.74, half * 0.96],
  ].map(([a, b]) => new THREE.Vector2(a, b))
  bag.add('tyre', new THREE.LatheGeometry(tyre, 20), [x, y, z], axis)
  // Dished wheel: the outer lip stands proud, the centre sits back
  const dish = [
    [r * 0.02, -0.07],
    [r * 0.3, -0.07],
    [r * 0.72, -0.03],
    [r * 0.75, 0.005],
  ].map(([a, b]) => new THREE.Vector2(a, b))
  bag.add('trim', new THREE.LatheGeometry(dish, 18), [x + side * (half - 0.01), y, z], side > 0 ? ([0, 0, -Math.PI / 2] as Vec) : axis)
  bag.add('rim', new THREE.TorusGeometry(r * 0.745, 0.014, 3, 20), [x + side * (half - 0.004), y, z], [0, Math.PI / 2, 0])
  const faceX = x + side * (half - 0.02)
  bag.add('chrome', new THREE.CylinderGeometry(r * 0.48, r * 0.48, 0.012, 16), [x + side * (half - 0.078), y, z], axis)
  if (caliper) bag.add('caliper', new THREE.BoxGeometry(0.05, r * 0.46, r * 0.26), [x + side * (half - 0.058), y + r * 0.27, z - r * 0.3], [0.7, 0, 0])
  bag.add('rim', new THREE.CylinderGeometry(r * 0.12, r * 0.15, 0.03, 10), [faceX, y, z], axis)
  // Twin spokes that lean out from the hub to the lip
  for (let k = 0; k < spokes; k++) {
    const angle = (k / spokes) * Math.PI * 2
    for (const spread of [-0.1, 0.1]) {
      const a = angle + spread
      bag.add('rim', new THREE.BoxGeometry(0.016, r * 0.62, 0.024), [faceX - side * 0.006, y + Math.sin(a) * r * 0.43, z + Math.cos(a) * r * 0.43], [Math.PI / 2 - a, 0, 0])
    }
  }
}

/** The seats, seen through the glass: rounded backs and headrests, with the dash and the steering wheel. */
function addInterior(bag: PartBag, seatZ: number[], seatX: number, baseY: number, height: number, cowl: number) {
  const dashY = baseY + 0.2
  for (const z of seatZ) {
    for (const x of [-seatX, seatX]) {
      bag.add('interior', new THREE.CapsuleGeometry(0.2, height * 0.7, 2, 6), [x, baseY + height / 2, z], [-0.14, 0, 0], [1.1, 1, 0.42])
      bag.add('interior', new THREE.SphereGeometry(1, 6, 4), [x, baseY + height + 0.09, z - 0.04], [0, 0, 0], [0.115, 0.085, 0.055])
    }
  }
  bag.add('trim', new THREE.CapsuleGeometry(0.09, 1.1, 2, 6), [0, dashY, cowl - 0.42], [0, 0, Math.PI / 2])
  bag.add('trim', new THREE.TorusGeometry(0.15, 0.016, 3, 12), [seatX, dashY + 0.12, cowl - 0.62], [0.4, 0, 0])
}

interface ShellDetails {
  doorSeams: number[]
  sideWindows: [number, number][]
  handles: number[]
  cladding: boolean
  spokes: number
  caliper: boolean
}

/** Body, cabin frame and glass, wheels and the panel lines both cars share. */
function buildShell(bag: PartBag, spec: CarSpec, details: ShellDetails): Shell {
  const parts = shell(spec)
  const { body, cabin } = parts
  const { doorSeams, sideWindows, handles, cladding, spokes, caliper } = details
  const line = (surface: Surface, z0: number, z1: number, t: Range, n = 8): Vec[] => linspace(z0, z1, n).map((z) => surface(z, value(t, z)))

  // Body: one surface from the tip of the tail to the tip of the nose
  // Its columns are close together only where the side curves: the underside and the flat of the bonnet need few
  const columns = [0, 1, 2, 2.5, 3, 4, 5, 5.5, 6, 6.5, 7, 8, 9, 10, 11].map((i) => i / SECTION_POINTS)
  addBothSides(bag, 'paint', stations(spec).map((z) => columns.map((t) => body(z, t))), 0, true)

  // What fills the wheel arches from behind, and the floor; it stays under the bonnet and the deck at both ends
  const wheelhouseWidth = 2 * (spec.trackX - spec.tyreWidth / 2 - 0.015)
  const floorY = curve(spec.floor)(0)
  const wheelhouseRear = spec.axles[0] - spec.archRadius - 0.04
  const wheelhouseFront = spec.axles[1] + spec.archRadius + 0.04
  const roofOfBody = Math.min(body(wheelhouseRear, T.wing)[1], body(wheelhouseFront, T.wing)[1]) - 0.03
  const height = Math.min(spec.wheelRadius * 2 + spec.archRadius * 0.2, roofOfBody) - floorY
  bag.add('frame', new THREE.BoxGeometry(wheelhouseWidth, height, wheelhouseFront - wheelhouseRear), [0, floorY + height / 2, (wheelhouseFront + wheelhouseRear) / 2])

  // Sill, and on the SUV the dark protective cladding along the bottom of the body
  const sillFrom = spec.axles[0] + spec.archRadius + 0.02
  const sillTo = spec.axles[1] - spec.archRadius - 0.02
  if (cladding) addBothSides(bag, 'trim', patch(body, spec.tail + spec.tailDepth * 0.5, spec.nose - spec.noseDepth * 0.5, T.sill - 0.01, T.rocker + 0.03, 32, 1), 0.01)
  else addBothSides(bag, 'trim', patch(body, sillFrom, sillTo, T.sill, T.rocker, 2, 1), 0.008)

  // Dark floor of the cabin, seen through the glass
  addBothSides(bag, 'trim', patch(body, spec.deck, spec.cowl, T.crown - 0.04, 1, 4, 2), 0.004)

  // Cabin: roof and the rail that runs on into the pillars, side and rear panels; the openings stay open for the glass
  const { cowl, deck, header, rearHeader } = spec
  const railLow = 0.58
  const railHigh = 0.68
  addBothSides(bag, 'paint', patch(cabin, deck, cowl, railLow, railHigh, 20, 1))
  addBothSides(bag, 'paint', patch(cabin, rearHeader, header, railHigh, 1, 12, 5), 0, true)
  addBothSides(bag, 'glass', patch(cabin, header, cowl, railHigh, 1, 10, 5), 0, true)
  addBothSides(bag, 'glass', patch(cabin, deck, rearHeader, railHigh, 1, 10, 5), 0, true)
  const firstWindow = sideWindows[0][0]
  addBothSides(bag, 'paint', patch(cabin, deck, firstWindow, 0, railLow, 8, 3))
  sideWindows.forEach(([from, to], i) => {
    addBothSides(bag, 'glass', patch(cabin, from, to, 0.02, railLow, 8, 3))
    const next = sideWindows[i + 1]
    if (next) addBothSides(bag, 'trim', patch(cabin, to, next[0], 0, railLow, 1, 2))
  })
  const lastWindow = sideWindows[sideWindows.length - 1][1]
  if (lastWindow < cowl) addBothSides(bag, 'paint', patch(cabin, lastWindow, cowl, 0, railLow, 3, 2))

  // Bright trim round the side glass
  addLineBothSides(bag, 'chrome', line(cabin, firstWindow, lastWindow, 0.03, 10), 0.008)
  addLineBothSides(bag, 'chrome', line(cabin, firstWindow, lastWindow, railLow - 0.005, 14), 0.007)

  // Panel lines: doors, sill, bonnet, boot
  const seam = (points: Vec[]) => addLineBothSides(bag, 'trim', points, 0.004)
  for (const z of doorSeams) seam(linspace(T.rocker, T.crease - 0.02, 6).map((t) => body(z, t)))
  seam(line(body, doorSeams[0], doorSeams[doorSeams.length - 1], T.rocker, 8))
  const bonnetRear = cowl - 0.03
  const bonnetFront = spec.nose - spec.noseDepth * 0.42
  const bonnetT = T.wing - 0.01
  const across = (z: number, from: number) => [...linspace(from, 1, 5).map((t) => body(z, t)), ...mirrored(linspace(from, 0.98, 4).map((t) => body(z, t))).reverse()]
  seam(line(body, bonnetRear, bonnetFront, bonnetT, 8))
  addLine(bag, 'trim', across(bonnetRear, bonnetT), 0.004)
  addLine(bag, 'trim', across(bonnetFront, bonnetT), 0.004)
  const bootFront = deck - 0.05
  const bootRear = spec.tail + spec.tailDepth * 0.5
  if (bootRear < bootFront) {
    seam(line(body, bootRear, bootFront, bonnetT, 6))
    addLine(bag, 'trim', across(bootRear, bonnetT), 0.004)
    addLine(bag, 'trim', across(bootFront, bonnetT), 0.004)
  }

  // A raised line along each side of the bonnet
  addBothSides(bag, 'paint', patch(body, bonnetFront, bonnetRear, T.crown - 0.025, T.crown + 0.025, 8, 2), 0.006)

  // Door handles, set in the crease
  for (const z of handles) {
    const [x, y] = body(z, T.crease - 0.05)
    for (const s of [-1, 1]) bag.add('chrome', new THREE.CapsuleGeometry(0.016, 0.13, 2, 6), [s * (x + 0.008), y, z], [Math.PI / 2, 0, 0])
  }

  // Door mirrors: a body-coloured shell over a dark base, on a short arm
  const mirrorZ = cowl - 0.14
  const [mirrorX, mirrorY] = cabin(mirrorZ, 0.05)
  for (const s of [-1, 1]) {
    bag.rod('trim', [s * (mirrorX - 0.04), mirrorY, mirrorZ], [s * (mirrorX + 0.12), mirrorY + 0.04, mirrorZ], 0.012, 5)
    bag.add('paint', new THREE.SphereGeometry(1, 8, 6), [s * (mirrorX + 0.15), mirrorY + 0.05, mirrorZ + 0.006], [0, 0, 0], [0.078, 0.046, 0.032])
    bag.add('trim', new THREE.SphereGeometry(1, 6, 4), [s * (mirrorX + 0.15), mirrorY + 0.05, mirrorZ - 0.008], [0, 0, 0], [0.07, 0.04, 0.024])
  }

  // Wheels
  for (const z of spec.axles) for (const s of [-1, 1]) addWheel(bag, s * spec.trackX, z, spec, spokes, caliper)

  return parts
}

/** Headlamp that wraps from the wing round the corner of the nose: a pointed lens, a bright running line and two lamps. */
function addHeadlamp(bag: PartBag, body: Surface, from: number, to: number, low: number, high: number) {
  const t0 = (z: number) => (low + high) / 2 - ((high - low) / 2) * Math.sqrt(lens(z, from, to))
  const t1 = (z: number) => (low + high) / 2 + ((high - low) / 2) * Math.sqrt(lens(z, from, to))
  addBothSides(bag, 'trim', patch(body, from, to, t0, t1, 10, 2), 0.006)
  const line = linspace(from + 0.04, to - 0.02, 8).map((z) => body(z, t1(z) - 0.012))
  addLineBothSides(bag, 'headlight', line, 0.009)
  for (const share of [0.42, 0.68]) {
    const z = from + (to - from) * share
    const [x, y] = body(z, (t0(z) + t1(z)) / 2 - 0.004)
    for (const s of [-1, 1]) bag.add('chrome', new THREE.SphereGeometry(1, 8, 6), [s * x, y, z], [0, 0, 0], [0.018, 0.036, 0.055])
  }
}

/** Slim tail lamp wrapping from the side onto the tail. */
function addTailLamp(bag: PartBag, body: Surface, from: number, to: number, low: number, high: number) {
  const t0 = (z: number) => (low + high) / 2 - ((high - low) / 2) * Math.sqrt(lens(z, from - 0.06, to + 0.002))
  const t1 = (z: number) => (low + high) / 2 + ((high - low) / 2) * Math.sqrt(lens(z, from - 0.06, to + 0.002))
  addBothSides(bag, 'taillight', patch(body, from, to, t0, t1, 8, 2), 0.006)
}

/** Vertical grille bars that follow the curve of the nose. */
function addGrilleBars(bag: PartBag, nose: Surface, x0: number, x1: number, count: number, range: ReturnType<typeof roundedRange>) {
  for (const x of linspace(x0, x1, count)) {
    const low = range.y0(x)
    const high = range.y1(x)
    addLine(bag, 'chrome', linspace(low + 0.005, high - 0.005, 3).map((y) => {
      const [px, py, pz] = nose(x, y)
      return [px, py, pz + 0.012] as Vec
    }), 0.006)
  }
}

/** 4-seat grand tourer: wide haunches, long sloping bonnet and flowing roof, about 4.8 m long and 1.95 m wide. */
export function buildCoupeModel(): VehicleModel {
  const bag = new PartBag()
  const spec: CarSpec = {
    tail: -2.4,
    nose: 2.4,
    noseDepth: 0.56,
    tailDepth: 0.52,
    endPower: 2.5,
    axles: [-1.42, 1.4],
    wheelRadius: 0.35,
    tyreWidth: 0.27,
    trackX: 0.81,
    archRadius: 0.405,
    halfWidth: [[-2.4, 0.9], [-1.88, 0.95], [-1.42, 0.985], [-0.6, 0.94], [0.4, 0.93], [1.4, 0.975], [1.84, 0.94], [2.4, 0.86]],
    shoulder: [[-2.4, 0.74], [-1.88, 0.85], [-1.42, 0.89], [-0.5, 0.8], [0.5, 0.77], [1.4, 0.82], [1.84, 0.78], [2.4, 0.66]],
    top: [[-2.4, 0.88], [-2, 0.98], [-1.6, 1.0], [-1, 0.98], [0.85, 0.95], [1.4, 0.89], [1.84, 0.81], [2.4, 0.68]],
    floor: [[-2.4, 0.3], [-1.88, 0.25], [1.84, 0.22], [2.4, 0.24]],
    belt: [[-1.78, 0.98], [-1, 0.97], [1.0, 0.91]],
    roof: [[-1.78, 0.98], [-1.36, 1.09], [-0.82, 1.26], [-0.2, 1.33], [0.2, 1.31], [0.6, 1.14], [1.0, 0.91]],
    cowl: 1.0,
    deck: -1.78,
    header: 0.24,
    rearHeader: -0.74,
    tumblehome: 0.5,
    rearTaper: 0.8,
  }
  const { body, nose, tail } = buildShell(bag, spec, {
    doorSeams: [-0.56, 0.86],
    sideWindows: [[-1.1, -0.5], [-0.46, 0.84]],
    handles: [-0.44],
    cladding: false,
    spokes: 5,
    caliper: true,
  })
  addInterior(bag, [-0.02, -0.68], 0.38, 0.72, 0.3, spec.cowl)

  addHeadlamp(bag, body, spec.nose - 0.62, spec.nose - 0.14, 0.46, 0.585)

  // Wide grille with slim bars and a plain round centre piece, an intake under it and one in each corner
  const grille = roundedRange(0, 0.47, 0.8, 0.24, 0.08)
  addEndPanel(bag, 'trim', nose, true, 0, 0.47, 0.8, 0.24, 0.08, 'chrome')
  addGrilleBars(bag, nose, -0.34, 0.34, 11, grille)
  const [, badgeY, badgeZ] = nose(0, 0.47)
  bag.add('chrome', new THREE.TorusGeometry(0.06, 0.008, 4, 18), [0, badgeY, badgeZ + 0.016])
  addEndPanel(bag, 'trim', nose, true, 0, 0.3, 0.66, 0.06, 0.03)
  for (const s of [-1, 1]) addEndPanel(bag, 'trim', nose, true, s * 0.57, 0.36, 0.22, 0.13, 0.05)

  addTailLamp(bag, body, spec.tail + 0.06, spec.tail + 0.56, 0.5, 0.6)

  // Tail: plate recess, diffuser and round tail pipes
  addEndPanel(bag, 'trim', tail, false, 0, 0.6, 0.42, 0.1, 0.02)
  addEndPanel(bag, 'trim', tail, false, 0, 0.42, 0.98, 0.13, 0.05)
  for (const s of [-1, 1]) {
    const [x, y, z] = tail(s * 0.34, 0.42)
    bag.add('chrome', new THREE.CylinderGeometry(0.048, 0.044, 0.1, 12, 1, true), [x, y, z - 0.012], [Math.PI / 2, 0, 0])
  }
  const [, centreY, centreZ] = tail(0, 0.74)
  bag.add('chrome', new THREE.TorusGeometry(0.045, 0.007, 4, 16), [0, centreY, centreZ - 0.03])

  return bag.bake()
}

/** 7-seat SUV: tall rounded nose with a bright upright grille, long roof with rails, about 4.85 m long and 1.98 m wide. */
export function buildSuvModel(): VehicleModel {
  const bag = new PartBag()
  const spec: CarSpec = {
    tail: -2.42,
    nose: 2.42,
    noseDepth: 0.48,
    tailDepth: 0.46,
    endPower: 3.2,
    axles: [-1.42, 1.42],
    wheelRadius: 0.39,
    tyreWidth: 0.28,
    trackX: 0.83,
    archRadius: 0.455,
    halfWidth: [[-2.42, 0.93], [-1.96, 0.96], [-1.42, 0.99], [0, 0.965], [1.42, 0.99], [1.94, 0.96], [2.42, 0.91]],
    shoulder: [[-2.42, 1.04], [-1.96, 1.08], [-1, 1.11], [0.5, 1.09], [1.6, 1.09], [1.94, 1.06], [2.42, 0.98]],
    top: [[-2.42, 1.18], [-1.96, 1.23], [-1, 1.25], [1, 1.25], [1.6, 1.23], [1.94, 1.18], [2.42, 1.08]],
    floor: [[-2.42, 0.42], [-1.96, 0.36], [1.94, 0.34], [2.42, 0.36]],
    // The cabin runs right back over the rounded tail, so the rear glass stands on the bumper as on a hatch
    belt: [[-2.3, 1.1], [-2, 1.23], [-1, 1.25], [1.22, 1.23]],
    roof: [[-2.3, 1.12], [-2.24, 1.42], [-2.04, 1.74], [-1.7, 1.81], [-0.6, 1.83], [0.4, 1.82], [0.82, 1.63], [1.22, 1.23]],
    cowl: 1.22,
    deck: -2.3,
    header: 0.48,
    rearHeader: -2.0,
    tumblehome: 0.24,
    rearTaper: 0.97,
  }
  const { body, cabin, nose, tail } = buildShell(bag, spec, {
    doorSeams: [-0.9, 0, 1.1],
    sideWindows: [[-2.02, -0.98], [-0.92, -0.03], [0.03, 1.14]],
    handles: [-0.78, 0.18],
    cladding: true,
    spokes: 6,
    caliper: false,
  })
  addInterior(bag, [0.25, -0.55, -1.3], 0.4, 0.97, 0.42, spec.cowl)

  // Roof rails, on feet at both ends
  const rail = linspace(-1.75, 0.35, 7).map((z) => {
    const [x, y] = cabin(z, 0.74)
    return [x, y + 0.05, z] as Vec
  })
  addLineBothSides(bag, 'chrome', rail, 0.015)
  for (const i of [0, rail.length - 1]) {
    const [x, y, z] = rail[i]
    for (const s of [-1, 1]) bag.rod('chrome', [s * x, y, z], [s * x, y - 0.06, z], 0.018, 5)
  }

  addHeadlamp(bag, body, spec.nose - 0.66, spec.nose - 0.06, 0.46, 0.61)

  // Tall bright grille with a frame and upright bars, wide intake and bright skid plate
  const grille = roundedRange(0, 0.74, 0.82, 0.46, 0.09)
  addEndPanel(bag, 'trim', nose, true, 0, 0.74, 0.82, 0.46, 0.09, 'chrome')
  addGrilleBars(bag, nose, -0.36, 0.36, 13, grille)
  const [, badgeY, badgeZ] = nose(0, 0.74)
  bag.add('chrome', new THREE.TorusGeometry(0.055, 0.008, 4, 18), [0, badgeY, badgeZ + 0.018])
  addEndPanel(bag, 'trim', nose, true, 0, 0.44, 1.2, 0.09, 0.04)
  addEndPanel(bag, 'chrome', nose, true, 0, 0.39, 0.7, 0.025, 0.01)

  addTailLamp(bag, body, spec.tail + 0.04, spec.tail + 0.5, 0.5, 0.58)

  // Tail: a light bar right across, plate recess, dark lower panel and square tail pipes
  addEndPanel(bag, 'taillight', tail, false, 0, 1.0, 1.3, 0.035, 0.015)
  addEndPanel(bag, 'trim', tail, false, 0, 0.78, 0.5, 0.13, 0.02)
  addEndPanel(bag, 'trim', tail, false, 0, 0.52, 1.3, 0.2, 0.06)
  for (const s of [-1, 1]) addEndPanel(bag, 'chrome', tail, false, s * 0.42, 0.51, 0.22, 0.07, 0.02)

  return bag.bake()
}
