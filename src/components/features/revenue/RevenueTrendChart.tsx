import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartLegend, ChartTooltip } from '@/components/charts/ChartTooltip'
import { axisProps, GRID_COLOR, SERIES_COLORS } from '@/components/charts/chartTheme'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/states'
import { formatDayMonth, formatVnd, formatVndCompact, toIsoDate } from '@/lib/format'
import type { RevenueTimeSeriesResultDTO, TimeSeriesGranularity } from '@/types/report.dto'

const SERIES = {
  total: { key: 'totalRevenue', label: 'Total revenue', color: SERIES_COLORS.blue },
  car: { key: 'carRevenue', label: 'Car', color: SERIES_COLORS.blue },
  motorbike: { key: 'motorbikeRevenue', label: 'Motorbike', color: SERIES_COLORS.orange },
} as const

const formatPeriod = (granularity: TimeSeriesGranularity) => (date: string) =>
  granularity === 'MONTH' ? `Month ${date.slice(5, 7)}/${date.slice(0, 4)}` : formatDayMonth(date)

const formatTooltipPeriod = (granularity: TimeSeriesGranularity) => (date: string) =>
  granularity === 'MONTH' ? `Month ${date.slice(5, 7)}/${date.slice(0, 4)}` : `${formatDayMonth(date)}/${date.slice(0, 4)}`

interface RevenueTrendChartProps {
  data?: RevenueTimeSeriesResultDTO
  isLoading: boolean
}

/** Main chart: revenue over time, optionally split into car vs motorbike. */
export function RevenueTrendChart({ data, isLoading }: RevenueTrendChartProps) {
  const [compare, setCompare] = useState(false)
  const series = compare ? [SERIES.car, SERIES.motorbike] : [SERIES.total]
  const granularity = data?.granularity ?? 'DAY'
  // The last point is still filling up when the range ends today; say so, so the dip is not misread.
  const today = toIsoDate(new Date())
  const lastPoint = data?.points.at(-1)?.date
  const includesToday = lastPoint !== undefined && (granularity === 'MONTH' ? today.startsWith(lastPoint.slice(0, 7)) : lastPoint === today)

  return (
    <Card className="flex flex-col lg:col-span-2">
      <CardHeader>
        <div>
          <CardTitle>Revenue trend</CardTitle>
          <CardDescription>
            {granularity === 'MONTH' ? 'Monthly' : 'Daily'}, in VND
            {includesToday && ' · latest period counted up to now'}
          </CardDescription>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <button
            type="button"
            role="switch"
            aria-checked={compare}
            onClick={() => setCompare((v) => !v)}
            className={`relative h-5 w-9 rounded-full transition-colors ${compare ? 'bg-indigo-600' : 'bg-slate-300'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform ${compare ? 'translate-x-4' : ''}`}
            />
          </button>
          Compare car / motorbike
        </label>
      </CardHeader>

      <div className="px-5 pt-3">{series.length > 1 && <ChartLegend items={series.map((s) => ({ label: s.label, color: s.color }))} />}</div>

      <div className="h-80 px-2 pt-2 pb-4">
        {isLoading || !data ? (
          <Skeleton className="mx-3 h-full" />
        ) : data.points.length === 0 ? (
          <EmptyState title="No data" description="No transactions in this period." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.points} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="date" {...axisProps} tickFormatter={formatPeriod(granularity)} minTickGap={24} dy={6} />
              <YAxis {...axisProps} tickFormatter={formatVndCompact} width={72} />
              <Tooltip
                cursor={{ stroke: '#41484c', strokeWidth: 1 }}
                content={(props) => (
                  <ChartTooltip
                    active={props.active}
                    payload={props.payload}
                    label={props.label}
                    formatLabel={formatTooltipPeriod(granularity)}
                    formatValue={formatVnd}
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
                  dot={false}
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
