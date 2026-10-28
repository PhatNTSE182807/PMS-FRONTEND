import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { paymentService } from '@/api/payment.service'
import { walletService } from '@/api/wallet.service'
import { getErrorMessage } from '@/api/apiError'
import { session } from '@/lib/session'
import { USER_TOAST, toastPaymentError } from '@/lib/userToasts'

export interface WalletTransaction {
  id: string
  title: string
  subtitle: string
  amount: number
  balanceBefore?: number
  balanceAfter?: number
  status: string
  type: 'deposit' | 'withdraw' | 'refund' | 'payment' | 'parking'
  method?: string
  date: string
}

const STORAGE_PREFIX_BALANCE = 'xxiv_wallet_balance'
const STORAGE_PREFIX_HOLD = 'xxiv_wallet_hold'
const STORAGE_PREFIX_TXS = 'xxiv_wallet_transactions'

const INITIAL_BALANCE = 0
const INITIAL_HOLD = 0
const INITIAL_TRANSACTIONS: WalletTransaction[] = []

export const DEFAULT_DAILY_TOP_UP_LIMIT = 10_000_000
export const DEFAULT_MIN_TOP_UP = 10_000

function getStorageKey(prefix: string, userId?: string | null): string {
  const uid = userId || session.getUser()?.userId || 'guest'
  return `${prefix}_${uid}`
}

/** Demo mode only: what was topped up today, from the locally simulated transactions. */
function demoTopUpsToday(transactions: WalletTransaction[]): number {
  const today = new Date().toDateString()
  return transactions
    .filter((t) => t.type === 'deposit' && new Date(t.date).toDateString() === today)
    .reduce((sum, t) => sum + t.amount, 0)
}

export function formatVndBalance(amount: number): string {
  return new Intl.NumberFormat('en-US').format(amount) + ' ₫'
}

export function formatVndQuick(amount: number): string {
  return new Intl.NumberFormat('en-US').format(amount) + '₫'
}

