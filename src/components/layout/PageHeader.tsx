import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  /** Small uppercase line above the title, e.g. "Saigon metropolitan grid • Facility control layer". */
  eyebrow?: ReactNode
  actions?: ReactNode
}

/** Hero card at the top of every admin page (Stitch "Admin Command" design). */
export function PageHeader({ title, description, eyebrow, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-5 rounded-2xl bg-linear-to-br from-[#182127] via-[#141d23] to-[#1a2a2f] px-6 py-6 ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between sm:px-7">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold tracking-[0.12em] text-slate-700 uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-700">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Marks a section that shows sample data because its API does not exist yet. */
export function DemoTag() {
  return (
    <span
      className="inline-flex items-center rounded border border-dashed border-amber-300 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-500 uppercase"
      title="Sample data: this section has no API yet"
    >
      Demo
    </span>
  )
}

/** Teal pill used inside a PageHeader eyebrow. */
export function EyebrowTag({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-indigo-700">{children}</span>
}
