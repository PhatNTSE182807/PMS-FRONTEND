import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset [&_svg]:size-3',
  {
    variants: {
      tone: {
        neutral: 'bg-slate-50 text-slate-700 ring-slate-200',
        indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
        sky: 'bg-sky-50 text-sky-700 ring-sky-200',
        emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
        amber: 'bg-amber-50 text-amber-800 ring-amber-200',
        rose: 'bg-rose-50 text-rose-700 ring-rose-200',
        violet: 'bg-violet-50 text-violet-700 ring-violet-200',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>

export function Badge({ className, tone, ...props }: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}

/** Small coloured dot used before status labels. */
export function StatusDot({ className }: { className?: string }) {
  return <span aria-hidden className={cn('size-1.5 rounded-full bg-current', className)} />
}
