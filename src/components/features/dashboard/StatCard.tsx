import type { ReactNode } from 'react'
import { ArrowRight, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type StatCardTone = 'teal' | 'gold' | 'emerald' | 'steel'

const TONES: Record<StatCardTone, { icon: string; accent: string }> = {
  teal: { icon: 'bg-indigo-100 text-indigo-700', accent: 'text-indigo-700' },
  gold: { icon: 'bg-amber-100 text-amber-500', accent: 'text-amber-500' },
  emerald: { icon: 'bg-emerald-100 text-emerald-700', accent: 'text-emerald-700' },
  steel: { icon: 'bg-sky-100 text-sky-700', accent: 'text-sky-700' },
}

interface StatCardProps {
  label: string
  value: ReactNode
  /** Small muted suffix after the value, e.g. "VND". */
  unit?: string
  caption?: ReactNode
  icon: LucideIcon
  tone?: StatCardTone
  /** `lg` is for the headline numbers, `md` for the secondary row. */
  size?: 'md' | 'lg'
  /** Shows grey placeholder bars instead of the value while the data is on its way. */
  isLoading?: boolean
  /** Extra content under the caption, e.g. a meter. Hidden while loading. */
  children?: ReactNode
  /** Makes the whole card a link to this route, with `linkLabel` as the hint at the bottom. */
  to?: string
  linkLabel?: string
  className?: string
}

/** One headline number of the Admin dashboard. */
export function StatCard({
  label,
  value,
  unit,
  caption,
  icon: Icon,
  tone = 'teal',
  size = 'md',
  isLoading = false,
  children,
  to,
  linkLabel = 'View details',
  className,
}: StatCardProps) {
  const large = size === 'lg'
  const t = TONES[tone]

  const card = (
    <Card
      aria-busy={isLoading}
      className={cn(
        'relative overflow-hidden',
        large ? 'p-6' : 'p-5',
        to && 'h-full transition-shadow group-hover:ring-slate-300 group-focus-visible:ring-2 group-focus-visible:ring-indigo-500',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn('absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-current to-transparent opacity-60', t.accent)}
      />

      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-bold tracking-[0.1em] text-slate-800 uppercase">{label}</p>
        <span className={cn('grid shrink-0 place-items-center rounded-lg', large ? 'size-10' : 'size-9', t.icon)}>
          <Icon className={large ? 'size-5' : 'size-4'} aria-hidden />
        </span>
      </div>

      {isLoading ? (
        <>
          <Skeleton className={cn('mt-5', large ? 'h-12 w-3/4' : 'h-9 w-1/2')} />
          <Skeleton className="mt-3 h-4 w-2/3" />
        </>
      ) : (
        <>
          <p
            className={cn(
              'mt-5 font-display font-bold tracking-tight text-slate-950 tabular-nums',
              // Between lg and xl the two big cards sit side by side in a narrow column.
              large ? 'text-4xl sm:text-5xl lg:text-3xl xl:text-5xl' : 'text-3xl',
            )}
          >
            {value}
            {unit && <span className="ml-2 text-base font-semibold tracking-normal text-slate-600">{unit}</span>}
          </p>
          {caption && <p className="mt-2 text-sm text-slate-700">{caption}</p>}
          {children}
        </>
      )}

      {to && (
        <p className={cn('mt-4 flex items-center gap-1.5 text-sm font-semibold', t.accent)}>
          {linkLabel}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </p>
      )}
    </Card>
  )

  if (!to) return card
  return (
    <Link to={to} className="group block rounded-xl outline-none">
      {card}
    </Link>
  )
}
