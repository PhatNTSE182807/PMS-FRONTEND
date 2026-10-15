/**
 * Chart styling shared by every admin chart.
 *
 * Series colours are the first slots of the validated categorical palette (dataviz
 * reference palette: blue, orange, aqua — they pass CVD separation for all pairs).
 * They are assigned per entity, never by rank, so a filter never repaints a series.
 * Status colours (emerald/amber/rose) are reserved for occupancy states.
 */
export const SERIES_COLORS = {
  blue: '#2a78d6',
  orange: '#eb6834',
  aqua: '#1baf7a',
} as const

export const CHART_TEXT = {
  primary: '#0f172a',
  secondary: '#475569',
  muted: '#94a3b8',
}

/** Hairline, solid, one step off the surface. */
export const GRID_COLOR = '#e2e8f0'

export const axisProps = {
  stroke: GRID_COLOR,
  tick: { fill: CHART_TEXT.muted, fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const
