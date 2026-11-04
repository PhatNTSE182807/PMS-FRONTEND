import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartLegend, ChartTooltip } from '@/components/charts/ChartTooltip'
import { axisProps, GRID_COLOR, SERIES_COLORS } from '@/components/charts/chartTheme'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/states'
import { formatNumber, formatVnd, formatVndCompact, toIsoDate } from '@/lib/format'
import { formatPeriod, formatPeriodTick } from '@/lib/revenuePeriods'
import { cn } from '@/lib/utils'
import type { AdminRevenueTimeSeriesDTO, RevenueGranularityDTO } from '@/types/report.dto'

const METRICS = {
  revenue: { label: 'Revenue', unit: 'in VND', total: 'totalRevenue', car: 'carRevenue', motorbike: 'motorbikeRevenue', format: formatVnd, tick: formatVndCompact },
  sessions: { label: 'Sessions', unit: 'settled sessions', total: 'totalSessions', car: 'carSessions', motorbike: 'motorbikeSessions', format: formatNumber, tick: formatNumber },
} as const
type Metric = keyof typeof METRICS

const STEP_LABELS: Record<RevenueGranularityDTO, string> = { DAY: 'Daily', WEEK: 'Weekly', MONTH: 'Monthly', YEAR: 'Yearly' }

interface RevenueTrendChartProps {
  data?: AdminRevenueTimeSeriesDTO
  isLoading: boolean
  /** Off while the report is filtered to one vehicle type: there is nothing to compare. */
  canCompare: boolean
}

/** Main chart: revenue (or settled sessions) per day, week, month or year, optionally split into cars and motorbikes. */
export function RevenueTrendChart({ data, isLoading, canCompare }: RevenueTrendChartProps) {
  const [metric, setMetric] = useState<Metric>('revenue')
  const [compareToggle, setCompare] = useState(false)
  const compare = compareToggle && canCompare
  const m = METRICS[metric]
  const series = compare
    ? [
        { key: m.car, label: 'Cars', color: SERIES_COLORS.blue },
        { key: m.motorbike, label: 'Motorbikes', color: SERIES_COLORS.orange },
      ]
    : [{ key: m.total, label: m.label, color: metric === 'revenue' ? SERIES_COLORS.blue : SERIES_COLORS.orange }]

  const points = (data?.points ?? []).map((p) => ({ ...p, date: p.startDate }))
  const endDates = new Map(points.map((p) => [p.startDate, p.endDate]))
  const hasData = points.some((p) => p.totalRevenue > 0 || p.totalSessions > 0)
  const granularity = data?.granularity ?? 'DAY'
  // The last point is still filling up when the range ends today; say so, so the dip is not misread.
  const includesToday = points.at(-1)?.endDate === toIsoDate(new Date())

  return (
    <Card className="flex flex-col lg:col-span-2">
      <CardHeader>
        <div>
          <CardTitle>Revenue trend</CardTitle>
          <CardDescription>
            {STEP_LABELS[granularity]}, {m.unit}
            {includesToday && ' · latest period counted up to now'}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* One button, not a button inside a label: the label would fire a second click and undo the first */}
          <button
            type="button"
            role="switch"
            aria-checked={compare}
            disabled={!canCompare}
            onClick={() => setCompare((v) => !v)}
            className={cn('flex items-center gap-2 text-sm text-slate-600', canCompare ? 'cursor-pointer' : 'opacity-50')}
          >
            <span className={cn('relative h-5 w-9 rounded-full transition-colors', compare ? 'bg-indigo-600' : 'bg-slate-300')}>
              <span className={cn('absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform', compare && 'translate-x-4')} />
            </span>
            Compare car / motorbike
          </button>
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
        </div>
      </CardHeader>

      <div className="px-5 pt-3">{compare && <ChartLegend items={series.map((s) => ({ label: s.label, color: s.color }))} />}</div>

      <div className="h-80 px-2 pt-2 pb-4">
        {isLoading || !data ? (
          <Skeleton className="mx-3 h-full" />
        ) : !hasData ? (
          <EmptyState title="No data" description="No settled parking sessions in this period." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="date" {...axisProps} tickFormatter={(date: string) => formatPeriodTick(granularity, date)} minTickGap={24} dy={6} />
              <YAxis {...axisProps} tickFormatter={m.tick} width={72} allowDecimals={false} />
              <Tooltip
                cursor={{ stroke: '#41484c', strokeWidth: 1 }}
                content={(props) => (
                  <ChartTooltip
                    active={props.active}
                    payload={props.payload}
                    label={props.label}
                    formatLabel={(date) => formatPeriod({ startDate: date, endDate: endDates.get(date) ?? date })}
                    formatValue={m.format}
                  />
                )}
              />
              {series.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  fill={s.color}
                  fillOpacity={0.1}
                  activeDot={{ r: 4, stroke: '#182127', strokeWidth: 2 }}
                  // A single point has no line to draw, so show it as a dot.
                  dot={points.length === 1 ? { r: 4, fill: s.color } : false}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}
