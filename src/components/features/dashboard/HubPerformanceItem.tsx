import { Building2, MapPin } from 'lucide-react'
import { LEVEL_STYLES } from '@/components/features/capacity/occupancyStyles'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/format'
import { occupancyLevel } from '@/lib/occupancy'
import { cn } from '@/lib/utils'
import type { HubPerformanceDTO } from '@/types/dashboard.dto'

const vnd = (value: number) => formatNumber(Math.round(value))

/** One parking lot: where it is, how full it is, and what it earned today and this month. */
export function HubPerformanceItem({ hub }: { hub: HubPerformanceDTO }) {
  const level = LEVEL_STYLES[occupancyLevel(hub.occupancyRate)]
  const LevelIcon = level.icon
  const percent = Math.min(100, Math.max(0, hub.occupancyRate))

  return (
    <li className="grid gap-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,0.9fr)] lg:items-center lg:gap-6">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-white text-indigo-700 ring-1 ring-slate-200">
          <Building2 className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold text-slate-950">{hub.lotName}</p>
          <p className="mt-0.5 flex items-start gap-1 text-sm text-slate-700">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-slate-500" aria-hidden />
            <span className="line-clamp-2">{hub.location}</span>
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-semibold text-slate-800">Occupancy</span>
          <span className="font-mono font-bold text-slate-950 tabular-nums">{hub.occupancyRate.toFixed(1)}%</span>
        </div>
        <div
          className={cn('mt-2 h-2 overflow-hidden rounded-full', level.track)}
          role="meter"
          aria-label={`${hub.lotName} occupancy`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
        >
          <div className={cn('h-full rounded-full transition-[width] duration-500', level.fill)} style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-xs text-slate-600 tabular-nums">
            {formatNumber(hub.occupiedBays)} / {formatNumber(hub.totalBays)} bays
          </span>
          <Badge tone={level.tone}>
            <LevelIcon aria-hidden />
            {level.label}
          </Badge>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-2 lg:text-right">
        <div>
          <dt className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">Today</dt>
          <dd className="font-mono text-lg font-bold text-amber-500 tabular-nums">
            {vnd(hub.todayRevenue)} <span className="text-xs font-semibold text-slate-600">VND</span>
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">Month to date</dt>
          <dd className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
            {vnd(hub.mtdRevenue)} <span className="text-xs text-slate-600">VND</span>
          </dd>
        </div>
      </dl>
    </li>
  )
}

/** Grey placeholder with the same grid as a real row, shown while the hubs load. */
export function HubPerformanceItemSkeleton() {
  return (
    <li
      aria-hidden
      className="grid gap-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,0.9fr)] lg:items-center lg:gap-6"
    >
      <div className="flex items-start gap-3">
        <Skeleton className="size-11 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3.5 w-full" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="space-y-2 lg:flex lg:flex-col lg:items-end">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </li>
  )
}
