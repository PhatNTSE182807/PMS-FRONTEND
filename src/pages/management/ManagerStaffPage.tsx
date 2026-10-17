import { useState } from 'react'
import { Info, Search, ShieldCheck, Sun, UserCheck, UserX, Users } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { Kpi, WithManagerLot } from '@/components/features/manager/ManagerBits'
import { roleOption, shiftLabel, statusOption } from '@/components/features/staff/staffLabels'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, StatusDot } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/form-controls'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useStaffList } from '@/hooks/useStaff'
import { formatPhone, initials } from '@/lib/format'
import { toSearchable } from '@/lib/text'
import { cn } from '@/lib/utils'
import type { UserRole, WorkShift } from '@/types/identity.dto'
import type { ManagedLot } from '@/types/lot-management.dto'

type Tab = 'ALL' | UserRole

/** The shift running right now (06–14 morning, 14–22 afternoon, otherwise night). */
function currentShift(date = new Date()): WorkShift {
  const h = date.getHours()
  return h >= 6 && h < 14 ? 'MORNING' : h >= 14 && h < 22 ? 'AFTERNOON' : 'NIGHT'
}

function Staff({ lot }: { lot: ManagedLot }) {
  const staff = useStaffList({ parkingLotId: lot.id, pageNumber: 1, pageSize: 100 })
  const [tab, setTab] = useState<Tab>('ALL')
  const [query, setQuery] = useState('')

  const people = staff.data?.items ?? []
  const shift = currentShift()
  const onDuty = people.filter((p) => p.role === 'STAFF' && p.status === 'ACTIVE' && p.shift === shift)
  const leads = people.filter((p) => p.role === 'MANAGER' && p.status === 'ACTIVE')
  const blocked = people.filter((p) => p.status !== 'ACTIVE')
  const count = (t: Tab) => (t === 'ALL' ? people.length : people.filter((p) => p.role === t).length)

  const q = toSearchable(query.trim())
  const visible = people.filter(
    (p) => (tab === 'ALL' || p.role === tab) && (!q || toSearchable(`${p.fullName} ${p.employeeCode} ${p.email} ${p.phoneNumber}`).includes(q)),
  )

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <span className="text-amber-500">Operations console</span> / <span>Gate POS matrix</span>
          </>
        }
        title="Staff Directory & Gate POS Assignment"
        description={`${lot.name} • Who works the gates of this lot, and on which shift.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="On duty right now" icon={<Sun />}>
          <p className="mt-3 font-display text-4xl font-bold text-slate-950">
            {onDuty.length} <span className="text-base font-medium text-slate-700">gate operators</span>
          </p>
          <p className="mt-1 text-xs text-slate-600">{shiftLabel(shift)} shift</p>
        </Kpi>
        <Kpi label="Team at this lot" icon={<Users />}>
          <p className="mt-3 font-display text-4xl font-bold text-slate-950">
            {people.length} <span className="text-base font-medium text-slate-700">accounts</span>
          </p>
        </Kpi>
        <Kpi label="Emergency clearance" icon={<ShieldCheck />}>
          <p className="mt-3 font-display text-4xl font-bold text-amber-500">
            {leads.length} <span className="text-base font-medium text-slate-950">senior leads</span>
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-700">Managers can override the barrier.</p>
        </Kpi>
        <Kpi label="Access blocked" icon={<UserX />}>
          <p className="mt-3 font-display text-4xl font-bold text-rose-400">
            {blocked.length} <span className="text-base font-medium text-slate-950">accounts</span>
          </p>
          <p className="mt-1 text-xs text-slate-600">Deactivated or suspended.</p>
        </Kpi>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-slate-950">
              <UserCheck className="size-5 text-amber-500" aria-hidden /> Staff roster
            </h2>
            <p className="text-sm text-slate-700">Live station assignments, roles and shifts.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search staff…" className="pl-9 sm:w-64" aria-label="Search staff" />
            </div>
            <div role="tablist" aria-label="Role" className="flex gap-1 rounded-lg bg-slate-50 p-1 ring-1 ring-slate-200">
              {(['ALL', 'STAFF', 'MANAGER'] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={cn('rounded-md px-3 py-1.5 text-sm font-medium', tab === t ? 'bg-[#124e66] text-indigo-800' : 'text-slate-700 hover:bg-slate-100')}
                >
                  {t === 'ALL' ? 'All' : t === 'STAFF' ? 'Gates' : 'Managers'} ({count(t)})
                </button>
              ))}
            </div>
          </div>
        </div>

        {staff.isError ? (
          <ErrorState message={getErrorMessage(staff.error)} onRetry={() => staff.refetch()} />
        ) : !staff.isPending && visible.length === 0 ? (
          <EmptyState
            icon={Users}
            title={people.length ? 'No matching staff' : 'No staff assigned to this lot'}
            description={people.length ? 'Try another name or code.' : 'An Admin assigns gate staff and managers to each lot.'}
          />
        ) : (
          <Table aria-busy={staff.isPending}>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {['Staff member', 'Contact & email', 'Assigned role', 'Shift', 'Other lots', 'Status'].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.isPending
                ? Array.from({ length: 5 }, (_, i) => (
                    <TableRow key={i} className="hover:bg-transparent">
                      {Array.from({ length: 6 }, (__, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : visible.map((p) => {
                    const role = roleOption(p.role)
                    const status = statusOption(p.status)
                    const others = p.assignedParkingLots.filter((l) => l.id !== lot.id)
                    const working = p.role === 'STAFF' && p.status === 'ACTIVE' && p.shift === shift
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg text-xs font-bold', p.role === 'MANAGER' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700')}>
                              {initials(p.fullName)}
                            </span>
                            <div>
                              <p className="font-semibold text-slate-950">{p.fullName}</p>
                              <p className="font-mono text-xs text-slate-600">{p.employeeCode}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-slate-900">{p.email}</p>
                          <p className="font-mono text-xs text-slate-600">{formatPhone(p.phoneNumber)}</p>
                        </TableCell>
                        <TableCell>
                          <Badge tone={p.role === 'MANAGER' ? 'amber' : role.tone}>{p.role === 'MANAGER' ? 'Facility manager' : 'Gate operator'}</Badge>
                        </TableCell>
                        <TableCell>
                          {p.shift ? (
                            <span className={cn('text-sm', working ? 'font-semibold text-emerald-700' : 'text-slate-800')}>
                              {shiftLabel(p.shift)}
                              {working && ' • on duty'}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-500">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-slate-700">{others.length ? others.map((l) => l.name).join(', ') : '—'}</TableCell>
                        <TableCell>
                          <Badge tone={status.tone}>
                            <StatusDot /> {status.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
            </TableBody>
          </Table>
        )}

        <p className="flex items-start gap-2 border-t border-slate-200 px-4 py-3 text-sm text-slate-700">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
          Accounts are created, locked and reassigned by an Admin. Ask an Admin for changes after the shift's cash count is signed off.
        </p>
      </Card>
    </div>
  )
}

/** /management/staff: gate staff and managers assigned to the selected lot. */
export default function ManagerStaffPage() {
  return <WithManagerLot>{(lot) => <Staff lot={lot} />}</WithManagerLot>
}
