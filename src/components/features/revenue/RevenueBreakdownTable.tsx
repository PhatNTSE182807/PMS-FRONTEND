import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Pagination } from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/states'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatNumber, formatVnd } from '@/lib/format'
import type { PaginatedResponse } from '@/types/common.dto'
import type { RevenueBreakdownRowDTO } from '@/types/report.dto'

const NUMERIC = 'text-right tabular-nums'

interface RevenueBreakdownTableProps {
  data?: PaginatedResponse<RevenueBreakdownRowDTO>
  isLoading: boolean
  onPageChange: (page: number) => void
}

/** Detailed rows per day and lot — also the accessible table view of the charts above. */
export function RevenueBreakdownTable({ data, isLoading, onPageChange }: RevenueBreakdownTableProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div>
          <CardTitle>Chi tiết doanh thu theo ngày / bãi</CardTitle>
          <CardDescription>Mới nhất trước. Hôm nay tính tới thời điểm hiện tại.</CardDescription>
        </div>
      </CardHeader>

      {!isLoading && data?.totalCount === 0 ? (
        <EmptyState title="Không có dữ liệu" description="Không có giao dịch nào khớp bộ lọc." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Ngày</TableHead>
                <TableHead>Bãi xe</TableHead>
                <TableHead className={NUMERIC}>Lượt xe máy</TableHead>
                <TableHead className={NUMERIC}>Lượt ô tô</TableHead>
                <TableHead className={NUMERIC}>DT vé lượt</TableHead>
                <TableHead className={NUMERIC}>DT vé tháng</TableHead>
                <TableHead className={NUMERIC}>Tổng cộng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || !data
                ? Array.from({ length: 8 }, (_, i) => (
                    <TableRow key={i} className="hover:bg-transparent">
                      {Array.from({ length: 7 }, (_, j) => (
                        <TableCell key={j}>
                          <Skeleton className={j < 2 ? 'h-4 w-28' : 'ml-auto h-4 w-20'} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : data.items.map((row) => (
                    <TableRow key={`${row.date}-${row.parkingLotId}`}>
                      <TableCell className="whitespace-nowrap">{formatDate(row.date)}</TableCell>
                      <TableCell className="whitespace-nowrap text-slate-900">{row.parkingLotName}</TableCell>
                      <TableCell className={NUMERIC}>{formatNumber(row.motorbikeCount)}</TableCell>
                      <TableCell className={NUMERIC}>{formatNumber(row.carCount)}</TableCell>
                      <TableCell className={NUMERIC}>{formatVnd(row.walkInRevenue)}</TableCell>
                      <TableCell className={NUMERIC}>{formatVnd(row.subscriptionRevenue)}</TableCell>
                      <TableCell className={`${NUMERIC} font-semibold text-slate-900`}>{formatVnd(row.totalRevenue)}</TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
          {data && (
            <Pagination
              className="border-t border-slate-200 px-4 py-3"
              pageNumber={data.pageNumber}
              pageSize={data.pageSize}
              totalCount={data.totalCount}
              totalPages={data.totalPages}
              onPageChange={onPageChange}
            />
          )}
        </>
      )}
    </Card>
  )
}
