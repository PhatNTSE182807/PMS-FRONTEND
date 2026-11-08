import { CircleAlert, CircleCheck, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { BadgeTone } from '@/components/ui/badge'
import type { OccupancyLevel } from '@/lib/occupancy'
import type { ParkingLotStatus } from '@/types/parking.dto'

interface LevelStyle {
  label: string
  icon: LucideIcon
  tone: BadgeTone
  /** Filled part of meters and gauges. */
  fill: string
  /** Unfilled track: a lighter step of the same hue. */
  track: string
  /** SVG stroke colours (the palette's emerald/amber/rose and their tracks, so they follow the light/dark mode). */
  stroke: string
  trackStroke: string
}

/** Status colours are reserved for occupancy and always ship with an icon and a label. */
export const LEVEL_STYLES: Record<OccupancyLevel, LevelStyle> = {
  AVAILABLE: {
    label: 'Plenty of space',
    icon: CircleCheck,
    tone: 'emerald',
    fill: 'bg-emerald-500',
    track: 'bg-emerald-100',
    stroke: 'var(--color-emerald-600)',
    trackStroke: 'var(--color-emerald-100)',
  },
  HIGH: {
    label: 'Filling up',
    icon: TriangleAlert,
    tone: 'amber',
    fill: 'bg-amber-500',
    track: 'bg-amber-100',
    stroke: 'var(--color-amber-400)',
    trackStroke: 'var(--color-amber-100)',
  },
  CRITICAL: {
    label: 'Overloaded',
    icon: CircleAlert,
    tone: 'rose',
    fill: 'bg-rose-500',
    track: 'bg-rose-100',
    stroke: 'var(--color-rose-500)',
    trackStroke: 'var(--color-rose-100)',
  },
}

export const LOT_STATUS_STYLES: Record<ParkingLotStatus, { label: string; tone: BadgeTone }> = {
  OPEN: { label: 'Open', tone: 'sky' },
  FULL: { label: 'Full', tone: 'rose' },
  MAINTENANCE: { label: 'Maintenance', tone: 'amber' },
  CLOSED: { label: 'Closed', tone: 'neutral' },
}

export type CapacityFilter = 'ALL' | OccupancyLevel

export const CAPACITY_FILTERS: { value: CapacityFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'AVAILABLE', label: 'Plenty free' },
  { value: 'HIGH', label: 'Filling up' },
  { value: 'CRITICAL', label: 'Full' },
]
