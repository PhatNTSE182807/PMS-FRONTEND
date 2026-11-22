import { useState } from 'react'
import { Building2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { EmptyState, ErrorState } from '@/components/ui/states'
import type { HubPerformanceDTO } from '@/types/dashboard.dto'
import { HubModelDialog } from './HubModelDialog'
import { HubPerformanceItem, HubPerformanceItemSkeleton } from './HubPerformanceItem'
import { t, tMaybe } from '@/i18n'

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
  const [openHub, setOpenHub] = useState<HubPerformanceDTO | null>(null)

  return (
    <Card aria-busy={isLoading} className="p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-6 py-5">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-950">{t('Parking lot performance')}</h2>
          <p className="mt-1 text-sm text-slate-700">{t('Live occupancy with today\'s and month-to-date revenue for every parking lot.')}</p>
        </div>
        {!isLoading && !error && (
          <span className="rounded-md bg-indigo-100 px-3 py-1 text-xs font-bold tracking-wider text-indigo-700 uppercase">
            {hubs.length} {hubs.length === 1 ? 'hub' : 'hubs'}
          </span>
        )}
      </div>

      {error ? (
        <ErrorState message={tMaybe(error)} onRetry={onRetry} />
      ) : isLoading ? (
        <ul className="space-y-3 p-4 sm:p-6">
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <HubPerformanceItemSkeleton key={i} />
          ))}
        </ul>
      ) : hubs.length === 0 ? (
        <EmptyState icon={Building2} title={t('No parking lots yet')} description={t('Parking lots appear here once one has been created.')} />
      ) : (
        <>
          <ul className="space-y-3 p-4 sm:p-6">
            {hubs.map((hub) => (
              <HubPerformanceItem key={hub.lotId} hub={hub} onOpen={() => setOpenHub(hub)} />
            ))}
          </ul>
          <HubModelDialog hub={openHub} onOpenChange={(open) => !open && setOpenHub(null)} />
        </>
      )}
    </Card>
  )
}
