import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { ChartTooltip } from '@/components/charts/ChartTooltip'
import { SERIES_COLORS } from '@/components/charts/chartTheme'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatVnd, formatVndCompact } from '@/lib/format'
import type { PaymentMethod, PaymentMethodBreakdownDTO } from '@/types/report.dto'
import { PAYMENT_METHOD_LABELS } from './revenueFilters'

/** Fixed colour per method (entity), so filtering never repaints a slice. */
const METHOD_COLORS: Record<PaymentMethod, string> = {
  QR_BANKING: SERIES_COLORS.blue,
  CASH: SERIES_COLORS.orange,
  RFID_WALLET: SERIES_COLORS.aqua,
}
const METHOD_ORDER: PaymentMethod[] = ['QR_BANKING', 'RFID_WALLET', 'CASH']

export function PaymentMethodChart({ data, isLoading }: { data?: PaymentMethodBreakdownDTO[]; isLoading: boolean }) {
  const rows = METHOD_ORDER.map((method) => data?.find((d) => d.method === method)).filter(
    (row): row is PaymentMethodBreakdownDTO => row !== undefined,
  )
  const total = rows.reduce((sum, row) => sum + row.amount, 0)

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>Payment methods</CardTitle>
          <CardDescription>Revenue share by channel</CardDescription>
        </div>
      </CardHeader>

      {isLoading || !data ? (
        <div className="space-y-4 p-5">
          <Skeleton className="mx-auto size-44 rounded-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-4 p-5">
          <div className="relative mx-auto h-48 w-full max-w-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="amount"
                  nameKey="method"
                  innerRadius="68%"
                  outerRadius="100%"
                  startAngle={90}
                  endAngle={-270}
                  stroke="#ffffff"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {rows.map((row) => (
                    <Cell key={row.method} fill={METHOD_COLORS[row.method]} name={PAYMENT_METHOD_LABELS[row.method]} />
                  ))}
                </Pie>
                <Tooltip
                  content={(props) => (
                    <ChartTooltip
                      active={props.active}
                      payload={props.payload?.map((p) => ({ ...p, color: METHOD_COLORS[p.payload?.method as PaymentMethod] }))}
                      formatValue={formatVnd}
                    />
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-xs text-slate-500">Total</p>
                <p className="text-lg font-semibold text-slate-900">{formatVndCompact(total)}</p>
              </div>
            </div>
          </div>

          {/* Legend doubles as the data table: label, share and amount for every slice. */}
          <ul className="space-y-2.5">
            {rows.map((row) => (
              <li key={row.method} className="flex items-center gap-2 text-sm">
                <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: METHOD_COLORS[row.method] }} />
                <span className="text-slate-600">{PAYMENT_METHOD_LABELS[row.method]}</span>
                <span className="ml-auto font-medium text-slate-900 tabular-nums">{row.percentage.toFixed(1).replace('.', ',')}%</span>
                <span className="w-20 text-right text-xs text-slate-500 tabular-nums">{formatVndCompact(row.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
