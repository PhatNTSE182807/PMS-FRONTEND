import { useEffect, useState, type FormEvent } from 'react'
import { CreditCard, Loader2, Minus, Plus, X } from 'lucide-react'
import { useWallet, formatVndBalance, formatVndQuick } from '@/hooks/useWallet'
import '@/styles/wallet.css'

interface UserWalletModalProps {
  isOpen: boolean
  onClose: () => void
}

const PRESET_AMOUNTS = [50000, 100000, 200000, 500000, 1000000]

export function UserWalletModal({ isOpen, onClose }: UserWalletModalProps) {
  const { balance, holdAmount, transactions, loading, dailyTopUpLimit, topUpRemainingToday, minTopUp, deposit, withdraw } = useWallet()

  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit')
  const [selectedAmount, setSelectedAmount] = useState<number>(200000)
  const [customAmountStr, setCustomAmountStr] = useState<string>('200000')
  const [paymentMethod, setPaymentMethod] = useState<'vnpay' | 'momo'>('vnpay')

  // Withdraw state
  const [withdrawAmountStr, setWithdrawAmountStr] = useState<string>('200000')
  const [withdrawMethod, setWithdrawMethod] = useState<'bank' | 'momo'>('bank')
  const [bankAccount, setBankAccount] = useState<string>('1903688889999')
  const [bankName, setBankName] = useState<string>('Techcombank')

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSelectPreset = (amount: number) => {
    setSelectedAmount(amount)
    setCustomAmountStr(String(amount))
  }

  const handleCustomAmountChange = (val: string) => {
    const clean = val.replace(/\D/g, '')
    setCustomAmountStr(clean)
    const num = Number(clean)
    setSelectedAmount(num)
  }

  // Daily top-up limit check, shown under the amount before the customer leaves for the gateway
  const depositAmount = Number(customAmountStr)
  const depositProblem =
    depositAmount > topUpRemainingToday
      ? topUpRemainingToday > 0
        ? `Over today's limit: you can still add ${formatVndBalance(topUpRemainingToday)} today.`
        : `Today's top-up limit of ${formatVndBalance(dailyTopUpLimit)} is reached. Try again tomorrow.`
      : depositAmount > 0 && depositAmount < minTopUp
        ? `Minimum top-up amount is ${formatVndBalance(minTopUp)}.`
        : null

  const handleDepositSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const amount = Number(customAmountStr)
    await deposit(amount, paymentMethod)
  }

  const handleWithdrawSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const amount = Number(withdrawAmountStr)
    const note = withdrawMethod === 'bank' ? bankAccount : 'MoMo Wallet'
    await withdraw(amount, withdrawMethod, note, bankName)
  }

  return (
    <div className="cx-wallet-backdrop" role="presentation" onClick={onClose}>
      <div
        className="cx-wallet-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="cx-wallet-header">
          <div className="cx-wallet-header__brand">
            <div className="cx-wallet-header__badge">
              <CreditCard size={22} strokeWidth={2.2} />
            </div>
            <div className="cx-wallet-header__text">
              <h2 className="cx-wallet-header__title" id="wallet-modal-title">
                XXIV E-Wallet <span className="cx-wallet-header__title-sub">(User XXIV Wallet)</span>
              </h2>
              <span className="cx-wallet-header__desc">
                Non-stop parking fee auto-deduction & slot reservation
              </span>
            </div>
          </div>
          <button
            type="button"
            className="cx-wallet-header__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Telemetry Balance Overview */}
        <div className="cx-wallet-summary">
          <div className="cx-wallet-summary__left">
            <span className="cx-wallet-summary__label">CURRENT AVAILABLE BALANCE</span>
            <div className="cx-wallet-summary__amount">
              {new Intl.NumberFormat('en-US').format(balance)}{' '}
              <span className="cx-wallet-summary__symbol">₫</span>
            </div>
            <div className="cx-wallet-summary__status">
              <span className="cx-wallet-summary__dot" />
              <span>Connected: Automatic license plate barrier recognition</span>
            </div>
          </div>

          <div className="cx-wallet-summary__right">
            <span className="cx-wallet-summary__label">PENDING EXIT HOLD</span>
            <span className="cx-wallet-summary__hold-amount">
              {new Intl.NumberFormat('en-US').format(holdAmount)} ₫
            </span>
            <span className="cx-wallet-summary__limit">Parking limit: Unlimited</span>
          </div>
        </div>

        {/* Action Tabs: Deposit vs Withdraw */}
        <div className="cx-wallet-tabs">
          <button
            type="button"
            className={`cx-wallet-tab-btn ${activeTab === 'deposit' ? 'cx-wallet-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('deposit')}
          >
            Deposit
          </button>
          <button
            type="button"
            className={`cx-wallet-tab-btn ${activeTab === 'withdraw' ? 'cx-wallet-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('withdraw')}
          >
            Withdraw
          </button>
        </div>

        {/* TAB 1: DEPOSIT */}
        {activeTab === 'deposit' && (
          <form onSubmit={handleDepositSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Quick Presets */}
            <div className="cx-wallet-section">
              <label className="cx-wallet-section__title">Quick amount select</label>
              <div className="cx-wallet-presets">
                {PRESET_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className={`cx-wallet-preset ${selectedAmount === amt ? 'cx-wallet-preset--active' : ''}`}
                    onClick={() => handleSelectPreset(amt)}
                  >
                    {formatVndQuick(amt)}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Amount Input */}
            <div className="cx-wallet-section">
              <label className="cx-wallet-section__title" htmlFor="deposit-custom-amount">
                Or enter custom amount (VND)
              </label>
              <div className="cx-wallet-input-container">
                <input
                  id="deposit-custom-amount"
                  type="text"
                  inputMode="numeric"
                  className="cx-wallet-input"
                  value={customAmountStr}
                  onChange={(e) => handleCustomAmountChange(e.target.value)}
                  placeholder="200000"
                />
                <span className="cx-wallet-input-suffix">VND</span>
              </div>
              <p className="cx-wallet-limit">
                Daily top-up limit {formatVndBalance(dailyTopUpLimit)} • left today{' '}
                <strong>{formatVndBalance(topUpRemainingToday)}</strong>
              </p>
              {depositProblem && (
                <p className="cx-wallet-limit cx-wallet-limit--error" role="alert">
                  {depositProblem}
                </p>
              )}
            </div>

            {/* Payment Methods */}
            <div className="cx-wallet-section">
              <label className="cx-wallet-section__title">Payment Method</label>
              <div className="cx-wallet-methods">
                {/* VNPay */}
                <div
                  className={`cx-wallet-method ${paymentMethod === 'vnpay' ? 'cx-wallet-method--active' : ''}`}
                  onClick={() => setPaymentMethod('vnpay')}
                >
                  <div className="cx-wallet-radio">
                    {paymentMethod === 'vnpay' && <div className="cx-wallet-radio__dot" />}
                  </div>
                  <div className="cx-wallet-method__logo" style={{ background: '#005baa' }}>
                    <svg viewBox="0 0 100 100" width="100%" height="100%" fill="none">
                      <rect width="100" height="100" fill="#005baa" />
                      <text x="50" y="60" fill="#ffffff" fontSize="32" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">
                        VN
                      </text>
                      <circle cx="75" cy="35" r="12" fill="#e11b22" />
                    </svg>
                  </div>
                  <span className="cx-wallet-method__name">VNPay Gateway</span>
                </div>

                {/* MoMo */}
                <div
                  className={`cx-wallet-method ${paymentMethod === 'momo' ? 'cx-wallet-method--active' : ''}`}
                  onClick={() => setPaymentMethod('momo')}
                >
                  <div className="cx-wallet-radio">
                    {paymentMethod === 'momo' && <div className="cx-wallet-radio__dot" />}
                  </div>
                  <div className="cx-wallet-method__logo" style={{ background: '#a50064' }}>
                    <svg viewBox="0 0 100 100" width="100%" height="100%">
                      <rect width="100" height="100" fill="#a50064" />
                      <text x="50" y="62" fill="#ffffff" fontSize="28" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
                        MoMo
                      </text>
                    </svg>
                  </div>
                  <span className="cx-wallet-method__name">MoMo Wallet</span>
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <button type="submit" className="cx-wallet-submit" disabled={loading || depositProblem !== null || !depositAmount}>
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Connecting to Gateway...
                </>
              ) : (
                <>
                  <Plus size={18} strokeWidth={2.8} /> CONFIRM TOP-UP
                </>
              )}
            </button>
          </form>
        )}

        {/* TAB 2: WITHDRAW */}
        {activeTab === 'withdraw' && (
          <form onSubmit={handleWithdrawSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="cx-wallet-section">
              <label className="cx-wallet-section__title" htmlFor="withdraw-amount">
                Enter amount to withdraw (VND)
              </label>
              <div className="cx-wallet-input-container">
                <input
                  id="withdraw-amount"
                  type="text"
                  inputMode="numeric"
                  className="cx-wallet-input"
                  value={withdrawAmountStr}
                  onChange={(e) => setWithdrawAmountStr(e.target.value.replace(/\D/g, ''))}
                  placeholder="100000"
                />
                <span className="cx-wallet-input-suffix">VND</span>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.3rem' }}>
                {[100000, 200000, 500000, balance].map((amt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="cx-wallet-preset"
                    style={{ flex: 1 }}
                    onClick={() => setWithdrawAmountStr(String(amt))}
                  >
                    {idx === 3 ? 'All' : formatVndQuick(amt)}
                  </button>
                ))}
              </div>
            </div>

            <div className="cx-wallet-section">
              <label className="cx-wallet-section__title">Withdrawal Method</label>
              <div className="cx-wallet-methods">
                <div
                  className={`cx-wallet-method ${withdrawMethod === 'bank' ? 'cx-wallet-method--active' : ''}`}
                  onClick={() => setWithdrawMethod('bank')}
                >
                  <div className="cx-wallet-radio">
                    {withdrawMethod === 'bank' && <div className="cx-wallet-radio__dot" />}
                  </div>
                  <span className="cx-wallet-method__name">Bank Account</span>
                </div>

                <div
                  className={`cx-wallet-method ${withdrawMethod === 'momo' ? 'cx-wallet-method--active' : ''}`}
                  onClick={() => setWithdrawMethod('momo')}
                >
                  <div className="cx-wallet-radio">
                    {withdrawMethod === 'momo' && <div className="cx-wallet-radio__dot" />}
                  </div>
                  <span className="cx-wallet-method__name">MoMo Wallet</span>
                </div>
              </div>

              {withdrawMethod === 'bank' && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                  <input
                    type="text"
                    className="cx-wallet-input-container"
                    style={{ flex: 1, padding: '0.55rem 0.8rem', color: '#fff', fontSize: '0.85rem' }}
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Bank Name (e.g. Techcombank)"
                  />
                  <input
                    type="text"
                    className="cx-wallet-input-container"
                    style={{ flex: 1.5, padding: '0.55rem 0.8rem', color: '#fff', fontSize: '0.85rem' }}
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    placeholder="Account Number"
                  />
                </div>
              )}
            </div>

            <button type="submit" className="cx-wallet-submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Processing...
                </>
              ) : (
                'CONFIRM WITHDRAWAL'
              )}
            </button>
          </form>
        )}

        {/* Recent Transaction History */}
        <div className="cx-wallet-history">
          <div className="cx-wallet-history__head">
            <span className="cx-wallet-history__title">RECENT WALLET TRANSACTIONS</span>
            <button
              type="button"
              className="cx-wallet-history__more"
              onClick={() => {
                // optional navigate to bookings or history
              }}
            >
              View all
            </button>
          </div>

          <div className="cx-wallet-history__list">
            {transactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.25rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                No recent transactions yet. Top up your wallet to get started.
              </div>
            ) : (
              transactions.slice(0, 3).map((tx) => {
                const isDeposit = tx.amount > 0
                return (
                  <div key={tx.id} className="cx-wallet-history__item">
                    <div
                      className={`cx-wallet-history__icon ${
                        isDeposit ? 'cx-wallet-history__icon--deposit' : 'cx-wallet-history__icon--deduct'
                      }`}
                    >
                      {isDeposit ? <Plus size={16} strokeWidth={2.8} /> : <Minus size={16} strokeWidth={2.8} />}
                    </div>

                    <div className="cx-wallet-history__details">
                      <span className="cx-wallet-history__item-title">{tx.title}</span>
                      <span className="cx-wallet-history__item-sub">{tx.subtitle}</span>
                    </div>

                    <div className="cx-wallet-history__values">
                      <span
                        className={`cx-wallet-history__amount ${
                          isDeposit
                            ? 'cx-wallet-history__amount--deposit'
                            : 'cx-wallet-history__amount--deduct'
                        }`}
                      >
                        {isDeposit ? `+${formatVndBalance(tx.amount)}` : `${formatVndBalance(tx.amount)}`}
                      </span>
                      <span className="cx-wallet-history__status">{tx.status}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Security Reassurance Footer */}
        <div className="cx-wallet-footer">
          Transactions are secured under PCI-DSS Level 1 & State Bank of Vietnam standards.
        </div>
      </div>
    </div>
  )
}
