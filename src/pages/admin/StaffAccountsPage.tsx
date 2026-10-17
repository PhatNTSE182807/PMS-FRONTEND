import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, ShieldCheck, UserPlus, UserX, X } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/api/apiError'
import { StaffFormSheet } from '@/components/features/staff/StaffFormSheet'
import { StaffOverview } from '@/components/features/staff/StaffOverview'
import { ROLE_OPTIONS, STATUS_OPTIONS } from '@/components/features/staff/staffLabels'
import { StaffTable } from '@/components/features/staff/StaffTable'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CopyField } from '@/components/ui/copy-field'
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input, NativeSelect } from '@/components/ui/form-controls'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useParkingLots } from '@/hooks/useParking'
import { useResetStaffPassword, useSetStaffStatus, useStaffList } from '@/hooks/useStaff'
import type { StaffListQuery, UserDTO, UserRole, UserStatus } from '@/types/identity.dto'

const PAGE_SIZE = 10

type PendingAction = { type: 'lock' | 'reset'; user: UserDTO } | null

/** Filters are kept in the URL, so a filtered view survives reloads and can be shared. */
function useStaffFilters() {
  const [params, setParams] = useSearchParams()

  const filters = {
    search: params.get('q') ?? '',
    role: (params.get('role') as UserRole | null) ?? undefined,
    parkingLotId: params.get('lot') ?? undefined,
    status: (params.get('status') as UserStatus | null) ?? undefined,
    pageNumber: Math.max(1, Number(params.get('page')) || 1),
  }

  const update = (patch: Partial<Record<'q' | 'role' | 'lot' | 'status' | 'page', string | undefined>>) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(patch)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        // Any filter change starts again from the first page.
        if (!('page' in patch)) next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  return { filters, update, clear: () => setParams({}, { replace: true }) }
}

