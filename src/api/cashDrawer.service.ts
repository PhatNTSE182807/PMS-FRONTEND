import type { CashDrawerDTO, CashTopUpDTO } from '@/types/cashDrawer.dto'
import { http } from './axiosClient'

/** Daily cash close: the Staff's drawer of the day, and the Manager's confirmation. Always the real API. */
export const cashDrawerService = {
  /** GET /staff/lots/{lotId}/cash-drawer: the signed-in Staff's drawer of today (status NotOpened when none). */
  current(lotId: string): Promise<CashDrawerDTO> {
    return http.get<CashDrawerDTO>(`/staff/lots/${lotId}/cash-drawer`)
  },

  /** Opens the drawer with the float (VND) the Staff starts with. */
  open(lotId: string, float: number): Promise<CashDrawerDTO> {
    return http.post<CashDrawerDTO>(`/staff/lots/${lotId}/cash-drawer/open`, { float })
  },

  /** Hands the drawer in with the cash total the system kept (nothing is counted); the next drawer opens at once. */
  close(lotId: string): Promise<CashDrawerDTO> {
    return http.post<CashDrawerDTO>(`/staff/lots/${lotId}/cash-drawer/close`)
  },

  /** Manager: closed drawers of the lot waiting for confirmation (or one status). */
  forLot(lotId: string, status?: string): Promise<CashDrawerDTO[]> {
    return http.get<CashDrawerDTO[]>(`/manager/lots/${lotId}/cash-closes`, { params: status ? { status } : undefined })
  },

  /** Manager: confirms a Staff's handed-in drawer (never one's own); an older close with a difference needs a note. */
  confirm(id: number, note?: string): Promise<CashDrawerDTO> {
    return http.post<CashDrawerDTO>(`/manager/cash-closes/${id}/confirm`, { note: note || undefined })
  },

  /** Staff: asks the lot's Manager for an amount of cash to add to the open drawer (one waiting request at a time). */
  requestTopUp(lotId: string, amount: number, reason?: string): Promise<CashTopUpDTO> {
    return http.post<CashTopUpDTO>(`/staff/lots/${lotId}/cash-drawer/top-ups`, { amount, reason: reason || undefined })
  },

  /** Staff: withdraws their request before the Manager decides. */
  cancelTopUp(lotId: string, id: number): Promise<CashTopUpDTO> {
    return http.post<CashTopUpDTO>(`/staff/lots/${lotId}/cash-drawer/top-ups/${id}/cancel`)
  },

  /** Manager: the lot's requests for more cash, waiting ones by default. */
  topUpsForLot(lotId: string, status?: string): Promise<CashTopUpDTO[]> {
    return http.get<CashTopUpDTO[]>(`/manager/lots/${lotId}/cash-top-ups`, { params: status ? { status } : undefined })
  },

  /** Manager: approves; the amount counts as cash put into the Staff's drawer. */
  approveTopUp(id: number, note?: string): Promise<CashTopUpDTO> {
    return http.post<CashTopUpDTO>(`/manager/cash-top-ups/${id}/approve`, { note: note || undefined })
  },

  /** Manager: rejects with a reason the Staff sees. */
  rejectTopUp(id: number, note: string): Promise<CashTopUpDTO> {
    return http.post<CashTopUpDTO>(`/manager/cash-top-ups/${id}/reject`, { note })
  },
}
