import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { getErrorMessage } from '@/api/apiError'
import { useManagerLot } from '@/hooks/useManagerLot'
import { cn } from '@/lib/utils'
import type { ManagedLot } from '@/types/lot-management.dto'

/** Stat card used across the Manager console (label, icon, value block). */
export function Kpi({ label, icon, children, className }: { label: string; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl bg-white p-5 ring-1 ring-slate-200', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold tracking-[0.1em] text-slate-700 uppercase">{label}</p>
        {icon && <span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-indigo-700 [&_svg]:size-4.5">{icon}</span>}
      </div>
      {children}
    </section>
  )
}

/**
 * Loads the Manager's selected lot and renders `children` with it, or the loading, error and
 * "no lot assigned" states.
 */
export function WithManagerLot({ children }: { children: (lot: ManagedLot) => ReactNode }) {
  const { lots, lot } = useManagerLot()
  if (lots.isPending) {
    return (
      <div className="space-y-6" aria-busy="true">
        <Skeleton className="h-36 rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }
  if (lots.isError) {
    return (
      <Card>
        <ErrorState message={getErrorMessage(lots.error)} onRetry={() => lots.refetch()} />
      </Card>
    )
  }
  if (!lot) {
    return (
      <Card>
        <EmptyState
          icon={Building2}
          title="No parking lot assigned yet"
          description="Ask an Admin to assign you to a parking lot. Its console appears here once it is assigned."
          action={
            <Link to="/management/lots" className="text-sm font-semibold text-indigo-700 hover:underline">
              Open Facility Zones &amp; Bays
            </Link>
          }
        />
      </Card>
    )
  }
  return <>{children(lot)}</>
}
