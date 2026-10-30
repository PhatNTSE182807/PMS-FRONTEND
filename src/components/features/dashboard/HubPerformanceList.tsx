import { Building2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { formatNumber } from '@/lib/format'
import type { HubPerformanceDTO } from '@/types/dashboard.dto'
import { HubPerformanceItem, HubPerformanceItemSkeleton } from './HubPerformanceItem'

const SKELETON_ROWS = 4

interface HubPerformanceListProps {
  hubs?: HubPerformanceDTO[]
  isLoading?: boolean
  /** Message of the failed request; replaces the list with a retry prompt. */
  error?: string | null
  onRetry?: () => void
}

/** All hubs of the network, with a loading skeleton, an error prompt and an empty state. */
export function HubPerformanceList({ hubs = [], isLoading = false, error = null, onRetry }: HubPerformanceListProps) {
  const todayTotal = hubs.reduce((sum, hub) => sum + hub.todayRevenue, 0)

  return (
    <Card aria-busy={isLoading} className="p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-6 py-5">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-950">Hub performance</h2>
          <p className="mt-1 text-sm text-slate-700">Live occupancy with today's and month-to-date revenue for every hub.</p>
        </div>
        {!isLoading && !error && (
          <span className="rounded-md bg-indigo-100 px-3 py-1 text-xs font-bold tracking-wider text-indigo-700 uppercase">
            {hubs.length} {hubs.length === 1 ? 'hub' : 'hubs'}
          </span>
        )}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : isLoading ? (
        <ul className="space-y-3 p-4 sm:p-6">
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <HubPerformanceItemSkeleton key={i} />
          ))}
        </ul>
      ) : hubs.length === 0 ? (
        <EmptyState icon={Building2} title="No hubs yet" description="Hubs appear here once a parking lot has been created." />
      ) : (
        <>
          <ul className="space-y-3 p-4 sm:p-6">
            {hubs.map((hub) => (
              <HubPerformanceItem key={hub.lotId} hub={hub} />
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
            <span className="text-sm text-slate-700">Network total today</span>
            <span className="font-mono text-lg font-bold text-slate-950 tabular-nums">
              {formatNumber(Math.round(todayTotal))} <span className="text-xs font-semibold text-slate-600">VND</span>
            </span>
          </div>
        </>
      )}
    </Card>
  )
}
