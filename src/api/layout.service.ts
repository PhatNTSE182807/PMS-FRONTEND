import { isMockService, SERVICE_PATHS } from '@/config/env'
import { layoutMock } from '@/mocks/layout.mock'
import type { Layout2DDetail, LotLayoutDTO, LotLayoutStatusDTO, LotPlan2DDTO, LotTemplateDTO } from '@/types/layout.dto'
import { http } from './axiosClient'

const lotPath = (lotId: string) => `${SERVICE_PATHS.parking}/public/lots/${lotId}/layout`

/**
 * Layout service: the 3D layout of a lot, live bay statuses and the 2D fallback (PMS.API
 * LayoutsController). Public and rate limited; it never returns plates.
 */
export const layoutService = {
  /** Ready-made parking models an Admin picks from when registering a lot. */
  getTemplates(): Promise<LotTemplateDTO[]> {
    if (isMockService('parking')) return layoutMock.templates()
    return http.get<LotTemplateDTO[]>(`${SERVICE_PATHS.parking}/lot-templates`)
  },

  getLayout(lotId: string): Promise<LotLayoutDTO> {
    if (isMockService('parking')) return layoutMock.layout(lotId)
    return http.get<LotLayoutDTO>(lotPath(lotId))
  },

  getStatus(lotId: string): Promise<LotLayoutStatusDTO> {
    if (isMockService('parking')) return layoutMock.status(lotId)
    return http.get<LotLayoutStatusDTO>(`${lotPath(lotId)}/status`)
  },

  getPlan2D(lotId: string, detail: Layout2DDetail = 'slots'): Promise<LotPlan2DDTO> {
    if (isMockService('parking')) return layoutMock.plan2D(lotId, detail)
    return http.get<LotPlan2DDTO>(`${lotPath(lotId)}/2d`, { params: { detail } })
  },
}
