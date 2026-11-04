import { isMockService } from '@/config/env'
import { pricingMock } from '@/mocks/pricing.mock'
import type {
  PublicLotPriceDTO,
  PricingRuleDTO,
  PricingRuleInput,
  PricingRuleStatus,
  PricingSimulationRequest,
  PricingSimulationResult,
} from '@/types/pricing.dto'
import { http } from './axiosClient'

/** Pricing rules of a lot share the lot store: demo sessions and VITE_MOCK_SERVICES=parking use mock data. */
const mocked = () => isMockService('parking')
const base = (lotId: string) => `/manager/lots/${lotId}/pricing-rules`

/** Body for create / update: the API binds TimeOnly from "HH:mm:ss" and needs every field it validates. */
function body(input: PricingRuleInput) {
  return {
    ...input,
    dayStartTime: input.chargeModel === 'DayNight' ? input.dayStartTime : null,
    nightStartTime: input.chargeModel === 'DayNight' ? input.nightStartTime : null,
    dayPrice: input.chargeModel === 'DayNight' ? input.dayPrice : null,
    nightPrice: input.chargeModel === 'DayNight' ? input.nightPrice : null,
  }
}

/** Manager pricing rules (PMS.API ManagerPricingController). Managers see only their own lots. */
export const pricingService = {
  /** The lot's rules that are not archived. */
  list(lotId: string): Promise<PricingRuleDTO[]> {
    if (mocked()) return pricingMock.list(lotId)
    return http
      .get<PricingRuleDTO[]>(base(lotId))
      .then((rules) => rules.filter((r) => r.status !== 'Archived'))
  },

  create(lotId: string, input: PricingRuleInput): Promise<PricingRuleDTO> {
    return mocked() ? pricingMock.create(lotId, input) : http.post<PricingRuleDTO>(base(lotId), body(input))
  },

  /** Every update makes a new version; the API records the old values in the pricing history. */
  update(lotId: string, id: number, input: PricingRuleInput): Promise<PricingRuleDTO> {
    return mocked() ? pricingMock.update(lotId, id, input) : http.put<PricingRuleDTO>(`${base(lotId)}/${id}`, body(input))
  },

  setStatus(lotId: string, id: number, status: PricingRuleStatus, reason?: string): Promise<PricingRuleDTO> {
    if (mocked()) return pricingMock.setStatus(lotId, id, status)
    return http.patch<PricingRuleDTO>(`${base(lotId)}/${id}/status`, { status, reason })
  },

  /** Archives the rule (pricing history is never deleted). */
  remove(lotId: string, id: number): Promise<unknown> {
    return mocked() ? pricingMock.remove(lotId, id) : http.delete(`${base(lotId)}/${id}`)
  },

  /** Public prices of a lot for customers (anonymous, rate limited): what the gates charge now per vehicle type. */
  publicPrices(lotId: string): Promise<PublicLotPriceDTO[]> {
    return mocked() ? pricingMock.publicPrices(lotId) : http.get<PublicLotPriceDTO[]>(`/public/lots/${lotId}/prices`)
  },

  /** What the gate would charge for one stay: with ruleId one rule, otherwise the lot's active rule. */
  simulate(lotId: string, request: PricingSimulationRequest): Promise<PricingSimulationResult> {
    return mocked() ? pricingMock.simulate(lotId, request) : http.post<PricingSimulationResult>(`${base(lotId)}/simulate`, request)
  },
}
