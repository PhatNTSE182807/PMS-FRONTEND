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
  /** SVG stroke colours (Tailwind emerald/amber/rose 500 and 100). */
  stroke: string
  trackStroke: string
}

/** Status colours are reserved for occupancy and always ship with an icon and a label. */
export const LEVEL_STYLES: Record<OccupancyLevel, LevelStyle> = {
  AVAILABLE: {
    label: 'Thông thoáng',
    icon: CircleCheck,
    tone: 'emerald',
    fill: 'bg-emerald-500',
    track: 'bg-emerald-100',
    stroke: '#10b981',
    trackStroke: '#d1fae5',
  },
  HIGH: {
    label: 'Sắp đầy',
    icon: TriangleAlert,
    tone: 'amber',
    fill: 'bg-amber-500',
    track: 'bg-amber-100',
    stroke: '#f59e0b',
    trackStroke: '#fef3c7',
  },
  CRITICAL: {
    label: 'Quá tải',
    icon: CircleAlert,
    tone: 'rose',
    fill: 'bg-rose-500',
    track: 'bg-rose-100',
    stroke: '#f43f5e',
    trackStroke: '#ffe4e6',
  },
}

export const LOT_STATUS_STYLES: Record<ParkingLotStatus, { label: string; tone: BadgeTone }> = {
  OPEN: { label: 'Đang mở', tone: 'sky' },
  FULL: { label: 'Hết chỗ', tone: 'rose' },
  MAINTENANCE: { label: 'Bảo trì', tone: 'amber' },
  CLOSED: { label: 'Đã đóng', tone: 'neutral' },
}

export type CapacityFilter = 'ALL' | OccupancyLevel

export const CAPACITY_FILTERS: { value: CapacityFilter; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'AVAILABLE', label: 'Còn trống nhiều' },
  { value: 'HIGH', label: 'Sắp đầy' },
  { value: 'CRITICAL', label: 'Đã đầy' },
]
