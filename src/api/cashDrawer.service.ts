import type { BanknoteCounts, CashDrawerDTO } from '@/types/cashDrawer.dto'
import { http } from './axiosClient'

/** Daily cash close: the Staff's drawer of the day, and the Manager's confirmation. Always the real API. */
export const cashDrawerService = {
  /** GET /staff/lots/{lotId}/cash-drawer: the signed-in Staff's drawer of today (status NotOpened when none). */
  current(lotId: string): Promise<CashDrawerDTO> {
    return http.get<CashDrawerDTO>(`/staff/lots/${lotId}/cash-drawer`)
  },

  /** Opens today's drawer with the counted float. */
  open(lotId: string, float: BanknoteCounts): Promise<CashDrawerDTO> {
    return http.post<CashDrawerDTO>(`/staff/lots/${lotId}/cash-drawer/open`, { float })
  },

  /** Closes the drawer with the blind count; a difference over the threshold needs a reason. */
  close(lotId: string, counted: BanknoteCounts, reason?: string): Promise<CashDrawerDTO> {
    return http.post<CashDrawerDTO>(`/staff/lots/${lotId}/cash-drawer/close`, { counted, reason: reason || undefined })
  },

  /** Manager: closed drawers of the lot waiting for confirmation (or one status). */
  forLot(lotId: string, status?: string): Promise<CashDrawerDTO[]> {
    return http.get<CashDrawerDTO[]>(`/manager/lots/${lotId}/cash-closes`, { params: status ? { status } : undefined })
  },

  /** Manager: confirms a Staff's close (never one's own); a difference needs a note. */
  confirm(id: number, note?: string): Promise<CashDrawerDTO> {
    return http.post<CashDrawerDTO>(`/manager/cash-closes/${id}/confirm`, { note: note || undefined })
  },
}
