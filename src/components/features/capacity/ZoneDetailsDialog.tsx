import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartLegend, ChartTooltip } from '@/components/charts/ChartTooltip'
import { axisProps, GRID_COLOR, SERIES_COLORS } from '@/components/charts/chartTheme'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatNumber } from '@/lib/format'
import { occupancyLevel, occupancyRate } from '@/lib/occupancy'
import type { ParkingLotCapacityDTO } from '@/types/parking.dto'
import { OccupancyBar } from './OccupancyGauge'
import { LEVEL_STYLES } from './occupancyStyles'

const FLOW_SERIES = [
  { key: 'checkIns', label: 'Check-ins', color: SERIES_COLORS.blue },
  { key: 'checkOuts', label: 'Check-outs', color: SERIES_COLORS.orange },
] as const

interface ZoneDetailsDialogProps {
  lot: ParkingLotCapacityDTO | null
  onOpenChange: (open: boolean) => void
}

/** Per-zone occupancy and recent in/out flow of one lot. */
export function ZoneDetailsDialog({ lot, onOpenChange }: ZoneDetailsDialogProps) {
  const lastHour = lot?.recentHourlyFlow.at(-1)

  return (
    <Dialog open={lot !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {lot && (
          <>
            <DialogHeader>
              <DialogTitle>{lot.name}</DialogTitle>
              <DialogDescription>Zone details · {lot.code}</DialogDescription>
            </DialogHeader>

            <section aria-labelledby="zones-heading" className="space-y-3">
              <h3 id="zones-heading" className="text-sm font-semibold text-slate-900">
                Zones ({lot.zones.length})
              </h3>
              <ul className="space-y-3">
                {lot.zones.map((zone) => {
                  const rate = occupancyRate(zone.occupiedSlots, zone.totalSlots)
                  const style = LEVEL_STYLES[occupancyLevel(rate)]
                  const Icon = style.icon
                  return (
                    <li key={zone.zoneId} className="rounded-lg p-3 ring-1 ring-slate-200">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900">{zone.zoneName}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="tabular-nums">
                            {formatNumber(zone.occupiedSlots)} / {formatNumber(zone.totalSlots)} slots
                          </span>
                          <Badge tone={style.tone}>
                            <Icon aria-hidden />
                            {rate.toFixed(0)}% · {style.label}
                          </Badge>
                        </div>
                      </div>
                      <OccupancyBar percentage={rate} />
                    </li>
                  )
                })}
              </ul>
            </section>

            <section aria-labelledby="flow-heading" className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 id="flow-heading" className="text-sm font-semibold text-slate-900">
                    Hourly traffic
                  </h3>
                  {lastHour && (
                    <p className="mt-0.5 flex items-center gap-3 text-xs text-slate-500">
                      Last hour ({lastHour.hour}):
                      <span className="flex items-center gap-1">
                        <ArrowDownLeft className="size-3.5" aria-hidden /> {formatNumber(lastHour.checkIns)} in
                      </span>
                      <span className="flex items-center gap-1">
                        <ArrowUpRight className="size-3.5" aria-hidden /> {formatNumber(lastHour.checkOuts)} out
                      </span>
                    </p>
                  )}
                </div>
                <ChartLegend items={FLOW_SERIES.map((s) => ({ label: s.label, color: s.color }))} />
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={lot.recentHourlyFlow} margin={{ top: 4, right: 4, bottom: 0, left: -12 }} barGap={2}>
                    <CartesianGrid stroke={GRID_COLOR} vertical={false} />
                    <XAxis dataKey="hour" {...axisProps} />
                    <YAxis {...axisProps} tickFormatter={formatNumber} />
                    <Tooltip
                      cursor={{ fill: '#222b32' }}
                      content={(props) => (
                        <ChartTooltip
                          active={props.active}
                          payload={props.payload}
                          label={props.label}
                          formatLabel={(hour) => `Hour ${hour}`}
                          formatValue={(value) => `${formatNumber(value)} vehicles`}
                        />
                      )}
                    />
                    {FLOW_SERIES.map((s) => (
                      <Bar
                        key={s.key}
                        dataKey={s.key}
                        name={s.label}
                        fill={s.color}
                        maxBarSize={20}
                        radius={[4, 4, 0, 0]}
                        isAnimationActive={false}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
