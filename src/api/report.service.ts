import { isMockService, SERVICE_PATHS } from '@/config/env'
import { revenueMock } from '@/mocks/revenue.mock'
import type { PaginatedResponse } from '@/types/common.dto'
import type {
  PaymentMethodBreakdownDTO,
  RevenueBreakdownQuery,
  RevenueBreakdownRowDTO,
  RevenueByParkingLotDTO,
  RevenueFilterQuery,
  RevenueKpiSummaryDTO,
  RevenueTimeSeriesResultDTO,
} from '@/types/report.dto'
import { http } from './axiosClient'

const base = `${SERVICE_PATHS.reports}/revenue`
const mocked = () => isMockService('reports')

/** Report service: read-only revenue aggregations (a CQRS read model after the split). */
export const reportService = {
  getKpiSummary(query: RevenueFilterQuery): Promise<RevenueKpiSummaryDTO> {
    return mocked() ? revenueMock.getKpiSummary(query) : http.get<RevenueKpiSummaryDTO>(`${base}/kpi`, { params: query })
  },

  getTimeSeries(query: RevenueFilterQuery): Promise<RevenueTimeSeriesResultDTO> {
    return mocked()
      ? revenueMock.getTimeSeries(query)
      : http.get<RevenueTimeSeriesResultDTO>(`${base}/timeseries`, { params: query })
  },

  getPaymentMethods(query: RevenueFilterQuery): Promise<PaymentMethodBreakdownDTO[]> {
    return mocked()
      ? revenueMock.getPaymentMethods(query)
      : http.get<PaymentMethodBreakdownDTO[]>(`${base}/payment-methods`, { params: query })
  },

  getRevenueByParkingLot(query: RevenueFilterQuery): Promise<RevenueByParkingLotDTO[]> {
    return mocked()
      ? revenueMock.getRevenueByParkingLot(query)
      : http.get<RevenueByParkingLotDTO[]>(`${base}/by-lot`, { params: query })
  },

  getBreakdown(query: RevenueBreakdownQuery): Promise<PaginatedResponse<RevenueBreakdownRowDTO>> {
    return mocked()
      ? revenueMock.getBreakdown(query)
      : http.get<PaginatedResponse<RevenueBreakdownRowDTO>>(`${base}/breakdown`, { params: query })
  },
}
