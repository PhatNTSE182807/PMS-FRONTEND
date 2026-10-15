import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/** Scroll container + table; wide tables scroll horizontally inside the card on phones. */
export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  )
}

export function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
  return <thead className={cn('border-b border-slate-200 bg-slate-50/70', className)} {...props} />
}

export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody className={cn('divide-y divide-slate-100', className)} {...props} />
}

export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return <tr className={cn('group transition-colors hover:bg-slate-50/80', className)} {...props} />
}

export function TableHead({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      scope="col"
      className={cn(
        'h-10 px-3 text-left align-middle text-xs font-semibold tracking-wide whitespace-nowrap text-slate-500 uppercase',
        className,
      )}
      {...props}
    />
  )
}

export function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return <td className={cn('px-3 py-3 align-middle text-slate-700', className)} {...props} />
}
