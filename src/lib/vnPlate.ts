/**
 * Vietnamese number plates drawn on a canvas, used as textures on the 3D vehicles of the gate lanes.
 * Cars carry a long one-line plate ("51K-889.24"); motorbikes a short two-line one ("59-X1" over "234.56").
 */

export type PlateShape = 'long' | 'square'

export interface PlateLines {
  top: string
  bottom: string | null
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

/** Draws the plate (white background, black border and characters) on a new canvas. */
export function drawPlate(plate: string, shape: PlateShape): HTMLCanvasElement {
  const { width, height } = PLATE_SIZE[shape]
  const pxPerMetre = shape === 'long' ? 1000 : 1400
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * pxPerMetre)
  canvas.height = Math.round(height * pxPerMetre)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

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
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  rows.forEach((text, i) => {
    const fontSize = rowHeight * 0.78
    ctx.font = `700 ${fontSize}px "Roboto Condensed", "Arial Narrow", Arial, sans-serif`
    // Squeeze long text into the plate instead of shrinking the characters
    const maxWidth = w - border * 4
    const textWidth = ctx.measureText(text).width
    const squeeze = Math.min(1, maxWidth / textWidth)
    const y = border + rowHeight * (i + 0.5) + fontSize * 0.04
    ctx.save()
    ctx.translate(w / 2, y)
    ctx.scale(squeeze, 1)
    ctx.fillText(text, 0, 0)
    ctx.restore()
  })
  return canvas
}
