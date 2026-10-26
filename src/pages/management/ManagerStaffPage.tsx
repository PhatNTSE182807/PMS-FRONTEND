import { useState } from 'react'
import { Info, Pencil, Search, Trash2, UserCheck, UserPlus, UserX, Users } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/api/apiError'
import { Kpi, WithManagerLot } from '@/components/features/manager/ManagerBits'
import { ManagerStaffFormSheet } from '@/components/features/manager/ManagerStaffFormSheet'
import { statusOption } from '@/components/features/staff/staffLabels'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, StatusDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/form-controls'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDeleteManagedStaff, useManagedStaff, useSetManagedStaffStatus } from '@/hooks/useManagedStaff'
import { useManagerLot } from '@/hooks/useManagerLot'
import { ADMIN_TOAST, toastAdminError } from '@/lib/adminToasts'
import { formatPhone, initials } from '@/lib/format'
import { toSearchable } from '@/lib/text'
import { cn } from '@/lib/utils'
import type { UserDTO } from '@/types/identity.dto'
import type { ManagedLot } from '@/types/lot-management.dto'

type Tab = 'ALL' | 'ACTIVE' | 'LOCKED'
type PendingAction = { type: 'lock' | 'delete'; user: UserDTO }

const TABS: { value: Tab; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'LOCKED', label: 'Locked' },
]

