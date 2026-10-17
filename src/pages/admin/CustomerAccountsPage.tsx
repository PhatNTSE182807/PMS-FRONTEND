import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BadgeCheck, Download, Mail, Phone, Search, ShieldCheck, UserRound, UserSearch, X } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/form-controls'
import { Pagination } from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCustomerList } from '@/hooks/useCustomers'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { formatNumber, formatPhone, initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CustomerAccountDTO } from '@/types/identity.dto'

const PAGE_SIZE = 10
const COLUMNS = ['User profile', 'Username', 'Account status']
const AVATAR_TONES = ['bg-indigo-100 text-indigo-700', 'bg-amber-100 text-amber-700', 'bg-slate-100 text-slate-900']

const displayName = (c: CustomerAccountDTO) => c.fullName || c.userName

function SkeletonRows() {
  return Array.from({ length: 6 }, (_, row) => (
    <TableRow key={row} className="hover:bg-transparent">
      <TableCell>
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
      </TableCell>
      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
    </TableRow>
  ))
}

/** Downloads the listed accounts as CSV (opens in Excel). */
function exportAccounts(rows: CustomerAccountDTO[]) {
  const quote = (v: string) => `"${v.replace(/"/g, '""')}"`
  const lines = rows.map((c) => [displayName(c), c.userName, c.email, c.phoneNumber ?? '', c.isActive === false ? 'Inactive' : 'Active'].map(quote).join(','))
  const blob = new Blob(['﻿' + ['Name,Username,Email,Phone,Status', ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `user-accounts-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function AccountDetails({ customer }: { customer: CustomerAccountDTO | undefined }) {
  const active = customer?.isActive !== false
  return (
    <Card className="p-5 lg:sticky lg:top-24">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold tracking-wider text-slate-950 uppercase">
          <UserSearch className="size-4 text-amber-500" aria-hidden /> User account details
        </h2>
        {customer && (
          <span className={cn('rounded-md px-2.5 py-1 text-xs font-bold tracking-wide uppercase', active ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700')}>
            {active ? 'Active' : 'Inactive'}
          </span>
        )}
      </div>

      {!customer ? (
        <p className="mt-6 text-sm text-slate-600">Select an account to see its details.</p>
      ) : (
        <>
          <div className="mt-5 flex items-center gap-4 rounded-xl bg-slate-50 p-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-[#124e66] font-display text-xl font-bold text-indigo-800">
              {initials(displayName(customer))}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-950">{displayName(customer)}</p>
              <p className="truncate text-sm text-slate-700">{customer.email}</p>
              <p className="font-mono text-xs text-slate-600">{customer.phoneNumber ? formatPhone(customer.phoneNumber) : '—'}</p>
            </div>
          </div>

          <h3 className="mt-6 text-xs font-bold tracking-[0.1em] text-slate-700 uppercase">Account overview</h3>
          <dl className="mt-2 divide-y divide-slate-200 rounded-xl bg-slate-50 px-4 text-sm">
            {[
              ['Membership type', <span key="m" className="font-semibold text-amber-500">Driver</span>],
              ['Username', <span key="u" className="font-mono text-slate-900">{customer.userName}</span>],
              ['Email', <span key="e" className="truncate text-slate-900">{customer.email}</span>],
              ['Sign-in access', <span key="s" className={active ? 'text-indigo-700' : 'text-rose-700'}>{active ? 'Allowed' : 'Blocked'}</span>],
            ].map(([label, value]) => (
              <div key={label as string} className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-slate-800">{label}</dt>
                <dd className="min-w-0 text-right">{value}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-5 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-indigo-700" aria-hidden />
            Read-only profile: drivers manage their own details and vehicles from the app.
          </p>
        </>
      )}
    </Card>
  )
}

/**
 * Read-only list of customer (driver) accounts. Customers manage their own profile, so the
 * admin can look them up here but cannot change or deactivate them.
 */
export default function CustomerAccountsPage() {
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const pageNumber = Math.max(1, Number(params.get('page')) || 1)

  const [searchInput, setSearchInput] = useState(search)
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300)
  const [selectedId, setSelectedId] = useState<string>()

  useEffect(() => {
    if (debouncedSearch === search) return
    setParams(debouncedSearch ? { q: debouncedSearch } : {}, { replace: true })
    // Only react to the debounced text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const customers = useCustomerList({ search: search || undefined, pageNumber, pageSize: PAGE_SIZE })
  const items = customers.data?.items ?? []
  const selected = items.find((c) => c.id === selectedId) ?? items[0]

  const clearSearch = () => {
    setSearchInput('')
    setParams({}, { replace: true })
  }

  const goToPage = (page: number) =>
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.set('page', String(page))
      return next
    })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <span className="text-indigo-700">XXIV Parking</span>
            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] tracking-normal">ADMINISTRATION</span>
          </>
        }
        title="User Accounts Directory"
        description="Look up registered drivers and their contact details. View only: customers manage their own profile and vehicles."
        actions={
          <Button variant="outline" size="lg" onClick={() => exportAccounts(items)} disabled={!items.length}>
            <Download />
            Export page (CSV)
          </Button>
        }
      />

      <Card className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by username, email or phone number…"
            aria-label="Search customers"
            className="h-10 pl-9"
          />
        </div>
        <span className="rounded-lg bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-950 ring-1 ring-slate-200">
          All accounts ({formatNumber(customers.data?.totalCount ?? 0)})
        </span>
        <Button variant="ghost" onClick={clearSearch} disabled={!search && !searchInput}>
          <X />
          Clear
        </Button>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          {customers.isError ? (
            <ErrorState message={getErrorMessage(customers.error)} onRetry={() => customers.refetch()} />
          ) : !customers.isPending && items.length === 0 ? (
            <EmptyState
              icon={UserRound}
              title={search ? 'No matching customers' : 'No customer accounts yet'}
              description={search ? 'Try another username, email or phone number.' : 'Accounts appear here once drivers register.'}
              action={
                search ? (
                  <Button variant="outline" onClick={clearSearch}>
                    Clear search
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <Table aria-busy={customers.isPending}>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {COLUMNS.map((column) => (
                      <TableHead key={column}>{column}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.isPending ? (
                    <SkeletonRows />
                  ) : (
                    items.map((customer, index) => {
                      const isSelected = customer.id === selected?.id
                      const active = customer.isActive !== false
                      return (
                        <TableRow
                          key={customer.id}
                          aria-selected={isSelected}
                          tabIndex={0}
                          onClick={() => setSelectedId(customer.id)}
                          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSelectedId(customer.id))}
                          className={cn('cursor-pointer', isSelected && 'bg-slate-100 hover:bg-slate-100')}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <span
                                className={cn('flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold', AVATAR_TONES[index % AVATAR_TONES.length])}
                                aria-hidden
                              >
                                {initials(displayName(customer))}
                              </span>
                              <div className="min-w-0">
                                <p className="flex items-center gap-1.5 font-semibold text-slate-950">
                                  {displayName(customer)}
                                  {active && <BadgeCheck className="size-4 text-amber-500" aria-label="Active account" />}
                                </p>
                                <p className="flex items-center gap-1 truncate text-sm text-slate-700">
                                  <Mail className="size-3 shrink-0" aria-hidden /> {customer.email}
                                </p>
                                <p className="flex items-center gap-1 font-mono text-xs text-slate-600">
                                  <Phone className="size-3 shrink-0" aria-hidden />
                                  {customer.phoneNumber ? formatPhone(customer.phoneNumber) : '—'}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm text-slate-800">{customer.userName}</TableCell>
                          <TableCell>
                            <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700')}>
                              {active ? 'Active' : 'Inactive'}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
              {customers.data && (
                <Pagination
                  className="border-t border-slate-200 px-4 py-3"
                  pageNumber={customers.data.pageNumber}
                  pageSize={customers.data.pageSize}
                  totalCount={customers.data.totalCount}
                  totalPages={customers.data.totalPages}
                  onPageChange={goToPage}
                />
              )}
            </>
          )}
        </Card>

        <AccountDetails customer={selected} />
      </div>
    </div>
  )
}
