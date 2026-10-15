import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, UserRound, X } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/form-controls'
import { Pagination } from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCustomerList } from '@/hooks/useCustomers'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { formatPhone, initials } from '@/lib/format'

const PAGE_SIZE = 10
const COLUMNS = ['Customer', 'Email', 'Phone', 'Role']

function SkeletonRows() {
  return Array.from({ length: 6 }, (_, row) => (
    <TableRow key={row} className="hover:bg-transparent">
      <TableCell>
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      </TableCell>
      <TableCell><Skeleton className="h-4 w-44" /></TableCell>
      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
      <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
    </TableRow>
  ))
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

  useEffect(() => {
    if (debouncedSearch === search) return
    setParams(debouncedSearch ? { q: debouncedSearch } : {}, { replace: true })
    // Only react to the debounced text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  const customers = useCustomerList({ search: search || undefined, pageNumber, pageSize: PAGE_SIZE })

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
        title="Customer Accounts"
        description="Driver accounts registered in the app. View only: customers manage their own profile and vehicles."
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by username, email or phone…"
              aria-label="Search customers"
              className="pl-9"
            />
          </div>
          <Button variant="ghost" onClick={clearSearch} disabled={!search && !searchInput}>
            <X />
            Clear
          </Button>
        </div>

        {customers.isError ? (
          <ErrorState message={getErrorMessage(customers.error)} onRetry={() => customers.refetch()} />
        ) : !customers.isPending && customers.data.items.length === 0 ? (
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
                  customers.data.items.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span
                            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700"
                            aria-hidden
                          >
                            {initials(customer.userName)}
                          </span>
                          <span className="font-medium text-slate-900">{customer.userName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">{customer.email}</TableCell>
                      <TableCell className="whitespace-nowrap text-slate-600">
                        {customer.phoneNumber ? formatPhone(customer.phoneNumber) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge tone="sky">Customer</Badge>
                      </TableCell>
                    </TableRow>
                  ))
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
    </div>
  )
}
