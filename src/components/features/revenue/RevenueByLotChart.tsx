import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartTooltip } from '@/components/charts/ChartTooltip'
import { axisProps, CHART_TEXT, GRID_COLOR, SERIES_COLORS } from '@/components/charts/chartTheme'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useElementWidth } from '@/hooks/useElementWidth'
import { formatVnd, formatVndCompact } from '@/lib/format'
import type { RevenueByParkingLotDTO } from '@/types/report.dto'

const BAR_SIZE = 18
const ROW_HEIGHT = 44

/** Horizontal bars comparing lots; single series, so the title names it and no legend is needed. */
export function RevenueByLotChart({ data, isLoading }: { data?: RevenueByParkingLotDTO[]; isLoading: boolean }) {
  const [containerRef, width] = useElementWidth<HTMLDivElement>()
  const isNarrow = width > 0 && width < 520
  const rows = (data ?? []).map((row) => {
    const shortName = row.parkingLotName.replace(/ Parking$/, '')
    return { ...row, shortName: isNarrow && shortName.length > 16 ? `${shortName.slice(0, 15)}…` : shortName }
  })

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Revenue by parking lot</CardTitle>
          <CardDescription>Compared across lots for the selected period</CardDescription>
        </div>
      </CardHeader>
      <div ref={containerRef} className="px-2 pt-2 pb-4">
        {isLoading || !data ? (
          <div className="space-y-3 px-3 py-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-5" style={{ width: `${90 - i * 11}%` }} />
            ))}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(rows.length, 1) * ROW_HEIGHT + 24}>
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: isNarrow ? 56 : 72, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={GRID_COLOR} horizontal={false} />
              <XAxis type="number" {...axisProps} tickFormatter={formatVndCompact} hide={isNarrow} />
              <YAxis
                type="category"
                dataKey="shortName"
                {...axisProps}
                width={isNarrow ? 110 : 170}
                tick={{ fill: CHART_TEXT.secondary, fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: '#222b32' }}
                content={(props) => (
                  <ChartTooltip
                    active={props.active}
                    payload={props.payload?.map((p) => ({ ...p, name: 'Doanh thu' }))}
                    label={props.label}
                    formatValue={formatVnd}
                  />
                )}
              />
              <Bar
                dataKey="totalRevenue"
                fill={SERIES_COLORS.blue}
                barSize={BAR_SIZE}
                radius={[0, 4, 4, 0]}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="totalRevenue"
                  position="right"
                  formatter={(value) => formatVndCompact(Number(value))}
                  style={{ fill: CHART_TEXT.secondary, fontSize: 12 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}
