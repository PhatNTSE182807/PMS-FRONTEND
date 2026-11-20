import { occupancyLevel } from '@/lib/occupancy'
import { cn } from '@/lib/utils'
import { LEVEL_STYLES } from './occupancyStyles'
import { t, tMaybe } from '@/i18n'

const SIZE = 120
const STROKE = 10
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** Radial meter of a lot's overall occupancy; pulses softly once the lot is full. */
export function OccupancyGauge({ percentage, isFull }: { percentage: number; isFull: boolean }) {
  const level = occupancyLevel(percentage)
  const style = LEVEL_STYLES[level]
  const clamped = Math.min(100, Math.max(0, percentage))
  const Icon = style.icon

  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={t('Occupancy {v}% — {label}', { v: clamped.toFixed(1), label: style.label })}
      className={cn('relative shrink-0', isFull && 'animate-pulse-soft')}
      style={{ width: SIZE, height: SIZE }}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke={style.trackStroke} strokeWidth={STROKE} />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={style.stroke}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - clamped / 100)}
          className="transition-[stroke-dashoffset,stroke] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-xl font-bold text-slate-900 tabular-nums">
            {clamped.toFixed(1).replace('.', ',')}
            <span className="text-sm font-semibold text-slate-500">%</span>
          </p>
          {/* Narrower than the ring's inner diameter, so long labels wrap instead of crossing the ring */}
          <p className="mx-auto mt-0.5 max-w-[72px] text-[11px] leading-tight font-medium text-slate-600">
            <Icon className="mr-0.5 inline size-3 align-[-2px]" aria-hidden style={{ color: style.stroke }} />
            {tMaybe(style.label)}
          </p>
        </div>
      </div>
    </div>
  )
}

/** Horizontal meter: filled part carries the severity, the track is the same hue lighter. */
export function OccupancyBar({ percentage, className }: { percentage: number; className?: string }) {
  const style = LEVEL_STYLES[occupancyLevel(percentage)]
  return (
    <div className={cn('h-2 overflow-hidden rounded-full', style.track, className)}>
      <div
        className={cn('h-full rounded-full transition-[width,background-color] duration-700 ease-out', style.fill)}
        style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
      />
    </div>
  )
}
