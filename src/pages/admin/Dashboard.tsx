import { Banknote, CarFront, Gauge, ParkingSquare, UserCog, Users, Wallet } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { LEVEL_STYLES } from '@/components/features/capacity/occupancyStyles'
import { HubPerformanceList } from '@/components/features/dashboard/HubPerformanceList'
import { StatCard } from '@/components/features/dashboard/StatCard'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/states'
import { useDashboardHubs, useDashboardOverview } from '@/hooks/useAdminDashboard'
import { formatNumber } from '@/lib/format'
import { occupancyLevel } from '@/lib/occupancy'
import { cn } from '@/lib/utils'
import type { DashboardOverviewDTO, HubPerformanceDTO } from '@/types/dashboard.dto'

/** The six headline numbers; renders skeleton cards while `overview` is still on its way. */
function OverviewStats({
  overview,
  isLoading,
  hubs,
  hubsLoading,
}: {
  overview?: DashboardOverviewDTO
  isLoading: boolean
  /** Per-hub figures; today's revenue of the network is their sum. */
  hubs?: HubPerformanceDTO[]
  hubsLoading: boolean
}) {
  const todayRevenue = (hubs ?? []).reduce((sum, hub) => sum + hub.todayRevenue, 0)
  const earningHubs = (hubs ?? []).filter((hub) => hub.todayRevenue > 0).length
  const totalBays = overview?.totalBays ?? 0
  const occupiedBays = overview?.occupiedBays ?? 0
  const loadFactor = overview?.networkLoadFactor ?? 0
  const load = LEVEL_STYLES[occupancyLevel(loadFactor)]

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <StatCard
          size="lg"
          tone="gold"
          icon={Wallet}
          label="Total gross revenue"
          isLoading={isLoading}
          value={formatNumber(Math.round(overview?.totalGrossRevenue ?? 0))}
          unit="VND"
          caption="Consolidated revenue across every hub"
          to="/admin/revenue"
          linkLabel="Open revenue report"
        />
        <StatCard
          size="lg"
          tone="gold"
          icon={Banknote}
          label="Today's revenue"
          isLoading={hubsLoading}
          value={formatNumber(Math.round(todayRevenue))}
          unit="VND"
          caption={`Collected today across the network${hubs ? ` • ${earningHubs} of ${hubs.length} hubs earning` : ''}`}
        />
        <StatCard
          size="lg"
          tone="teal"
          icon={Gauge}
          label="Network load factor"
          isLoading={isLoading}
          value={`${loadFactor.toFixed(1)}%`}
          caption={
            <>
              <span className="font-mono font-bold text-slate-900">
                {formatNumber(occupiedBays)} / {formatNumber(totalBays)}
              </span>{' '}
              bays occupied across the network
            </>
          }
        >
          <div
            className={cn('mt-5 h-2 overflow-hidden rounded-full', load.track)}
            role="meter"
            aria-label="Network occupancy"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(loadFactor)}
          >
            <div
              className={cn('h-full rounded-full transition-[width] duration-500', load.fill)}
              style={{ width: `${Math.min(100, loadFactor)}%` }}
            />
          </div>
        </StatCard>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          tone="steel"
          icon={ParkingSquare}
          label="Total bays"
          isLoading={isLoading}
          value={formatNumber(totalBays)}
          caption="Capacity of the whole network"
        />
        <StatCard
          tone="teal"
          icon={CarFront}
          label="Occupied bays"
          isLoading={isLoading}
          value={formatNumber(occupiedBays)}
          caption={`${formatNumber(totalBays - occupiedBays)} bays free right now`}
        />
        <StatCard
          tone="emerald"
          icon={Users}
          label="Active users"
          isLoading={isLoading}
          value={formatNumber(overview?.activeUsers ?? 0)}
          caption="Customer accounts in use"
        />
        <StatCard
          tone="gold"
          icon={UserCog}
          label="Active staff"
          isLoading={isLoading}
          value={formatNumber(overview?.activeStaff ?? 0)}
          caption="Managers and staff on duty"
        />
      </div>
    </>
  )
}

/** /admin/dashboard: revenue, bay utilisation and per-hub performance across the whole network. */
export default function Dashboard() {
  const overview = useDashboardOverview()
  const hubs = useDashboardHubs()

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Network overview"
        description="Network revenue, bay utilisation and hub performance at a glance."
      />

      {overview.isError ? (
        <Card>
          <ErrorState message={getErrorMessage(overview.error)} onRetry={() => void overview.refetch()} />
        </Card>
      ) : (
        <OverviewStats overview={overview.data} isLoading={overview.isPending} hubs={hubs.data} hubsLoading={hubs.isPending} />
      )}

      <HubPerformanceList
        hubs={hubs.data}
        isLoading={hubs.isPending}
        error={hubs.isError ? getErrorMessage(hubs.error) : null}
        onRetry={() => void hubs.refetch()}
      />
    </div>
  )
}
