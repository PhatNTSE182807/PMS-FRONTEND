import { CalendarRange, FileSpreadsheet, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, NativeSelect } from '@/components/ui/form-controls'
import { toIsoDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ParkingLotSummaryDTO } from '@/types/parking.dto'
import type { ReportVehicleType, RevenueFilterQuery } from '@/types/report.dto'
import { DATE_PRESETS, presetRange, VEHICLE_TYPE_OPTIONS, type DatePreset } from './revenueFilters'

export interface RevenueFilterState extends RevenueFilterQuery {
  preset: DatePreset
}

interface RevenueFilterBarProps {
  value: RevenueFilterState
  onChange: (value: RevenueFilterState) => void
  parkingLots: ParkingLotSummaryDTO[]
  onExport: (format: 'excel' | 'pdf') => void
}

/** Global filters for every widget on the revenue report — one row above the charts. */
export function RevenueFilterBar({ value, onChange, parkingLots, onExport }: RevenueFilterBarProps) {
  const today = toIsoDate(new Date())

  const setCustomDate = (key: 'startDate' | 'endDate', date: string) => {
    if (!date) return
    const next = { ...value, [key]: date, preset: 'custom' as const }
    // Keep the range valid when one end jumps past the other.
    if (next.startDate > next.endDate) {
      if (key === 'startDate') next.endDate = date
      else next.startDate = date
    }
    onChange(next)
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Quick date range" className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              aria-pressed={value.preset === preset.value}
              onClick={() => onChange({ ...value, ...presetRange(preset.value), preset: preset.value })}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                value.preset === preset.value
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <CalendarRange className="size-4 text-slate-400" aria-hidden />
          <Input
            type="date"
            aria-label="From date"
            value={value.startDate}
            max={today}
            onChange={(e) => setCustomDate('startDate', e.target.value)}
            className="w-38"
          />
          <span className="text-slate-400">–</span>
          <Input
            type="date"
            aria-label="To date"
            value={value.endDate}
            max={today}
            onChange={(e) => setCustomDate('endDate', e.target.value)}
            className="w-38"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-64">
          <NativeSelect
            aria-label="Parking lot"
            value={value.parkingLotId ?? ''}
            onChange={(e) => onChange({ ...value, parkingLotId: e.target.value || undefined })}
          >
            <option value="">All parking lots</option>
            {parkingLots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="w-full sm:w-52">
          <NativeSelect
            aria-label="Vehicle type"
            value={value.vehicleType ?? 'ALL'}
            onChange={(e) => onChange({ ...value, vehicleType: e.target.value as ReportVehicleType })}
          >
            {VEHICLE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex gap-2 sm:ml-auto">
          <Button variant="outline" onClick={() => onExport('excel')}>
            <FileSpreadsheet className="text-emerald-600" />
            Export Excel
          </Button>
          <Button variant="outline" onClick={() => onExport('pdf')}>
            <FileText className="text-rose-600" />
            Export PDF
          </Button>
        </div>
      </div>
    </Card>
  )
}
