/**
 * Vietnamese number plates drawn on a canvas, used as textures on the 3D vehicles of the gate lanes
 * and to make labelled training images for the plate reader.
 * Cars carry a long one-line plate ("51K-889.24"); motorbikes a short two-line one ("59-X1" over "234.56").
 */

export type PlateShape = 'long' | 'square'

export interface PlateLines {
  top: string
  bottom: string | null
}

/** One character printed on the plate, in canvas pixels. Separators ("-", ".") are not listed. */
export interface PlateGlyph {
  char: string
  x: number
  y: number
  width: number
  height: number
}

export interface DrawnPlate {
  canvas: HTMLCanvasElement
  glyphs: PlateGlyph[]
}

/** Splits a plate such as "59X1-234.56", "51K88924" or "79A-11111" into the lines printed on it. */
export function plateLines(plate: string, shape: PlateShape): PlateLines {
  const clean = plate.toUpperCase().replace(/\s+/g, '')
  const match = /^(\d{2})-?([A-Z]{1,2}\d?)-?([\d.]+)$/.exec(clean)
  if (!match) return { top: clean || '—', bottom: null }
  const [, province, series, number] = match
  const digits = number.replace(/\./g, '')
  // Five-digit numbers are printed "889.24"; four-digit ones as they are
  const printed = digits.length === 5 ? `${digits.slice(0, 3)}.${digits.slice(3)}` : digits
  return shape === 'square' ? { top: `${province}-${series}`, bottom: printed } : { top: `${province}${series}-${printed}`, bottom: null }
}

/** Plate size in metres: 520 × 110 mm for cars, 190 × 140 mm for motorbikes. */
export const PLATE_SIZE: Record<PlateShape, { width: number; height: number }> = {
  long: { width: 0.52, height: 0.11 },
  square: { width: 0.19, height: 0.14 },
}

const isLabelled = (char: string) => /[0-9A-Z]/.test(char)

/** Draws the plate (white background, black border and characters) and returns where each character is. */
export function drawPlate(plate: string, shape: PlateShape): DrawnPlate {
  const { width, height } = PLATE_SIZE[shape]
  const pxPerMetre = shape === 'long' ? 1000 : 1400
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * pxPerMetre)
  canvas.height = Math.round(height * pxPerMetre)
  const glyphs: PlateGlyph[] = []
  const ctx = canvas.getContext('2d')
  if (!ctx) return { canvas, glyphs }

  const w = canvas.width
  const h = canvas.height
  const border = Math.max(4, Math.round(h * 0.05))
  ctx.fillStyle = '#f4f5f2'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#111111'
  ctx.lineWidth = border
  ctx.strokeRect(border / 2, border / 2, w - border, h - border)

  const lines = plateLines(plate, shape)
  const rows = lines.bottom ? [lines.top, lines.bottom] : [lines.top]
  const rowHeight = (h - border * 2) / rows.length
  ctx.fillStyle = '#111111'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  rows.forEach((text, i) => {
    const fontSize = rowHeight * 0.78
    ctx.font = `700 ${fontSize}px "Roboto Condensed", "Arial Narrow", Arial, sans-serif`
    // Squeeze long text into the plate instead of shrinking the characters
    const textWidth = ctx.measureText(text).width
    const squeeze = Math.min(1, (w - border * 4) / textWidth)
    const left = w / 2 - (textWidth * squeeze) / 2
    const y = border + rowHeight * (i + 0.5) + fontSize * 0.04
    ctx.save()
    ctx.translate(left, y)
    ctx.scale(squeeze, 1)
    ctx.fillText(text, 0, 0)
    ctx.restore()

    // Character boxes from the font metrics, squeezed the same way as the text
    for (let k = 0; k < text.length; k++) {
      const char = text[k]
      if (!isLabelled(char)) continue
      const pen = ctx.measureText(text.slice(0, k)).width
      const m = ctx.measureText(char)
      const x0 = left + (pen - m.actualBoundingBoxLeft) * squeeze
      const x1 = left + (pen + m.actualBoundingBoxRight) * squeeze
      const y0 = y - m.actualBoundingBoxAscent
      const y1 = y + m.actualBoundingBoxDescent
      glyphs.push({ char, x: x0, y: y0, width: x1 - x0, height: y1 - y0 })
    }
  })
  return { canvas, glyphs }
}

/* Random plates for training images */

/** Province codes in use (Ho Chi Minh City 50–59, Ha Noi 29–33 and 40, and other provinces). */
const PROVINCES = [11, 12, 14, 15, 17, 18, 19, 20, 21, 22, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 43, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 81, 82, 83, 84, 85, 86, 88, 89, 90, 92, 93, 94, 95, 97, 98, 99]
/** Series letters printed on plates (I, J, O, Q, R and W are not used). */
const LETTERS = 'ABCDEFGHKLMNPSTUVXYZ'

const pick = <T,>(items: readonly T[] | string, random: () => number) => items[Math.floor(random() * items.length)] as T
const digits = (count: number, random: () => number) => Array.from({ length: count }, () => Math.floor(random() * 10)).join('')

/**
 * A plausible Vietnamese plate: cars "51K-889.24" (sometimes two series letters, or four digits),
 * motorbikes "59X1-234.56" (letter and digit, or two letters for small bikes).
 */
export function randomPlate(kind: 'car' | 'motorbike', random: () => number = Math.random): string {
  const province = String(pick(PROVINCES, random)).padStart(2, '0')
  const number = random() < 0.85 ? digits(5, random) : digits(4, random)
  const printed = number.length === 5 ? `${number.slice(0, 3)}.${number.slice(3)}` : number
  if (kind === 'car') {
    const series = pick<string>(LETTERS, random) + (random() < 0.15 ? pick<string>(LETTERS, random) : '')
    return `${province}${series}-${printed}`
  }
  const series = random() < 0.85 ? `${pick<string>(LETTERS, random)}${1 + Math.floor(random() * 9)}` : `${pick<string>(LETTERS, random)}${pick<string>(LETTERS, random)}`
  return `${province}${series}-${printed}`
}
