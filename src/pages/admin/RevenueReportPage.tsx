import { useState } from 'react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/api/apiError'
import { PaymentMethodChart } from '@/components/features/revenue/PaymentMethodChart'
import { RevenueBreakdownTable } from '@/components/features/revenue/RevenueBreakdownTable'
import { RevenueByLotChart } from '@/components/features/revenue/RevenueByLotChart'
import { RevenueFilterBar, type RevenueFilterState } from '@/components/features/revenue/RevenueFilterBar'
import { presetRange } from '@/components/features/revenue/revenueFilters'
import { RevenueKpiCards } from '@/components/features/revenue/RevenueKpiCards'
import { RevenueTrendChart } from '@/components/features/revenue/RevenueTrendChart'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/states'
import { useParkingLots } from '@/hooks/useParking'
import {
  usePaymentMethodBreakdown,
  useRevenueBreakdown,
  useRevenueByParkingLot,
  useRevenueKpi,
  useRevenueTimeSeries,
} from '@/hooks/useRevenueReport'
import type { RevenueFilterQuery } from '@/types/report.dto'

const BREAKDOWN_PAGE_SIZE = 10

export default function RevenueReportPage() {
  const [filters, setFilters] = useState<RevenueFilterState>(() => ({
    preset: 'thisMonth',
    ...presetRange('thisMonth'),
    vehicleType: 'ALL',
  }))
  const [breakdownPage, setBreakdownPage] = useState(1)

  const query: RevenueFilterQuery = {
    startDate: filters.startDate,
    endDate: filters.endDate,
    parkingLotId: filters.parkingLotId,
    vehicleType: filters.vehicleType,
  }
  const allLots = !filters.parkingLotId

  const parkingLots = useParkingLots()
  const kpi = useRevenueKpi(query)
  const timeSeries = useRevenueTimeSeries(query)
  const paymentMethods = usePaymentMethodBreakdown(query)
  const byLot = useRevenueByParkingLot(query, allLots)
  const breakdown = useRevenueBreakdown({ ...query, pageNumber: breakdownPage, pageSize: BREAKDOWN_PAGE_SIZE })

  const firstError = [kpi, timeSeries, paymentMethods, byLot, breakdown].find((q) => q.isError)?.error

  const handleFiltersChange = (next: RevenueFilterState) => {
    setFilters(next)
    setBreakdownPage(1)
  }

  const handleExport = (format: 'excel' | 'pdf') => {
    // TODO: call the Report service export endpoint once it exists; for now this is a mock.
    const fileName = `revenue-report_${filters.startDate}_${filters.endDate}.${format === 'excel' ? 'xlsx' : 'pdf'}`
    toast.promise(new Promise((resolve) => setTimeout(resolve, 1200)), {
      loading: `Exporting ${format === 'excel' ? 'Excel' : 'PDF'} report…`,
      success: `Exported ${fileName}`,
      error: 'Export failed',
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue Report"
        description="Track cash flow and business performance over time, by parking lot and vehicle type."
      />

      <RevenueFilterBar
        value={filters}
        onChange={handleFiltersChange}
        parkingLots={parkingLots.data ?? []}
        onExport={handleExport}
      />

      {firstError ? (
        <Card>
          <ErrorState
            message={getErrorMessage(firstError)}
            onRetry={() => [kpi, timeSeries, paymentMethods, byLot, breakdown].forEach((q) => q.isError && q.refetch())}
          />
        </Card>
      ) : (
        <>
          <RevenueKpiCards data={kpi.data} isLoading={kpi.isPending} />

          <div className="grid gap-6 lg:grid-cols-3">
            <RevenueTrendChart data={timeSeries.data} isLoading={timeSeries.isPending} />
            <PaymentMethodChart data={paymentMethods.data} isLoading={paymentMethods.isPending} />
          </div>

          {allLots && <RevenueByLotChart data={byLot.data} isLoading={byLot.isPending} />}

          <RevenueBreakdownTable data={breakdown.data} isLoading={breakdown.isPending} onPageChange={setBreakdownPage} />
        </>
      )}
    </div>
  )
}
