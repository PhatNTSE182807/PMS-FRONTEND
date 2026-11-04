import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartTooltip } from '@/components/charts/ChartTooltip'
import { axisProps, GRID_COLOR, SERIES_COLORS } from '@/components/charts/chartTheme'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/states'
import type { RevenuePeriodReport } from '@/hooks/useRevenueReport'
import { formatNumber, formatVnd, formatVndCompact, toIsoDate } from '@/lib/format'
import { formatPeriod, formatPeriodTick, type RevenueGranularity } from '@/lib/revenuePeriods'
import { cn } from '@/lib/utils'

const METRICS = {
  revenue: { key: 'totalRevenue', label: 'Revenue', unit: 'in VND', color: SERIES_COLORS.blue, format: formatVnd, tick: formatVndCompact },
  sessions: { key: 'totalSessions', label: 'Sessions', unit: 'settled sessions', color: SERIES_COLORS.orange, format: formatNumber, tick: formatNumber },
} as const
type Metric = keyof typeof METRICS

const STEP_LABELS: Record<RevenueGranularity, string> = { DAY: 'Daily', WEEK: 'Weekly', MONTH: 'Monthly', YEAR: 'Yearly' }

interface RevenueTrendChartProps {
  periods?: RevenuePeriodReport[]
  granularity: RevenueGranularity
  isLoading: boolean
}

/** Main chart: revenue (or settled sessions) per day, week, month or year of the selected range. */
export function RevenueTrendChart({ periods, granularity, isLoading }: RevenueTrendChartProps) {
  const [metric, setMetric] = useState<Metric>('revenue')
  const series = METRICS[metric]
  const points = (periods ?? []).map((period) => ({
    date: period.startDate,
    endDate: period.endDate,
    totalRevenue: period.report.systemTotalRevenue,
    totalSessions: period.report.systemTotalSessions,
  }))
  const endDates = new Map(points.map((point) => [point.date, point.endDate]))
  const hasData = points.some((point) => point.totalRevenue > 0 || point.totalSessions > 0)
  // The last point is still filling up when the range ends today; say so, so the dip is not misread.
  const includesToday = points.at(-1)?.endDate === toIsoDate(new Date())

  return (
    <Card className="flex flex-col lg:col-span-2">
      <CardHeader>
        <div>
          <CardTitle>Revenue trend</CardTitle>
          <CardDescription>
            {STEP_LABELS[granularity]}, {series.unit}
            {includesToday && ' · latest period counted up to now'}
          </CardDescription>
        </div>
        <div role="group" aria-label="Chart metric" className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {(Object.keys(METRICS) as Metric[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={metric === key}
              onClick={() => setMetric(key)}
              className={cn(
                'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                metric === key ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:text-slate-900',
              )}
            >
              {METRICS[key].label}
            </button>
          ))}
        </div>
      </CardHeader>

      <div className="h-80 px-2 pt-2 pb-4">
        {isLoading || !periods ? (
          <Skeleton className="mx-3 h-full" />
        ) : !hasData ? (
          <EmptyState title="No data" description="No settled parking sessions in this period." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={GRID_COLOR} vertical={false} />
              <XAxis
                dataKey="date"
                {...axisProps}
                tickFormatter={(date: string) => formatPeriodTick(granularity, date)}
                minTickGap={24}
                dy={6}
              />
              <YAxis {...axisProps} tickFormatter={series.tick} width={72} allowDecimals={false} />
              <Tooltip
                cursor={{ stroke: '#41484c', strokeWidth: 1 }}
                content={(props) => (
                  <ChartTooltip
                    active={props.active}
                    payload={props.payload}
                    label={props.label}
                    formatLabel={(date) => formatPeriod({ startDate: date, endDate: endDates.get(date) ?? date })}
                    formatValue={series.format}
                  />
                )}
              />
              <Area
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.label}
                stroke={series.color}
                strokeWidth={2}
                fill={series.color}
                fillOpacity={0.1}
                activeDot={{ r: 4, stroke: '#182127', strokeWidth: 2 }}
                // A single point has no line to draw, so show it as a dot.
                dot={points.length === 1 ? { r: 4, fill: series.color } : false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}
