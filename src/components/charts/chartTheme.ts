/**
 * Chart styling shared by every admin chart.
 *
 * Series colours come from the admin palette (sky teal, gold, steel in dark mode; ink, bronze, steel in
 * light mode); they differ in lightness as well as hue so the three stay apart for colour-vision
 * deficiencies. They are CSS variables of admin.css, so the charts follow the light/dark mode.
 * The keys keep their original names so call sites did not change.
 * They are assigned per entity, never by rank, so a filter never repaints a series.
 * Status colours (emerald/amber/rose) are reserved for occupancy states.
 */
export const SERIES_COLORS = {
  blue: 'var(--color-indigo-400)',
  orange: 'var(--color-amber-400)',
  aqua: 'var(--color-sky-400)',
} as const

export const CHART_TEXT = {
  primary: 'var(--color-slate-900)',
  secondary: 'var(--color-slate-700)',
  muted: 'var(--color-slate-500)',
}

/** Hairline, solid, one step off the surface. */
export const GRID_COLOR = 'var(--color-slate-200)'

export const axisProps = {
  stroke: GRID_COLOR,
  tick: { fill: CHART_TEXT.muted, fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const