export function useWallet() {
  const [currentUserId, setCurrentUserId] = useState<string>(() => session.getUser()?.userId ?? 'guest')

  const [balance, setBalanceState] = useState<number>(() => {
    try {
      const uid = session.getUser()?.userId ?? 'guest'
      const saved = localStorage.getItem(getStorageKey(STORAGE_PREFIX_BALANCE, uid))
      return saved ? Number(saved) : INITIAL_BALANCE
    } catch {
      return INITIAL_BALANCE
    }
  })

  const [holdAmount, setHoldAmountState] = useState<number>(() => {
    try {
      const uid = session.getUser()?.userId ?? 'guest'
      const saved = localStorage.getItem(getStorageKey(STORAGE_PREFIX_HOLD, uid))
      return saved ? Number(saved) : INITIAL_HOLD
    } catch {
      return INITIAL_HOLD
    }
  })

  const [transactions, setTransactions] = useState<WalletTransaction[]>(() => {
    try {
      const uid = session.getUser()?.userId ?? 'guest'
      const saved = localStorage.getItem(getStorageKey(STORAGE_PREFIX_TXS, uid))
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) return parsed
      }
      return INITIAL_TRANSACTIONS
    } catch {
      return INITIAL_TRANSACTIONS
    }
  })

  const [allTransactions, setAllTransactions] = useState<WalletTransaction[]>([])
  const [loadingAllTxs, setLoadingAllTxs] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)

  const [dailyTopUpLimit, setDailyTopUpLimit] = useState<number>(DEFAULT_DAILY_TOP_UP_LIMIT)
  const [apiRemainingToday, setApiRemainingToday] = useState<number | null>(null)
  const [minTopUp, setMinTopUp] = useState<number>(DEFAULT_MIN_TOP_UP)

  const usesApi = Boolean(session.getToken()) && !session.isDemo()
  const topUpRemainingToday =
    usesApi && apiRemainingToday !== null
      ? apiRemainingToday
      : Math.max(0, dailyTopUpLimit - demoTopUpsToday(transactions))

  const isFetchingRef = useRef(false)

  // Fetch real wallet from backend if authenticated
  const fetchWallet = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!session.getToken()) return
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    const uid = session.getUser()?.userId ?? 'guest'

    try {
      const data = await walletService.getWallet()
      if (data) {
        setBalanceState(data.balance)
        setHoldAmountState(data.holdAmount ?? 0)
        if (data.dailyTopUpLimit) setDailyTopUpLimit(data.dailyTopUpLimit)
        if (data.minTopUp) setMinTopUp(data.minTopUp)
        if (typeof data.topUpRemainingToday === 'number') setApiRemainingToday(data.topUpRemainingToday)

        try {
          const balKey = getStorageKey(STORAGE_PREFIX_BALANCE, uid)
          const holdKey = getStorageKey(STORAGE_PREFIX_HOLD, uid)
          const prevBal = localStorage.getItem(balKey)
          const prevHold = localStorage.getItem(holdKey)
          const balChanged = prevBal !== String(data.balance)
          const holdChanged = prevHold !== String(data.holdAmount ?? 0)

          if (balChanged) {
            localStorage.setItem(balKey, String(data.balance))
          }
          if (holdChanged) {
            localStorage.setItem(holdKey, String(data.holdAmount ?? 0))
          }

          // Always update transactions per user, even if empty array []
          const rawList = data.recentTransactions ?? []
          const mapped: WalletTransaction[] = rawList.map((tx) => ({
            id: tx.id,
            title: tx.title,
            subtitle: tx.subtitle,
            amount: tx.amount,
            balanceBefore: tx.balanceBefore,
            balanceAfter: tx.balanceAfter,
            status: tx.status,
            type: (tx.type as WalletTransaction['type']) || (tx.amount >= 0 ? 'deposit' : 'withdraw'),
            method: tx.method,
            date: tx.createdAt,
          }))
          setTransactions(mapped)

          const txsKey = getStorageKey(STORAGE_PREFIX_TXS, uid)
          localStorage.setItem(txsKey, JSON.stringify(mapped))

          if (!options.silent && (balChanged || holdChanged)) {
            window.dispatchEvent(new Event('xxiv-wallet-updated'))
          }
        } catch {
          // ignore storage error
        }
      }
    } catch {
      // Fallback
    } finally {
      isFetchingRef.current = false
    }
  }, [])

  // Fetch all transactions for history view (Issue 4)
  const fetchAllTransactions = useCallback(async (): Promise<WalletTransaction[]> => {
    if (!session.getToken()) {
      setAllTransactions(transactions)
      return transactions
    }

    setLoadingAllTxs(true)
    try {
      const data = await walletService.getTransactions()
      if (Array.isArray(data)) {
        const mapped: WalletTransaction[] = data.map((tx) => ({
          id: tx.id,
          title: tx.title,
          subtitle: tx.subtitle,
          amount: tx.amount,
          balanceBefore: tx.balanceBefore,
          balanceAfter: tx.balanceAfter,
          status: tx.status,
          type: (tx.type as WalletTransaction['type']) || (tx.amount >= 0 ? 'deposit' : 'withdraw'),
          method: tx.method,
          date: tx.createdAt,
        }))
        setAllTransactions(mapped)
        setLoadingAllTxs(false)
        return mapped
      }
    } catch {
      // fallback
    }
    setLoadingAllTxs(false)
    setAllTransactions(transactions)
    return transactions
  }, [transactions])

  // Initial load
  useEffect(() => {
    void fetchWallet()
  }, [fetchWallet])

  // React to user auth state changes (login, logout, switch account)
  useEffect(() => {
    return session.subscribe((user) => {
      const newUid = user?.userId ?? 'guest'
      if (newUid !== currentUserId) {
        setCurrentUserId(newUid)
        const balKey = getStorageKey(STORAGE_PREFIX_BALANCE, newUid)
        const holdKey = getStorageKey(STORAGE_PREFIX_HOLD, newUid)
        const txsKey = getStorageKey(STORAGE_PREFIX_TXS, newUid)
        try {
          const savedBal = localStorage.getItem(balKey)
          setBalanceState(savedBal !== null ? Number(savedBal) : 0)
          const savedHold = localStorage.getItem(holdKey)
          setHoldAmountState(savedHold !== null ? Number(savedHold) : 0)
          const savedTxs = localStorage.getItem(txsKey)
          setTransactions(savedTxs !== null ? JSON.parse(savedTxs) : [])
        } catch {
          setBalanceState(0)
          setHoldAmountState(0)
          setTransactions([])
        }
        void fetchWallet()
      }
    })
  }, [currentUserId, fetchWallet])

  // Cross-tab and same-tab synchronization WITHOUT infinite loop (Issue 2)
  useEffect(() => {
    const balKey = getStorageKey(STORAGE_PREFIX_BALANCE, currentUserId)
    const holdKey = getStorageKey(STORAGE_PREFIX_HOLD, currentUserId)
    const txsKey = getStorageKey(STORAGE_PREFIX_TXS, currentUserId)

    const handleStorage = (e: StorageEvent) => {
      // CRITICAL: Only react to keys belonging to the current user!
      // DO NOT call fetchWallet() here to prevent cross-tab ping-pong loops!
      if (!e.key || e.newValue === null) return

      if (e.key === balKey) {
        const val = Number(e.newValue)
        if (!isNaN(val)) setBalanceState(val)
      } else if (e.key === holdKey) {
        const val = Number(e.newValue)
        if (!isNaN(val)) setHoldAmountState(val)
      } else if (e.key === txsKey) {
        try {
          const parsed = JSON.parse(e.newValue)
          if (Array.isArray(parsed)) setTransactions(parsed)
        } catch {
          // ignore
        }
      }
    }

    const handleLocalSync = () => {
      try {
        const savedBal = localStorage.getItem(balKey)
        if (savedBal !== null) setBalanceState(Number(savedBal))
        const savedHold = localStorage.getItem(holdKey)
        if (savedHold !== null) setHoldAmountState(Number(savedHold))
        const savedTxs = localStorage.getItem(txsKey)
        if (savedTxs !== null) setTransactions(JSON.parse(savedTxs))
      } catch {
        // ignore
      }
      if (session.getToken()) {
        void fetchWallet({ silent: true })
      }
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener('xxiv-wallet-updated', handleLocalSync)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('xxiv-wallet-updated', handleLocalSync)
    }
  }, [currentUserId, fetchWallet])

  const updateBalanceAndTxs = useCallback(
    (newBalance: number, newTxs: WalletTransaction[]) => {
      const uid = session.getUser()?.userId ?? 'guest'
      setBalanceState(newBalance)
      setTransactions(newTxs)
      try {
        localStorage.setItem(getStorageKey(STORAGE_PREFIX_BALANCE, uid), String(newBalance))
        localStorage.setItem(getStorageKey(STORAGE_PREFIX_TXS, uid), JSON.stringify(newTxs))
        window.dispatchEvent(new Event('xxiv-wallet-updated'))
      } catch {
        // ignore
      }
    },
    [],
  )

  /**
   * Tops the wallet up through VNPay / MoMo.
   */
  const deposit = useCallback(
    async (amount: number, method: 'vnpay' | 'momo', options: { simulate?: boolean } = {}): Promise<boolean> => {
      if (amount <= 0 || isNaN(amount)) {
        toast.error('Please enter a valid amount.')
        return false
      }

      if (amount < minTopUp) {
        toast.error(`Minimum top-up amount is ${formatVndBalance(minTopUp)}.`)
        return false
      }

      if (amount > topUpRemainingToday) {
        toast.error(
          topUpRemainingToday > 0
            ? `You can top up at most ${formatVndBalance(dailyTopUpLimit)} a day. You can still add ${formatVndBalance(topUpRemainingToday)} today.`
            : `You have reached today's top-up limit of ${formatVndBalance(dailyTopUpLimit)}. Try again tomorrow.`,
        )
        return false
      }

      const methodName = method === 'vnpay' ? 'VNPay' : 'MoMo'

      if (usesApi) {
        setLoading(true)
        try {
          const res = await walletService.topUp({
            amount,
            provider: methodName,
          })

          if (options.simulate) {
            await paymentService.simulateSuccess(res.id)
            await fetchWallet()
            window.dispatchEvent(new Event('xxiv-wallet-updated'))
            setLoading(false)
            toast.success(USER_TOAST.walletDeposited)
            return true
          }

          if (!res.payUrl) throw new Error(`${methodName} did not return a payment page. Please try again.`)

          toast.loading(`Redirecting to ${methodName} payment gateway...`)
          setTimeout(() => {
            window.location.assign(res.payUrl!)
          }, 600)
          return true
        } catch (err) {
          toastPaymentError(err)
          setLoading(false)
          void fetchWallet()
          return false
        }
      }

      // Demo mode fallback
      const now = new Date()
      const timeStr = `Today, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const code = `XXIV-${Math.floor(100000 + Math.random() * 900000)}`

      const newTx: WalletTransaction = {
        id: code,
        title: `Wallet Top-up (${methodName})`,
        subtitle: `${timeStr} • ID: ${code}`,
        amount,
        balanceBefore: balance,
        balanceAfter: balance + amount,
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
    [balance, transactions, updateBalanceAndTxs, usesApi, minTopUp, topUpRemainingToday, dailyTopUpLimit, fetchWallet],
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

          const uid = session.getUser()?.userId ?? 'guest'
          const balKey = getStorageKey(STORAGE_PREFIX_BALANCE, uid)
          const holdKey = getStorageKey(STORAGE_PREFIX_HOLD, uid)
          const txsKey = getStorageKey(STORAGE_PREFIX_TXS, uid)

          setBalanceState(res.balance)
          setHoldAmountState(res.holdAmount ?? 0)

          try {
            localStorage.setItem(balKey, String(res.balance))
            localStorage.setItem(holdKey, String(res.holdAmount ?? 0))
            if (Array.isArray(res.recentTransactions)) {
              const mapped: WalletTransaction[] = res.recentTransactions.map((tx) => ({
                id: tx.id,
                title: tx.title,
                subtitle: tx.subtitle,
                amount: tx.amount,
                balanceBefore: tx.balanceBefore,
                balanceAfter: tx.balanceAfter,
                status: tx.status,
                type: (tx.type as WalletTransaction['type']) || (tx.amount >= 0 ? 'deposit' : 'withdraw'),
                method: tx.method,
                date: tx.createdAt,
              }))
              setTransactions(mapped)
              localStorage.setItem(txsKey, JSON.stringify(mapped))
            }
          } catch {
            // ignore storage error
          }

          // Broadcast immediately to update header balance and other listeners across the app
          window.dispatchEvent(new Event('xxiv-wallet-updated'))

          toast.success(`Withdrawal request of ${formatVndBalance(amount)} submitted successfully.`)
          await fetchWallet({ silent: true })
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
        balanceBefore: balance,
        balanceAfter: balance - amount,
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
    allTransactions,
    loadingAllTxs,
    loading,
    dailyTopUpLimit,
    topUpRemainingToday,
    minTopUp,
    deposit,
    withdraw,
    fetchWallet,
    fetchAllTransactions,
    formatVndBalance,
    formatVndQuick,
  }
}

export type UseWalletReturn = ReturnType<typeof useWallet>

