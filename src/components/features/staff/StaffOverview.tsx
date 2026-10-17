import type { ReactNode } from 'react'
import { Gavel, IdCard, ShieldCheck, SquareParking, UserCog } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useParkingLots } from '@/hooks/useParking'
import { useStaffList } from '@/hooks/useStaff'
import { formatNumber } from '@/lib/format'

function Kpi({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold tracking-[0.1em] text-slate-700 uppercase">{label}</p>
        <span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-amber-500 [&_svg]:size-4.5">{icon}</span>
      </div>
      {children}
    </section>
  )
}

/**
 * Headline numbers above the staff directory. Managers are counted from one large page
 * (there are only a few dozen), so lot coverage can be worked out on the client.
 */
export function StaffOverview() {
  const managers = useStaffList({ role: 'MANAGER', pageNumber: 1, pageSize: 200 })
  const gateStaff = useStaffList({ role: 'STAFF', pageNumber: 1, pageSize: 1 })
  const lockedStaff = useStaffList({ role: 'STAFF', status: 'SUSPENDED', pageNumber: 1, pageSize: 1 })
  const lots = useParkingLots()

  const list = managers.data?.items ?? []
  const active = list.filter((m) => m.status === 'ACTIVE').length
  const inactive = list.filter((m) => m.status === 'INACTIVE').length
  const suspended = list.filter((m) => m.status === 'SUSPENDED').length
  const coveredIds = new Set(list.filter((m) => m.status === 'ACTIVE').flatMap((m) => m.assignedParkingLots.map((l) => l.id)))
  const totalLots = lots.data?.length ?? 0
  const coverage = totalLots ? Math.round((coveredIds.size / totalLots) * 100) : 0
  const uncovered = (lots.data ?? []).filter((l) => !coveredIds.has(l.id))

  if (managers.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total station leads" icon={<IdCard />}>
          <p className="mt-3 font-display text-4xl font-bold text-slate-950">
            {list.length} <span className="text-base font-medium text-slate-700">Managers</span>
          </p>
          <p className="mt-2 flex gap-4 text-xs text-slate-700">
            <span><strong className="block text-sm text-emerald-700">{active}</strong>Active</span>
            <span><strong className="block text-sm text-slate-900">{inactive}</strong>Inactive</span>
            <span><strong className="block text-sm text-amber-500">{suspended}</strong>Suspended</span>
          </p>
          <div className="mt-3 h-1.5 rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-indigo-700" style={{ width: `${list.length ? (active / list.length) * 100 : 0}%` }} />
          </div>
        </Kpi>

        <Kpi label="Covered hubs" icon={<SquareParking />}>
          <p className="mt-3 font-display text-4xl font-bold text-slate-950">
            {coveredIds.size} <span className="text-base font-medium text-amber-500">of {totalLots} hubs</span>
          </p>
          <p className="mt-2 truncate text-sm text-slate-700">
            {uncovered.length ? `Uncovered: ${uncovered.map((l) => l.name).join(', ')}` : 'Every hub has an active manager.'}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-indigo-700">
            <ShieldCheck className="size-3.5" aria-hidden /> {coverage}% supervisory coverage
          </p>
        </Kpi>

        <Kpi label="Gate staff" icon={<UserCog />}>
          <p className="mt-3 font-display text-4xl font-bold text-slate-950">
            {formatNumber(gateStaff.data?.totalCount ?? 0)} <span className="text-base font-medium text-slate-700">Operators</span>
          </p>
          <p className="mt-2 text-sm text-slate-700">Gate and lane staff rostered across all hubs.</p>
        </Kpi>

        <Kpi label="Access lockouts" icon={<Gavel />}>
          <p className="mt-3 font-display text-4xl font-bold text-emerald-700">
            {suspended + (lockedStaff.data?.totalCount ?? 0)} <span className="text-base font-medium text-slate-950">Suspended</span>
          </p>
          <p className="mt-2 text-sm text-slate-700">Managers and staff who currently cannot sign in.</p>
        </Kpi>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:flex-row sm:items-center">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-500">
          <Gavel className="size-5" aria-hidden />
        </span>
        <div className="flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-950">
            Account retention policy
            <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-(--color-on-gold) uppercase">Active rule</span>
          </p>
          <p className="mt-1 text-sm text-slate-700">
            Manager and staff accounts are deactivated, never deleted, so gate logs and cash handovers stay traceable to a person.
            Reactivate an account to restore access.
          </p>
        </div>
      </section>
    </>
  )
}
