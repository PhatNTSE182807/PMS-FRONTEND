import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { CircleCheck, CircleX, Loader, RotateCcw, ShieldAlert } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { paymentService } from '@/api/payment.service'
import { formatNumber } from '@/lib/format'
import { session } from '@/lib/session'
import type { PaymentCallbackResultDTO } from '@/types/operations.dto'
import '@/styles/customer.css'
import '@/styles/customer-light.css'

const PROVIDER_NAME = { vnpay: 'VNPay', momo: 'MoMo' } as const

/**
 * /payment/return/:provider — where VNPay and MoMo send the customer back. The query string is handed
 * to the API, which checks the signature and records the result (the same as the gateway's IPN, so
 * whichever arrives first wins and the other changes nothing). Public: a Guest who paid a lane QR on
 * their phone lands here too. In demo mode (?demo=1) the "gateway" is this page itself.
 */
export default function PaymentReturnPage() {
  const { provider: rawProvider } = useParams()
  const provider = rawProvider === 'momo' ? 'momo' : 'vnpay'
  const [search] = useSearchParams()
  const params = useMemo(() => Object.fromEntries(search.entries()), [search])
  const isDemo = params.demo === '1'
  const [result, setResult] = useState<PaymentCallbackResultDTO | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [demoChoice, setDemoChoice] = useState<'pay' | 'cancel' | null>(isDemo ? null : 'pay')
  const sent = useRef(false)

  useEffect(() => {
    if (!demoChoice || sent.current) return
    // Strict mode runs effects twice; the API is idempotent but one call is enough
    sent.current = true
    paymentService
      .handleReturn(provider, demoChoice === 'cancel' ? { ...params, cancel: '1' } : params)
      .then((res) => {
        setResult(res)
        window.dispatchEvent(new Event('xxiv-wallet-updated'))
      })
      .catch((e: unknown) => setError(getErrorMessage(e)))
  }, [demoChoice, params, provider])

  const payment = result?.payment
  const success = result && ['Applied', 'AlreadyProcessed'].includes(result.outcome) && payment?.status === 'Succeeded'
  const refunded = result?.outcome === 'Refunded'
  const signedIn = Boolean(session.getToken())
  const backTo = payment?.purpose === 'Deposit' || payment?.reservationId ? '/me/bookings' : '/me'

  return (
    <div className="cx" style={{ minHeight: '100vh' }}>
      <main className="cx-main">
        <div className="cx-container" style={{ maxWidth: '36rem' }}>
          <section className="cx-card" style={{ textAlign: 'center', display: 'grid', gap: '1rem', justifyItems: 'center' }} aria-live="polite">
            <span className="cx-eyebrow">
              <span className="cx-dot cx-dot--gold" aria-hidden="true" /> {PROVIDER_NAME[provider]} {isDemo ? '• demo gateway' : '• sandbox'}
            </span>

            {isDemo && !demoChoice && (
              <>
                <h1 className="cx-page-title" style={{ fontSize: '1.6rem' }}>Simulated {PROVIDER_NAME[provider]} payment</h1>
                <p className="cx-page-lead">
                  Demo mode has no gateway. Amount: <strong>{formatNumber(Number(params.amount) || 0)} VND</strong> • order <span className="cx-mono">{params.code}</span>
                </p>
                <div className="cx-reserve__pay" style={{ width: '100%' }}>
                  <button type="button" className="cx-btn cx-btn--gold" onClick={() => setDemoChoice('pay')}>
                    <CircleCheck aria-hidden /> Pay
                  </button>
                  <button type="button" className="cx-btn" onClick={() => setDemoChoice('cancel')}>
                    <CircleX aria-hidden /> Cancel payment
                  </button>
                </div>
              </>
            )}

            {demoChoice && !result && !error && (
              <>
                <Loader className="animate-spin" aria-hidden style={{ width: 40, height: 40, color: 'var(--cx-gold)' }} />
                <p className="cx-page-lead">Confirming the payment with {PROVIDER_NAME[provider]}…</p>
              </>
            )}

            {error && (
              <>
                <ShieldAlert aria-hidden style={{ width: 48, height: 48, color: 'var(--cx-error, #ff8a80)' }} />
                <h1 className="cx-page-title" style={{ fontSize: '1.6rem' }}>Could not confirm the payment</h1>
                <p className="cx-page-lead">{error}</p>
              </>
            )}

            {result && (
              <>
                {success ? (
                  <CircleCheck aria-hidden style={{ width: 56, height: 56, color: 'var(--cx-teal, #6ff7e2)' }} />
                ) : refunded ? (
                  <RotateCcw aria-hidden style={{ width: 56, height: 56, color: 'var(--cx-gold)' }} />
                ) : (
                  <CircleX aria-hidden style={{ width: 56, height: 56, color: 'var(--cx-error, #ff8a80)' }} />
                )}
                <h1 className="cx-page-title" style={{ fontSize: '1.6rem' }}>
                  {success
                    ? payment?.purpose === 'Deposit'
                      ? 'Deposit paid: your bay is confirmed'
                      : payment?.purpose === 'WalletTopUp'
                        ? 'Wallet top-up successful: balance updated'
                        : 'Parking fee paid'
                    : refunded
                      ? 'Payment received after the deadline: refunded'
                      : !result.signatureValid
                        ? 'The payment result could not be verified'
                        : 'Payment not completed'}
                </h1>
                {payment && (
                  <dl className="cx-map__cells" style={{ width: '100%' }}>
                    <div className="cx-map__cell">
                      <span className="cx-label">Amount</span>
                      <strong>{formatNumber(payment.amount)} VND</strong>
                    </div>
                    <div className="cx-map__cell">
                      <span className="cx-label">Order</span>
                      <strong className="cx-mono">{payment.code}</strong>
                    </div>
                    {payment.exitWindowEndsAt && (
                      <div className="cx-map__cell" style={{ gridColumn: '1 / -1' }}>
                        <span className="cx-label">Leave before</span>
                        <strong className="is-gold">{new Date(payment.exitWindowEndsAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</strong>
                      </div>
                    )}
                  </dl>
                )}
                {result.message && <p className="cx-page-lead">{result.message}</p>}
              </>
            )}

            {(result || error) && signedIn && (
              <Link to={backTo} className="cx-btn cx-btn--teal">
                {backTo === '/me/bookings' ? 'Back to My Bookings' : 'Back to my dashboard'}
              </Link>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
