import { paymentReturnUrl } from './reservation.service'
import { http } from './axiosClient'
import type { PaymentDTO, TopUpWalletRequest, WalletDTO, WithdrawWalletRequest } from '@/types/operations.dto'

/** XXIV User Wallet API: telemetry balance, VNPay/MoMo top-ups, and withdrawals. */
export const walletService = {
  /** Fetch current user's wallet balance, hold amount, and recent transaction history. */
  getWallet(): Promise<WalletDTO> {
    return http.get<WalletDTO>('/wallet')
  },

  /** Initiate online top-up (VNPay / MoMo); returns PaymentDTO with payUrl. */
  topUp(request: TopUpWalletRequest): Promise<PaymentDTO> {
    return http.post<PaymentDTO>('/wallet/topup', {
      amount: request.amount,
      provider: request.provider ?? 'VNPay',
      returnUrl: request.returnUrl ?? paymentReturnUrl(),
    })
  },

  /** Request a withdrawal to bank account or MoMo. */
  withdraw(request: WithdrawWalletRequest): Promise<WalletDTO> {
    return http.post<WalletDTO>('/wallet/withdraw', {
      amount: request.amount,
      method: request.method ?? 'bank',
      bankName: request.bankName,
      bankAccount: request.bankAccount,
    })
  },
}
