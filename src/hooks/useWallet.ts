import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { walletService } from '@/api/wallet.service'
import { getErrorMessage } from '@/api/apiError'
import { session } from '@/lib/session'

export interface WalletTransaction {
  id: string
  title: string
  subtitle: string
  amount: number
  status: string
  type: 'deposit' | 'withdraw' | 'parking'
  method?: string
  date: string
}

const STORAGE_KEY_BALANCE = 'xxiv_wallet_balance'
const STORAGE_KEY_HOLD = 'xxiv_wallet_hold'
const STORAGE_KEY_TXS = 'xxiv_wallet_transactions'

const INITIAL_BALANCE = 0
const INITIAL_HOLD = 0

const INITIAL_TRANSACTIONS: WalletTransaction[] = []

export function formatVndBalance(amount: number): string {
  return new Intl.NumberFormat('en-US').format(amount) + ' ₫'
}

export function formatVndQuick(amount: number): string {
  return new Intl.NumberFormat('en-US').format(amount) + '₫'
}

export function useWallet() {
  const [balance, setBalanceState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_BALANCE)
      if (!saved || saved === '1250000') {
        localStorage.setItem(STORAGE_KEY_BALANCE, '0')
        return 0
      }
      return Number(saved)
    } catch {
      return INITIAL_BALANCE
    }
  })

  const [holdAmount, setHoldAmountState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HOLD)
      return saved ? Number(saved) : INITIAL_HOLD
    } catch {
      return INITIAL_HOLD
    }
  })

  const [transactions, setTransactions] = useState<WalletTransaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TXS)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Clear old mock transactions from previous mock version
        if (Array.isArray(parsed) && parsed.some((t: WalletTransaction) => t.id === 'XXIV-792182')) {
          localStorage.removeItem(STORAGE_KEY_TXS)
          return []
        }
        return parsed
      }
      return INITIAL_TRANSACTIONS
    } catch {
      return INITIAL_TRANSACTIONS
    }
  })

  const [loading, setLoading] = useState<boolean>(false)

  // Fetch real wallet from backend if authenticated
  const fetchWallet = useCallback(async () => {
    if (!session.getToken()) return
    try {
      const data = await walletService.getWallet()
      if (data) {
        setBalanceState(data.balance)
        setHoldAmountState(data.holdAmount ?? 0)
        try {
          localStorage.setItem(STORAGE_KEY_BALANCE, String(data.balance))
          localStorage.setItem(STORAGE_KEY_HOLD, String(data.holdAmount ?? 0))
        } catch {
          // ignore
        }

        if (data.recentTransactions && data.recentTransactions.length > 0) {
          const mapped: WalletTransaction[] = data.recentTransactions.map((tx) => ({
            id: tx.id,
            title: tx.title,
            subtitle: tx.subtitle,
            amount: tx.amount,
            status: tx.status,
            type: tx.type,
            method: tx.method,
            date: tx.createdAt,
          }))
          setTransactions(mapped)
          try {
            localStorage.setItem(STORAGE_KEY_TXS, JSON.stringify(mapped))
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // Fallback to local storage if API is temporarily unavailable
    }
  }, [])

  useEffect(() => {
    fetchWallet()
  }, [fetchWallet])

  // Synchronize across hook consumers or tabs
  useEffect(() => {
    const handleSync = () => {
      fetchWallet()
      try {
        const savedBal = localStorage.getItem(STORAGE_KEY_BALANCE)
        if (savedBal !== null) setBalanceState(Number(savedBal))
        const savedHold = localStorage.getItem(STORAGE_KEY_HOLD)
        if (savedHold !== null) setHoldAmountState(Number(savedHold))
        const savedTxs = localStorage.getItem(STORAGE_KEY_TXS)
        if (savedTxs !== null) setTransactions(JSON.parse(savedTxs))
      } catch {
        // ignore storage errors
      }
    }

    window.addEventListener('xxiv-wallet-updated', handleSync)
    window.addEventListener('storage', handleSync)
    return () => {
      window.removeEventListener('xxiv-wallet-updated', handleSync)
      window.removeEventListener('storage', handleSync)
    }
  }, [fetchWallet])

  const updateBalanceAndTxs = useCallback((newBalance: number, newTxs: WalletTransaction[]) => {
    setBalanceState(newBalance)
    setTransactions(newTxs)
    try {
      localStorage.setItem(STORAGE_KEY_BALANCE, String(newBalance))
      localStorage.setItem(STORAGE_KEY_TXS, JSON.stringify(newTxs))
      window.dispatchEvent(new Event('xxiv-wallet-updated'))
    } catch {
      // ignore
    }
  }, [])

  const deposit = useCallback(
    async (amount: number, method: 'vnpay' | 'momo'): Promise<boolean> => {
      if (amount <= 0 || isNaN(amount)) {
        toast.error('Please enter a valid amount.')
        return false
      }

      const methodName = method === 'vnpay' ? 'VNPay' : 'MoMo'

      // If user is authenticated, call real backend API to obtain gateway payment URL
      if (session.getToken()) {
        setLoading(true)
        try {
          const res = await walletService.topUp({
            amount,
            provider: methodName,
          })

          if (res.payUrl) {
            toast.loading(`Redirecting to ${methodName} payment gateway...`)
            // Short timeout to let user see toast before redirect
            setTimeout(() => {
              window.location.assign(res.payUrl!)
            }, 600)
            return true
          }
        } catch (err) {
          toast.error(getErrorMessage(err))
          setLoading(false)
          return false
        }
      }

      // Offline / Local fallback simulation
      const now = new Date()
      const timeStr = `Today, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const code = `XXIV-${Math.floor(100000 + Math.random() * 900000)}`

      const newTx: WalletTransaction = {
        id: code,
        title: `Wallet Top-up (${methodName})`,
        subtitle: `${timeStr} • ID: ${code}`,
        amount,
        status: 'Completed',
        type: 'deposit',
        method: methodName,
        date: now.toISOString(),
      }

      const nextBal = balance + amount
      const nextTxs = [newTx, ...transactions]
      updateBalanceAndTxs(nextBal, nextTxs)
      toast.success(`Successfully deposited ${formatVndBalance(amount)} via ${methodName}!`)
      return true
    },
    [balance, transactions, updateBalanceAndTxs],
  )

  const withdraw = useCallback(
    async (amount: number, method: 'bank' | 'momo', noteOrAccount?: string, bankName?: string): Promise<boolean> => {
      if (amount <= 0 || isNaN(amount)) {
        toast.error('Please enter a valid withdrawal amount.')
        return false
      }
      if (amount > balance) {
        toast.error('Available balance is insufficient for this withdrawal.')
        return false
      }

      const targetTitle = method === 'bank' ? 'Bank Account' : 'MoMo Wallet'

      if (session.getToken()) {
        setLoading(true)
        try {
          const res = await walletService.withdraw({
            amount,
            method,
            bankName: bankName || 'Bank Account',
            bankAccount: noteOrAccount,
          })
          setBalanceState(res.balance)
          setHoldAmountState(res.holdAmount ?? 0)
          toast.success(`Withdrawal request of ${formatVndBalance(amount)} submitted successfully.`)
          await fetchWallet()
          setLoading(false)
          return true
        } catch (err) {
          toast.error(getErrorMessage(err))
          setLoading(false)
          return false
        }
      }

      // Offline fallback
      const now = new Date()
      const timeStr = `Today, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const code = `XXIV-${Math.floor(100000 + Math.random() * 900000)}`

      const newTx: WalletTransaction = {
        id: code,
        title: `Withdrawal to ${targetTitle}`,
        subtitle: `${timeStr} • ${noteOrAccount || `ID: ${code}`}`,
        amount: -amount,
        status: 'Processing',
        type: 'withdraw',
        method: targetTitle,
        date: now.toISOString(),
      }

      const nextBal = balance - amount
      const nextTxs = [newTx, ...transactions]
      updateBalanceAndTxs(nextBal, nextTxs)
      toast.success(`Withdrawal request of ${formatVndBalance(amount)} submitted.`)
      return true
    },
    [balance, transactions, updateBalanceAndTxs, fetchWallet],
  )

  return {
    balance,
    holdAmount,
    transactions,
    loading,
    deposit,
    withdraw,
    fetchWallet,
    formatVndBalance,
    formatVndQuick,
  }
}
