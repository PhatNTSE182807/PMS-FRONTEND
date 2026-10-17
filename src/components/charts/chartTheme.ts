/**
 * Chart styling shared by every admin chart.
 *
 * Series colours come from the dark telemetry palette (sky teal, gold, steel); they differ in
 * lightness as well as hue so the three stay apart for colour-vision deficiencies.
 * The keys keep their original names so call sites did not change.
 * They are assigned per entity, never by rank, so a filter never repaints a series.
 * Status colours (emerald/amber/rose) are reserved for occupancy states.
 */
export const SERIES_COLORS = {
  blue: '#9ACDEA',
  orange: '#E9C349',
  aqua: '#748D92',
} as const

export const CHART_TEXT = {
  primary: '#DAE4ED',
  secondary: '#C0C7CD',
  muted: '#8A9297',
}

/** Hairline, solid, one step off the surface. */
export const GRID_COLOR = '#2D363D'

export const axisProps = {
  stroke: GRID_COLOR,
  tick: { fill: CHART_TEXT.muted, fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const
