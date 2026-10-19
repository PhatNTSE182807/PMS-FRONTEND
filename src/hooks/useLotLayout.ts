import { useQuery } from '@tanstack/react-query'
import { layoutService } from '@/api/layout.service'
import { queryKeys } from '@/api/queryKeys'
import { planToGarageFloors } from '@/lib/lot-layout'
import type { Layout2DDetail } from '@/types/layout.dto'

/** Bay statuses reach the model within 2 s of a change (SRS NFR-3D-03); the public channel allows it. */
export const LAYOUT_STATUS_REFRESH_MS = 2_000

/** The ready-made parking models; they only change with a release. */
export function useLotTemplates() {
  return useQuery({
    queryKey: queryKeys.layout.templates(),
    queryFn: layoutService.getTemplates,
    staleTime: Infinity,
  })
}

/** Published 3D layout: it only changes when the lot is rebuilt, so it is kept for the session. */
export function useLotLayout(lotId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.layout.lot(lotId ?? ''),
    queryFn: () => layoutService.getLayout(lotId!),
    enabled: Boolean(lotId),
    staleTime: Infinity,
  })
}

export function useLotLayoutStatus(lotId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.layout.status(lotId ?? ''),
    queryFn: () => layoutService.getStatus(lotId!),
    enabled: Boolean(lotId),
    refetchInterval: LAYOUT_STATUS_REFRESH_MS,
  })
}

/** 2D fallback of the lot, already shaped as the levels the 3D model and LotPlan2D draw. */
export function useLotPlan2D(lotId: string | undefined, detail: Layout2DDetail = 'slots') {
  return useQuery({
    queryKey: queryKeys.layout.plan2D(lotId ?? '', detail),
    queryFn: () => layoutService.getPlan2D(lotId!, detail),
    enabled: Boolean(lotId),
    refetchInterval: LAYOUT_STATUS_REFRESH_MS,
    select: (plan) => ({ plan, floors: planToGarageFloors(plan) }),
  })
}
