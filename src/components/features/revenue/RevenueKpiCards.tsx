import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Banknote, Car, Receipt, Ticket } from 'lucide-react'
import { SERIES_COLORS } from '@/components/charts/chartTheme'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber, formatPercent, formatVnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { RevenueKpiSummaryDTO } from '@/types/report.dto'

/** Signed change versus the previous period; arrow + text, so it never relies on colour alone. */
function Delta({ value }: { value: number }) {
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

export function RevenueKpiCards({ data, isLoading }: { data?: RevenueKpiSummaryDTO; isLoading: boolean }) {
  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
    )
  }

  const average = data.totalTransactions > 0 ? data.totalRevenue / data.totalTransactions : 0
  const subscriptionShare = data.totalRevenue > 0 ? (data.subscriptionRevenue / data.totalRevenue) * 100 : 0

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Total revenue" icon={<Banknote />}>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{formatVnd(data.totalRevenue)}</p>
        <Delta value={data.revenueGrowthPercent} />
      </KpiCard>

      <KpiCard label="Total entries and exits" icon={<Car />}>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
          {formatNumber(data.totalTransactions)} <span className="text-base font-medium text-slate-500">entries</span>
        </p>
        <Delta value={data.transactionGrowthPercent} />
      </KpiCard>

      <KpiCard label="Monthly passes vs single tickets" icon={<Ticket />}>
        <div className="mt-3 space-y-2">
          <div
            className="flex h-2 gap-0.5 overflow-hidden rounded-full"
            role="img"
            aria-label={`Monthly passes ${subscriptionShare.toFixed(0)}%, single tickets ${(100 - subscriptionShare).toFixed(0)}%`}
          >
            <div className="rounded-l-full" style={{ width: `${subscriptionShare}%`, backgroundColor: SERIES_COLORS.blue }} />
            <div className="flex-1 rounded-r-full" style={{ backgroundColor: SERIES_COLORS.orange }} />
          </div>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="flex items-center gap-1.5 text-slate-500">
                <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: SERIES_COLORS.blue }} />
                Monthly passes
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-900">{formatVnd(data.subscriptionRevenue)}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-slate-500">
                <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: SERIES_COLORS.orange }} />
                Single tickets
              </dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-900">{formatVnd(data.walkInRevenue)}</dd>
            </div>
          </dl>
        </div>
      </KpiCard>

      <KpiCard label="Average value per transaction" icon={<Receipt />}>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{formatVnd(Math.round(average))}</p>
        <p className="mt-2 text-xs text-slate-500">Total revenue ÷ number of transactions</p>
      </KpiCard>
    </div>
  )
}
