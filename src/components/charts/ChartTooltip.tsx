interface TooltipEntry {
  name?: string | number
  value?: number | string | ReadonlyArray<number | string>
  color?: string
  dataKey?: unknown
}

interface ChartTooltipProps {
  active?: boolean
  payload?: ReadonlyArray<TooltipEntry>
  label?: string | number
  formatLabel?: (label: string) => string
  formatValue: (value: number) => string
}

/** Tooltip card for Recharts: series swatch + name in ink colours, value right-aligned. */
export function ChartTooltip({ active, payload, label, formatLabel, formatValue }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="admin-root min-w-44 rounded-lg bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-slate-200">
      {label !== undefined && (
        <p className="mb-1.5 font-medium text-slate-900">{formatLabel ? formatLabel(String(label)) : label}</p>
      )}
      <ul className="space-y-1">
        {payload.map((entry) => (
          <li key={String(entry.dataKey ?? entry.name)} className="flex items-center gap-2">
            <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-500">{entry.name}</span>
            <span className="ml-auto pl-3 font-medium text-slate-900 tabular-nums">{formatValue(Number(entry.value))}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Legend row: colour key beside ink-coloured text. */
export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span aria-hidden className="h-[3px] w-3 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
