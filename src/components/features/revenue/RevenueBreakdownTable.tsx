import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Pagination } from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/states'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatNumber, formatVnd } from '@/lib/format'
import { formatPeriod, type RevenueGranularity } from '@/lib/revenuePeriods'
import type { RevenuePeriodLotRow } from './revenueRows'

const NUMERIC = 'text-right tabular-nums'
const STEP_NAMES: Record<RevenueGranularity, string> = { DAY: 'day', WEEK: 'week', MONTH: 'month', YEAR: 'year' }

interface RevenueBreakdownTableProps {
  rows?: RevenuePeriodLotRow[]
  granularity: RevenueGranularity
  isLoading: boolean
  pageNumber: number
  pageSize: number
  onPageChange: (page: number) => void
}

/** One row per period and lot — also the accessible table view of the charts above. */
export function RevenueBreakdownTable({ rows, granularity, isLoading, pageNumber, pageSize, onPageChange }: RevenueBreakdownTableProps) {
  const totalCount = rows?.length ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const page = Math.min(Math.max(1, pageNumber), totalPages)
  const items = rows?.slice((page - 1) * pageSize, page * pageSize) ?? []

  return (
    <Card>
      <CardHeader className="pb-4">
        <div>
          <CardTitle>Revenue by {STEP_NAMES[granularity]} and lot</CardTitle>
          <CardDescription>Newest first; lots without settled sessions are left out. Today is counted up to now.</CardDescription>
        </div>
      </CardHeader>

      {!isLoading && rows?.length === 0 ? (
        <EmptyState title="No data" description="No settled parking sessions match the filters." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Period</TableHead>
                <TableHead>Parking lot</TableHead>
                <TableHead className={NUMERIC}>Car sessions</TableHead>
                <TableHead className={NUMERIC}>Motorbike sessions</TableHead>
                <TableHead className={NUMERIC}>Average per session</TableHead>
                <TableHead className={NUMERIC}>Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || !rows
                ? Array.from({ length: 8 }, (_, i) => (
                    <TableRow key={i} className="hover:bg-transparent">
                      {Array.from({ length: 6 }, (_, j) => (
                        <TableCell key={j}>
                          <Skeleton className={j < 2 ? 'h-4 w-28' : 'ml-auto h-4 w-20'} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : items.map((row) => (
                    <TableRow key={`${row.startDate}-${row.parkingLotId}`}>
                      <TableCell className="whitespace-nowrap">{formatPeriod(row)}</TableCell>
                      <TableCell className="whitespace-nowrap text-slate-900">{row.parkingLotName}</TableCell>
                      <TableCell className={NUMERIC}>{formatNumber(row.carSessions)}</TableCell>
                      <TableCell className={NUMERIC}>{formatNumber(row.motorbikeSessions)}</TableCell>
                      <TableCell className={NUMERIC}>
                        {row.totalSessions > 0 ? formatVnd(Math.round(row.totalRevenue / row.totalSessions)) : '—'}
                      </TableCell>
                      <TableCell className={`${NUMERIC} font-semibold text-slate-900`}>{formatVnd(row.totalRevenue)}</TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
          {rows && (
            <Pagination
              className="border-t border-slate-200 px-4 py-3"
              pageNumber={page}
              pageSize={pageSize}
              totalCount={totalCount}
              totalPages={totalPages}
              onPageChange={onPageChange}
            />
          )}
        </>
      )}
    </Card>
  )
}