function Staff({ lot }: { lot: ManagedLot }) {
  const { lots } = useManagerLot()
  const staff = useManagedStaff({ parkingLotId: lot.id })
  const setStatus = useSetManagedStaffStatus()
  const deleteStaff = useDeleteManagedStaff()
  const [tab, setTab] = useState<Tab>('ALL')
  const [query, setQuery] = useState('')
  const [form, setForm] = useState<{ open: boolean; user?: UserDTO }>({ open: false })
  const [pending, setPending] = useState<PendingAction | null>(null)

  const people = staff.data ?? []
  const active = people.filter((p) => p.status === 'ACTIVE')
  const locked = people.filter((p) => p.status !== 'ACTIVE')
  const count = (t: Tab) => (t === 'ALL' ? people.length : t === 'ACTIVE' ? active.length : locked.length)

  const q = toSearchable(query.trim())
  const visible = (tab === 'ALL' ? people : tab === 'ACTIVE' ? active : locked).filter(
    (p) => !q || toSearchable(`${p.fullName} ${p.employeeCode} ${p.email} ${p.phoneNumber}`).includes(q),
  )

  const confirmLock = async (user: UserDTO) => {
    const next = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    try {
      await setStatus.mutateAsync({ id: user.id, status: next })
      toast.success(ADMIN_TOAST.accountStatusUpdated)
      setPending(null)
    } catch (error) {
      toastAdminError(error, { fallback: 'Could not change the account status.' })
    }
  }

  const confirmDelete = async (user: UserDTO) => {
    try {
      await deleteStaff.mutateAsync(user.id)
      toast.success(`${user.fullName} was removed from your team`)
      setPending(null)
    } catch (error) {
      toastAdminError(error, { fallback: 'Could not remove the staff member.' })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <span className="text-amber-500">Operations console</span> / <span>Team</span>
          </>
        }
        title="Staff Directory"
        description={`${lot.name} • Gate staff working at this lot.`}
        actions={
          <Button variant="gold" onClick={() => setForm({ open: true })}>
            <UserPlus aria-hidden /> Add staff
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Team at this lot" icon={<Users />}>
          <p className="mt-3 font-display text-4xl font-bold text-slate-950">
            {people.length} <span className="text-base font-medium text-slate-700">staff</span>
          </p>
        </Kpi>
        <Kpi label="Can sign in" icon={<UserCheck />}>
          <p className="mt-3 font-display text-4xl font-bold text-emerald-600">
            {active.length} <span className="text-base font-medium text-slate-950">active</span>
          </p>
        </Kpi>
        <Kpi label="Access blocked" icon={<UserX />}>
          <p className="mt-3 font-display text-4xl font-bold text-rose-400">
            {locked.length} <span className="text-base font-medium text-slate-950">locked</span>
          </p>
        </Kpi>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-slate-950">
              <UserCheck className="size-5 text-amber-500" aria-hidden /> Staff roster
            </h2>
            <p className="text-sm text-slate-700">Add, edit, lock or move the staff of the lots you manage.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search staff…" className="pl-9 sm:w-64" aria-label="Search staff" />
            </div>
            <div role="tablist" aria-label="Status" className="flex gap-1 rounded-lg bg-slate-50 p-1 ring-1 ring-slate-200">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.value}
                  onClick={() => setTab(t.value)}
                  className={cn('rounded-md px-3 py-1.5 text-sm font-medium', tab === t.value ? 'bg-[#124e66] text-indigo-800' : 'text-slate-700 hover:bg-slate-100')}
                >
                  {t.label} ({count(t.value)})
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
            title={people.length ? 'No matching staff' : 'No staff at this lot yet'}
            description={people.length ? 'Try another name or code.' : 'Use “Add staff” to create the first gate account for this lot.'}
          />
        ) : (
          <Table aria-busy={staff.isPending}>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {['Staff member', 'Contact & email', 'Status', ''].map((h, i) => (
                  <TableHead key={i} className={i === 3 ? 'text-right' : undefined}>
                    {h || <span className="sr-only">Actions</span>}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.isPending
                ? Array.from({ length: 5 }, (_, i) => (
                    <TableRow key={i} className="hover:bg-transparent">
                      {Array.from({ length: 4 }, (__, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : visible.map((p) => {
                    const status = statusOption(p.status)
                    const isLocked = p.status !== 'ACTIVE'
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-100 text-xs font-bold text-indigo-700">
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
                          <Badge tone={status.tone}>
                            <StatusDot /> {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-0.5">
                            <Button variant="ghost" size="icon" title="Edit or move" aria-label={`Edit ${p.fullName}`} onClick={() => setForm({ open: true, user: p })}>
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title={isLocked ? 'Unlock' : 'Lock'}
                              aria-label={`${isLocked ? 'Unlock' : 'Lock'} ${p.fullName}`}
                              className={isLocked ? 'text-emerald-600 hover:text-emerald-700' : 'text-amber-600 hover:text-amber-700'}
                              onClick={() => setPending({ type: 'lock', user: p })}
                            >
                              {isLocked ? <UserCheck /> : <UserX />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Remove"
                              aria-label={`Remove ${p.fullName}`}
                              className="text-rose-600 hover:text-rose-700"
                              onClick={() => setPending({ type: 'delete', user: p })}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
            </TableBody>
          </Table>
        )}

        <p className="flex items-start gap-2 border-t border-slate-200 px-4 py-3 text-sm text-slate-700">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
          Each lot has one Manager and any number of Staff. Removing a staff member locks the account and keeps its history; lock
          an account only after its cash for the day has been counted.
        </p>
      </Card>

      <ManagerStaffFormSheet
        open={form.open}
        user={form.user}
        lots={lots.data ?? [lot]}
        defaultLotId={lot.id}
        onOpenChange={(open) => setForm((state) => ({ ...state, open }))}
      />

      {pending?.type === 'lock' && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPending(null)}
          title={pending.user.status === 'ACTIVE' ? 'Lock account?' : 'Unlock account?'}
          description={
            <>
              <strong className="text-slate-900">{pending.user.fullName}</strong>{' '}
              {pending.user.status === 'ACTIVE' ? 'will not be able to sign in until you unlock the account.' : 'will be able to sign in again right away.'}
            </>
          }
          confirmLabel={pending.user.status === 'ACTIVE' ? 'Lock' : 'Unlock'}
          tone={pending.user.status === 'ACTIVE' ? 'destructive' : 'default'}
          pending={setStatus.isPending}
          onConfirm={() => confirmLock(pending.user)}
        />
      )}

      {pending?.type === 'delete' && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPending(null)}
          title="Remove staff member?"
          description={
            <>
              <strong className="text-slate-900">{pending.user.fullName}</strong> leaves your team: the account is locked and marked as no
              longer working here. Their sessions and cash records are kept.
            </>
          }
          confirmLabel="Remove"
          tone="destructive"
          pending={deleteStaff.isPending}
          onConfirm={() => confirmDelete(pending.user)}
        />
      )}
    </div>
  )
}

/** /management/staff: the Manager's gate staff for the selected lot, with add/edit/lock/remove. */
export default function ManagerStaffPage() {
  return <WithManagerLot>{(lot) => <Staff lot={lot} />}</WithManagerLot>
}
