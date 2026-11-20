import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  actions?: ReactNode
}

/** "XXIV PARKING" brand line shown above every page title; "XXIV" is in the brand amber. */
export function BrandEyebrow({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs font-bold tracking-[0.12em] text-slate-700 uppercase ${className}`}>
      <span className="text-amber-500">XXIV</span> Parking
    </p>
  )
}

/** Hero card at the top of every admin, manager and staff page: brand line, title and optional actions. */
export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-5 rounded-2xl bg-linear-to-br from-white via-slate-50 to-header-end px-6 py-6 ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between sm:px-7">
      <div className="min-w-0">
        <BrandEyebrow className="mb-2" />
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
