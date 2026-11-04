import { useMemo, useState } from 'react'
import { getErrorMessage } from '@/api/apiError'
import { PaymentMethodChart } from '@/components/features/revenue/PaymentMethodChart'
import { RevenueBreakdownTable } from '@/components/features/revenue/RevenueBreakdownTable'
import { RevenueByLotChart } from '@/components/features/revenue/RevenueByLotChart'
import { RevenueFilterBar, type RevenueFilterState } from '@/components/features/revenue/RevenueFilterBar'
import { presetRange } from '@/components/features/revenue/revenueFilters'
import { exportRevenueCsv, periodLotRows } from '@/components/features/revenue/revenueRows'
import { RevenueKpiCards } from '@/components/features/revenue/RevenueKpiCards'
import { RevenueTrendChart } from '@/components/features/revenue/RevenueTrendChart'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/states'
import { useParkingLots } from '@/hooks/useParking'
import { useAdminRevenue, useAdminRevenueTimeSeries } from '@/hooks/useRevenueReport'
import { previousRange } from '@/lib/revenuePeriods'
import type { AdminRevenueQuery } from '@/types/report.dto'

const BREAKDOWN_PAGE_SIZE = 10

/** /admin/revenue: settled revenue of every lot, or one lot, over a date range (GET /admin/reports/revenue). */
export default function RevenueReportPage() {
  const [filters, setFilters] = useState<RevenueFilterState>(() => ({ preset: 'thisMonth', ...presetRange('thisMonth'), vehicleType: 'ALL' }))
  const [breakdownPage, setBreakdownPage] = useState(1)

  const { startDate, endDate, parkingLotId, vehicleType } = filters
  const query: AdminRevenueQuery = { startDate, endDate, parkingLotId, vehicleType }
  const lotSelected = Boolean(parkingLotId)

  const parkingLots = useParkingLots()
  const report = useAdminRevenue(query)
  const previous = useAdminRevenue({ ...previousRange(query), parkingLotId, vehicleType })
  // Every lot in the same period: the same request as `report` when no lot is picked.
  const network = useAdminRevenue({ startDate, endDate, vehicleType })
  const timeSeries = useAdminRevenueTimeSeries(query)
  const rows = useMemo(() => (timeSeries.data ? periodLotRows(timeSeries.data.points) : undefined), [timeSeries.data])

  const firstError = report.error ?? timeSeries.error

  const handleFiltersChange = (next: RevenueFilterState) => {
    setFilters(next)
    setBreakdownPage(1)
  }

  const handleExport = () => {
    if (rows) exportRevenueCsv(rows, `revenue-report_${startDate}_${endDate}.csv`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue Report"
        description="Settled parking revenue over time, by parking lot, vehicle type and payment method."
      />

      <RevenueFilterBar
        value={filters}
        onChange={handleFiltersChange}
        parkingLots={parkingLots.data ?? []}
        onExport={handleExport}
        canExport={Boolean(rows?.length)}
      />

      {firstError ? (
        <Card>
          <ErrorState
            message={getErrorMessage(firstError)}
            onRetry={() => {
              if (report.isError) void report.refetch()
              if (timeSeries.isError) void timeSeries.refetch()
            }}
          />
        </Card>
      ) : (
        <>
          <RevenueKpiCards
            report={report.data}
            previous={previous.isError ? null : previous.data}
            network={network.isError ? null : network.data}
            lotSelected={lotSelected}
            isLoading={report.isPending}
          />

          <div className="grid gap-6 lg:grid-cols-3">
            <RevenueTrendChart data={timeSeries.data} isLoading={timeSeries.isPending} canCompare={!vehicleType || vehicleType === 'ALL'} />
            <PaymentMethodChart data={report.data?.paymentMethods} isLoading={report.isPending} />
          </div>

          {!lotSelected && <RevenueByLotChart data={report.data?.byLot} isLoading={report.isPending} />}

          <RevenueBreakdownTable
            rows={rows}
            granularity={timeSeries.data?.granularity ?? 'DAY'}
            isLoading={timeSeries.isPending}
            pageNumber={breakdownPage}
            pageSize={BREAKDOWN_PAGE_SIZE}
            onPageChange={setBreakdownPage}
          />
        </>
      )}
    </div>
  )
}
