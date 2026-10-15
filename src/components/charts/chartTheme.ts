/**
 * Chart styling shared by every admin chart.
 *
 * Series colours come from the warm palette (coral, dark stone, tan); they differ in
 * lightness as well as hue so the three stay apart for colour-vision deficiencies.
 * The keys keep their original names so call sites did not change.
 * They are assigned per entity, never by rank, so a filter never repaints a series.
 * Status colours (emerald/amber/rose) are reserved for occupancy states.
 */
export const SERIES_COLORS = {
  blue: '#E85A4F',
  orange: '#6F6A64',
  aqua: '#C8AC86',
} as const

export const CHART_TEXT = {
  primary: '#3B3632',
  secondary: '#57524C',
  muted: '#8E8D8A',
}

/** Hairline, solid, one step off the surface. */
export const GRID_COLOR = '#DDD6C8'

export const axisProps = {
  stroke: GRID_COLOR,
  tick: { fill: CHART_TEXT.muted, fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const
