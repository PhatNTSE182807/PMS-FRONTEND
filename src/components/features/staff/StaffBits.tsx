import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Rounded module surface of the Staff console. */
export function Panel({ className, children, ...props }: ComponentProps<'section'>) {
  return (
    <section className={cn('rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-6', className)} {...props}>
      {children}
    </section>
  )
}

/** Uppercase serif heading with an optional icon and right-hand slot. */
export function SectionTitle({ icon, children, aside, className }: { icon?: ReactNode; children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-5 flex flex-wrap items-center justify-between gap-3', className)}>
      <h2 className="flex items-center gap-2.5 font-display text-lg font-bold tracking-wide text-slate-950 uppercase [&_svg]:size-5 [&_svg]:text-amber-500">
        {icon}
        {children}
      </h2>
      {aside}
    </div>
  )
}

/** Licence plate chip in monospace (ANPR style). */
export function Plate({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-block rounded bg-[#060f16] px-2 py-0.5 font-mono text-sm font-bold tracking-wider text-slate-950 ring-1 ring-slate-200', className)}>
      {children}
    </span>
  )
}

/** Stat tile of the top KPI row. */
export function StatTile({ label, icon, children, className }: { label: string; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl bg-white p-5 ring-1 ring-slate-200', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold tracking-[0.1em] text-slate-700 uppercase">{label}</p>
        {icon && <span className="text-indigo-700 [&_svg]:size-4.5">{icon}</span>}
      </div>
      {children}
    </section>
  )
}

/** Big number with a unit, e.g. "1,248" or "3,850,000 VND". */
export function Metric({ value, unit, className }: { value: ReactNode; unit?: ReactNode; className?: string }) {
  return (
    <p className={cn('mt-3 font-display text-3xl font-bold tracking-tight text-slate-950 tabular-nums', className)}>
      {value}
      {unit && <span className="ml-1.5 text-sm font-semibold text-slate-700">{unit}</span>}
    </p>
  )
}

/** Keyboard hint chip, e.g. [F5]. */
export function Key({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cn('rounded bg-[#060f16] px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-950', className)}>{children}</kbd>
}

/** Camera still with a header strip and a plate overlay, used for ANPR feeds and evidence. */
export function CameraFrame({
  image,
  alt,
  topLeft,
  topRight,
  overlay,
  bottomLeft,
  bottomRight,
  className,
}: {
  image: string
  alt: string
  topLeft?: ReactNode
  topRight?: ReactNode
  overlay?: ReactNode
  bottomLeft?: ReactNode
  bottomRight?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('relative aspect-video overflow-hidden rounded-xl bg-[#060f16]', className)}>
      <img src={image} alt={alt} className="h-full w-full object-cover opacity-80" />
      <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-black/40" aria-hidden />
      {(topLeft || topRight) && (
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2 font-mono text-[11px] font-bold tracking-wider uppercase">
          <span className="rounded bg-black/60 px-1.5 py-0.5 text-slate-950">{topLeft}</span>
          {topRight && <span className="rounded bg-black/60 px-1.5 py-0.5 text-amber-500">{topRight}</span>}
        </div>
      )}
      {overlay && <div className="absolute inset-0 grid place-items-center">{overlay}</div>}
      {(bottomLeft || bottomRight) && (
        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2 font-mono text-[11px] font-bold tracking-wider text-slate-900 uppercase">
          <span>{bottomLeft}</span>
          <span>{bottomRight}</span>
        </div>
      )}
    </div>
  )
}
