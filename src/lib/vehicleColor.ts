/*
 * The colour a vehicle's registered colour name stands for. Customers type it freely, in English or
 * Vietnamese ("Gentian Blue Metallic", "Xanh dương"), so it is read by its keywords.
 */

/** Checked in order, so a compound name ("dark blue") must come before its plain one ("blue"). */
const PAINTS: [keywords: string[], paint: number][] = [
  [['dark blue', 'navy', 'xanh dam', 'xanh duong dam', 'xanh than', 'xanh navy'], 0x1d3f73],
  [['light blue', 'sky blue', 'cyan', 'turquoise', 'xanh nhat', 'xanh da troi', 'xanh ngoc'], 0x7cc4ef],
  [['dark green', 'forest green', 'olive', 'xanh reu', 'xanh la dam'], 0x2b5a45],
  [['green', 'xanh la', 'xanh luc'], 0x2f8f4e],
  [['blue', 'xanh duong', 'xanh'], 0x2a6fd0],
  [['maroon', 'burgundy', 'do do', 'do man'], 0x6e1423],
  [['red', 'do'], 0xb3121b],
  [['white', 'trang'], 0xf4f4f2],
  [['black', 'den'], 0x111418],
  [['silver', 'bac'], 0xc9ccd1],
  [['grey', 'gray', 'xam', 'ghi'], 0x5b5f66],
  [['gold', 'vang dong', 'vang kim'], 0xc9a24a],
  [['yellow', 'vang'], 0xe8c020],
  [['orange', 'cam'], 0xe8741a],
  [['pink', 'hong'], 0xe88fb4],
  [['purple', 'violet', 'tim'], 0x6a3fa0],
  [['brown', 'nau'], 0x5c3a21],
  [['beige', 'cream', 'kem'], 0xd9c7a3],
]

/** Offered while typing the colour of a vehicle; each of these is recognised. */
export const VEHICLE_COLOR_NAMES = ['White', 'Black', 'Silver', 'Grey', 'Red', 'Blue', 'Dark Blue', 'Green', 'Yellow', 'Orange', 'Brown', 'Beige', 'Pink', 'Purple']

const normalize = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** The paint of a registered colour name (0xrrggbb), or null when the name says no known colour. */
export function vehiclePaint(name: string | null | undefined): number | null {
  if (!name) return null
  const text = ` ${normalize(name)} `
  return PAINTS.find(([keywords]) => keywords.some((k) => text.includes(` ${k} `)))?.[1] ?? null
}

/**
 * The paint the 3D scenes use for a colour name: the colour it names, or, for a name with no known colour
 * ("Unicorn"), one picked from the name itself, so every scene paints the same vehicle the same way.
 * Null only without a name.
 */
export function scenePaint(name: string | null | undefined): number | null {
  if (!name?.trim()) return null
  const known = vehiclePaint(name)
  if (known !== null) return known
  let hash = 0
  for (const ch of normalize(name)) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return PAINTS[Math.abs(hash) % PAINTS.length][1]
}

/** The same paint as a CSS colour, for swatches. */
export function vehiclePaintCss(name: string | null | undefined): string | null {
  const paint = vehiclePaint(name)
  return paint === null ? null : `#${paint.toString(16).padStart(6, '0')}`
}
