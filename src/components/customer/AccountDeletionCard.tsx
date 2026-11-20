import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Clock, Info, Trash2 } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { useDeletionRequest, useDeletionRequestActions } from '@/hooks/useProfile'
import { t, currentLocale, tMaybe } from '@/i18n'

const MAX_REASON = 500

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString(currentLocale(), { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })

/**
 * Profile card where a customer asks for their account to be deleted. The request goes to the Admins, who lock the
 * account once nothing is left open on it (parked vehicle, booking, wallet money); the customer can withdraw it until then.
 */
export function AccountDeletionCard() {
  const { data: request, isLoading } = useDeletionRequest()
  const { request: send, cancel } = useDeletionRequestActions()
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    send.mutate(reason, {
      onSuccess: () => {
        toast.success(t('Request sent. An administrator will close your account.'))
        setAsking(false)
        setReason('')
      },
      onError: (err) => toast.error(getErrorMessage(err)),
    })
  }

  const withdraw = () =>
    cancel.mutate(undefined, {
      onSuccess: () => toast.success(t('Your account deletion request was withdrawn.')),
      onError: (err) => toast.error(getErrorMessage(err)),
    })

  return (
    <section className="cx-card" id="delete-account" aria-labelledby="delete-account-title">
      <div className="cx-card__head">
        <div className="cx-card__title-row">
          <span className="cx-card__icon"><Trash2 aria-hidden /></span>
          <div>
            <h2 className="cx-card__title" id="delete-account-title">{t('Delete Account')}</h2>
            <p className="cx-card__subtitle">{t('Ask an administrator to close your account.')}</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="cx-card__subtitle">{t('Loading…')}</p>
      ) : request ? (
        <>
          <p className="cx-note cx-note--warn">
            <Clock aria-hidden />
            <span className="cx-note__text">
              {t('You asked for your account to be deleted on {requestedAt}', { requestedAt: formatWhen(request.requestedAt) })}
              {request.reason ? ` ("${request.reason}")` : ''}{t('. An administrator will lock it once nothing is left open on it. You can keep using the app until then.')}
            </span>
          </p>
          <div className="cx-actions">
            <button type="button" className="cx-btn cx-btn--light" onClick={withdraw} disabled={cancel.isPending}>
              {cancel.isPending ? t('Withdrawing...') : t('Withdraw request')}
            </button>
          </div>
        </>
      ) : !asking ? (
        <>
          <p className="cx-note">
            <Info aria-hidden />
            <span className="cx-note__text">
              {t('Your parking history and payments are kept without your personal details. Finish any parked stay and booking and use up your wallet balance first.')}
            </span>
          </p>
          <div className="cx-actions">
            <button type="button" className="cx-btn cx-btn--danger" onClick={() => setAsking(true)}>
              <Trash2 aria-hidden />{' '}{t('Request account deletion')}
            </button>
          </div>
        </>
      ) : (
        <form className="cx-form" onSubmit={submit} noValidate>
          <div className="cx-field">
            <div className="cx-field__label-row">
              <label className="cx-field__label" htmlFor="delete-reason">{t('Reason (optional)')}</label>
              <span className="cx-card__subtitle">{reason.length}/{tMaybe(MAX_REASON)}</span>
            </div>
            <textarea
              id="delete-reason"
              className="cx-input"
              style={{ minHeight: '5.5rem', paddingTop: '0.6rem', resize: 'vertical' }}
              maxLength={MAX_REASON}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('Tell us why you are leaving')}
            />
          </div>
          <div className="cx-actions">
            <button type="button" className="cx-btn cx-btn--ghost" onClick={() => setAsking(false)} disabled={send.isPending}>
              {t('Cancel')}
            </button>
            <button type="submit" className="cx-btn cx-btn--danger" disabled={send.isPending}>
              {send.isPending ? t('Sending...') : t('Send deletion request')}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
