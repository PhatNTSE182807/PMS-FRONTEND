/**
 * Fill level of a lot, a vehicle family or a zone, as customers see it. Mirrors the backend's ZoneFillLevel:
 * AlmostFull from 80 % of the bays taken, Full when no bay is free. The public lot and occupancy endpoints send it
 * as `availability`; `fillLevel` computes the same label from counts when a screen only has those (demo data, 3D
 * floors).
 *
 * Penalty bays are not part of a lot's capacity: they never reach these counts, so nothing here has to leave them out.
 */
export type FillLevel = 'Available' | 'AlmostFull' | 'Full'

/** Share of taken bays from which a lot counts as almost full. */
export const ALMOST_FULL_PERCENT = 80

export function fillLevel(totalBays: number, freeBays: number): FillLevel {
  if (totalBays <= 0) return 'Available'
  if (freeBays <= 0) return 'Full'
  return ((totalBays - freeBays) / totalBays) * 100 >= ALMOST_FULL_PERCENT ? 'AlmostFull' : 'Available'
}

/** The level the API sent, or the one worked out from the counts. */
export const fillLevelOf = (counts: { totalBays: number; freeBays: number; availability?: FillLevel | null }): FillLevel =>
  counts.availability ?? fillLevel(counts.totalBays, counts.freeBays)

/** Short label for a chip or tab; null when there is plenty of space. */
export const FILL_LABEL: Record<FillLevel, string | null> = {
  Available: null,
  AlmostFull: 'Almost full',
  Full: 'Full',
}
