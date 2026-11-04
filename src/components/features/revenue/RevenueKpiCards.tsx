import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Banknote, Car, Receipt, Trophy } from 'lucide-react'
import { SERIES_COLORS } from '@/components/charts/chartTheme'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber, formatPercent, formatVnd, formatVndCompact } from '@/lib/format'
import { percentChange } from '@/lib/revenuePeriods'
import { cn } from '@/lib/utils'
import type { AdminRevenueReportDTO } from '@/types/report.dto'

/**
 * Signed change versus the previous period; arrow + text, so it never relies on colour alone.
 * `undefined` while the previous period loads, `null` when there is nothing to compare with.
 */
function Delta({ value }: { value: number | null | undefined }) {
  if (value === undefined) return <Skeleton className="mt-2 h-5 w-36" />
  if (value === null) return <p className="mt-2 text-xs text-slate-500">No figures for the previous period to compare</p>

  const up = value >= 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
      <span
        className={cn(
          'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium',
          up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
        )}
      >
        <Icon className="size-3.5" aria-hidden />
        {formatPercent(value)}
      </span>
      vs previous period
    </p>
  )
}

function KpiCard({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className="rounded-lg bg-slate-100 p-2 text-slate-500 [&_svg]:size-4">{icon}</div>
      </div>
      {children}
    </Card>
  )
}

function KpiSkeleton() {
  return (
    <Card className="p-5">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-4 h-7 w-40" />
      <Skeleton className="mt-3 h-4 w-32" />
    </Card>
  )
}

/** A lot's slice of a total as a thin bar, with the lot's amount and a short caption. */
function ShareBar({ part, total, label, caption }: { part: number; total: number; label: string; caption: string }) {
  const percent = total > 0 ? (part / total) * 100 : 0
  return (
    <>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${label}: ${percent.toFixed(1)}%`}>
        <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: SERIES_COLORS.blue }} />
      </div>
      <p className="mt-2 truncate text-xs text-slate-500">
        <span className="font-semibold text-slate-900 tabular-nums">{formatVnd(part)}</span> · {caption}
      </p>
    </>
  )
}

/** All lots: the lot that earned the most in the period. */
function TopLotCard({ report }: { report: AdminRevenueReportDTO }) {
  const top = report.byLot.reduce<AdminRevenueReportDTO['byLot'][number] | undefined>(
    (best, lot) => (!best || lot.totalRevenue > best.totalRevenue ? lot : best),
    undefined,
  )
  return (
    <KpiCard label="Top parking lot" icon={<Trophy />}>
      {top && top.totalRevenue > 0 ? (
        <>
          <p className="mt-3 truncate text-lg font-semibold tracking-tight text-slate-900" title={top.parkingLotName}>
            {top.parkingLotName}
          </p>
          <ShareBar
            part={top.totalRevenue}
            total={report.systemTotalRevenue}
            label="Share of revenue"
            caption={`${((top.totalRevenue / report.systemTotalRevenue) * 100).toFixed(1)}% of revenue`}
          />
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No lot earned revenue in this period.</p>
      )}
    </KpiCard>
  )
}

/** One lot: its slice of the whole network in the same period. */
function NetworkShareCard({ report, network }: { report: AdminRevenueReportDTO; network?: AdminRevenueReportDTO | null }) {
  const lotRevenue = report.systemTotalRevenue
  const networkRevenue = network?.systemTotalRevenue ?? 0
  return (
    <KpiCard label="Share of network revenue" icon={<Trophy />}>
      {network === undefined ? (
        <>
          <Skeleton className="mt-4 h-7 w-24" />
          <Skeleton className="mt-3 h-4 w-40" />
        </>
      ) : (
        <>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {networkRevenue > 0 ? `${((lotRevenue / networkRevenue) * 100).toFixed(1)}%` : '—'}
          </p>
          <ShareBar
            part={lotRevenue}
            total={networkRevenue}
            label="Share of network revenue"
            caption={`of ${formatVndCompact(networkRevenue)} in all lots`}
          />
        </>
      )}
    </KpiCard>
  )
}

interface RevenueKpiCardsProps {
  report?: AdminRevenueReportDTO
  /** The period of the same length right before: undefined while it loads, null when it failed. */
  previous?: AdminRevenueReportDTO | null
  /** Every lot in the same period, for the share of one selected lot: undefined while it loads, null when it failed. */
  network?: AdminRevenueReportDTO | null
  lotSelected: boolean
  isLoading: boolean
}

export function RevenueKpiCards({ report, previous, network, lotSelected, isLoading }: RevenueKpiCardsProps) {
  if (isLoading || !report) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
    )
  }

  const revenue = report.systemTotalRevenue
  const sessions = report.systemTotalSessions
  const average = sessions > 0 ? revenue / sessions : 0
  const change = (current: number, pick: (r: AdminRevenueReportDTO) => number) =>
    previous === undefined ? undefined : previous === null ? null : percentChange(current, pick(previous))

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Total revenue" icon={<Banknote />}>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{formatVnd(revenue)}</p>
        <Delta value={change(revenue, (r) => r.systemTotalRevenue)} />
      </KpiCard>

      <KpiCard label="Settled parking sessions" icon={<Car />}>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
          {formatNumber(sessions)} <span className="text-base font-medium text-slate-500">sessions</span>
        </p>
        <Delta value={change(sessions, (r) => r.systemTotalSessions)} />
      </KpiCard>

      {lotSelected ? <NetworkShareCard report={report} network={network} /> : <TopLotCard report={report} />}

      <KpiCard label="Average per session" icon={<Receipt />}>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{formatVnd(Math.round(average))}</p>
        <p className="mt-2 text-xs text-slate-500">Total revenue ÷ settled sessions</p>
      </KpiCard>
    </div>
  )
}