export default function StaffAccountsPage() {
  const { filters, update, clear } = useStaffFilters()
  const [searchInput, setSearchInput] = useState(filters.search)
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300)

  useEffect(() => {
    if (debouncedSearch !== filters.search) update({ q: debouncedSearch })
    // Only react to the debounced text; `update` and `filters` change on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const query: StaffListQuery = {
    search: filters.search || undefined,
    role: filters.role,
    parkingLotId: filters.parkingLotId,
    status: filters.status,
    pageNumber: filters.pageNumber,
    pageSize: PAGE_SIZE,
  }
  const staff = useStaffList(query)
  const parkingLots = useParkingLots()

  const [formState, setFormState] = useState<{ open: boolean; user?: UserDTO }>({ open: false })
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [temporaryPassword, setTemporaryPassword] = useState<{ user: UserDTO; password: string } | null>(null)

  const setStatus = useSetStaffStatus()
  const resetPassword = useResetStaffPassword()

  const hasFilters = Boolean(filters.search || filters.role || filters.parkingLotId || filters.status)

  const confirmLockToggle = (user: UserDTO) => {
    const nextStatus: UserStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    setStatus.mutate(
      { id: user.id, status: nextStatus },
      {
        onSuccess: (updated) => {
          toast.success(nextStatus === 'ACTIVE' ? 'Account activated' : 'Account deactivated', {
            description: `${updated.fullName} (${updated.employeeCode})`,
          })
          setPendingAction(null)
        },
        onError: (error) => toast.error('Could not update the account status', { description: getErrorMessage(error) }),
      },
    )
  }

  const confirmResetPassword = (user: UserDTO) => {
    resetPassword.mutate(user.id, {
      onSuccess: ({ temporaryPassword: password }) => {
        setPendingAction(null)
        setTemporaryPassword({ user, password })
      },
      onError: (error) => toast.error('Could not reset the password', { description: getErrorMessage(error) }),
    })
  }

  const clearFilters = () => {
    setSearchInput('')
    clear()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <span className="flex items-center gap-1.5 text-amber-500">
              <ShieldCheck className="size-4" aria-hidden /> Autonomous hub governance
            </span>
            <span aria-hidden>•</span>
            <span className="normal-case">Managers &amp; gate staff</span>
          </>
        }
        title="Facility Managers Directory & Hub Allocation"
        description="Provision, assign and audit garage facility managers and gate staff across Saigon hubs. Deactivated accounts cannot sign in."
        actions={
          <Button size="lg" onClick={() => setFormState({ open: true })}>
            <UserPlus />
            Provision new account
          </Button>
        }
      />

      <StaffOverview />

      <Card>
        {/* Filter bar */}
        <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_10rem_14rem_11rem_auto]">
          <div className="relative md:col-span-2 xl:col-span-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name, email, employee code or phone…"
              aria-label="Search staff"
              className="pl-9"
            />
          </div>
          <NativeSelect aria-label="Filter by role" value={filters.role ?? ''} onChange={(e) => update({ role: e.target.value })}>
            <option value="">All roles</option>
            {ROLE_OPTIONS.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label="Filter by parking lot" value={filters.parkingLotId ?? ''} onChange={(e) => update({ lot: e.target.value })}>
            <option value="">All parking lots</option>
            {parkingLots.data?.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label="Filter by status" value={filters.status ?? ''} onChange={(e) => update({ status: e.target.value })}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </NativeSelect>
          <Button variant="ghost" onClick={clearFilters} disabled={!hasFilters && !searchInput}>
            <X />
            Clear
          </Button>
        </div>

        {staff.isError ? (
          <ErrorState message={getErrorMessage(staff.error)} onRetry={() => staff.refetch()} />
        ) : !staff.isPending && staff.data.items.length === 0 ? (
          <EmptyState
            icon={UserX}
            title={hasFilters ? 'No matching staff accounts' : 'No staff accounts yet'}
            description={
              hasFilters
                ? 'Try another search term or remove some filters.'
                : 'Create the first account for a parking lot Manager or gate Staff.'
            }
            action={
              hasFilters ? (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button onClick={() => setFormState({ open: true })}>
                  <Plus />
                  New staff account
                </Button>
              )
            }
          />
        ) : (
          <>
            <StaffTable
              users={staff.data?.items ?? []}
              isLoading={staff.isPending}
              onEdit={(user) => setFormState({ open: true, user })}
              onToggleLock={(user) => setPendingAction({ type: 'lock', user })}
              onResetPassword={(user) => setPendingAction({ type: 'reset', user })}
            />
            {staff.data && (
              <Pagination
                className="border-t border-slate-200 px-4 py-3"
                pageNumber={staff.data.pageNumber}
                pageSize={staff.data.pageSize}
                totalCount={staff.data.totalCount}
                totalPages={staff.data.totalPages}
                onPageChange={(page) => update({ page: String(page) })}
              />
            )}
          </>
        )}
      </Card>

      <StaffFormSheet
        open={formState.open}
        user={formState.user}
        parkingLots={parkingLots.data ?? []}
        onOpenChange={(open) => setFormState((state) => ({ ...state, open }))}
      />

      {pendingAction?.type === 'lock' && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingAction(null)}
          title={pendingAction.user.status === 'ACTIVE' ? 'Deactivate account?' : 'Activate account?'}
          description={
            pendingAction.user.status === 'ACTIVE' ? (
              <>
                <strong className="text-slate-900">{pendingAction.user.fullName}</strong> will not be able to sign in until the account is
                activated again.
              </>
            ) : (
              <>
                <strong className="text-slate-900">{pendingAction.user.fullName}</strong> will be able to sign in again right away.
              </>
            )
          }
          confirmLabel={pendingAction.user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
          tone={pendingAction.user.status === 'ACTIVE' ? 'destructive' : 'default'}
          pending={setStatus.isPending}
          onConfirm={() => confirmLockToggle(pendingAction.user)}
        />
      )}

      {pendingAction?.type === 'reset' && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingAction(null)}
          title="Reset password?"
          description={
            <>
              The current password of <strong className="text-slate-900">{pendingAction.user.fullName}</strong> will stop working and be
              replaced with a temporary password.
            </>
          }
          confirmLabel="Reset password"
          pending={resetPassword.isPending}
          onConfirm={() => confirmResetPassword(pendingAction.user)}
        />
      )}

      <Dialog open={temporaryPassword !== null} onOpenChange={(open) => !open && setTemporaryPassword(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Temporary password</DialogTitle>
            <DialogDescription>
              Send this password to {temporaryPassword?.user.fullName} through a secure channel. They should change it the first time they
              sign in. It will not be shown again.
            </DialogDescription>
          </DialogHeader>
          {temporaryPassword && <CopyField value={temporaryPassword.password} label="temporary password" />}
          <DialogFooter>
            <Button onClick={() => setTemporaryPassword(null)}>I've saved the password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
