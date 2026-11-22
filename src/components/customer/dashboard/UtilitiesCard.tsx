import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { CreditCard, Headset, Map, Phone, Receipt } from 'lucide-react'
import { t, tMaybe } from '@/i18n'

export function UtilitiesCard() {
  const navigate = useNavigate()
  const soon = (what: string) => toast.info(t('{what} is coming soon.', { what: t(what) }))

  const items = [
    { icon: Map, title: t('Parking Map'), text: t('Live zone availability'), onClick: () => navigate('/me#map') },
    { icon: Receipt, title: t('Payment History'), text: t('Payments and receipts'), onClick: () => navigate('/me#history') },
    { icon: CreditCard, title: t('Auto-Deduct (VNPAY)'), text: t('Pay automatically'), onClick: () => soon('Automatic payment') },
    { icon: Headset, title: t('Help'), text: t('Contact the parking lot'), onClick: () => soon('Contact the parking lot') },
  ]

  return (
    <div className="cx-stack">
      <section className="cx-card" aria-labelledby="utilities-title">
        <div className="cx-card__head" style={{ marginBottom: '1rem' }}>
          <h2 className="cx-label" id="utilities-title" style={{ color: 'var(--cx-on-surface)', fontSize: '0.8rem' }}>
            {t('Utilities')}
          </h2>
          <span className="cx-label">{t('Quick actions')}</span>
        </div>
        <div className="cx-utilities">
          {items.map(({ icon: Icon, ...item }) => (
            <button key={item.title} type="button" className="cx-utility" onClick={item.onClick}>
              <Icon aria-hidden />
              <strong>{tMaybe(item.title)}</strong>
              <span>{tMaybe(item.text)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="cx-card cx-hotline" aria-label={t('Support hotline')}>
        <span className="cx-hotline__icon"><Phone aria-hidden /></span>
        <div className="cx-hotline__text">
          <span className="cx-label">{t('Support hotline')}</span>
          <strong>+84 (28) 7300-2424</strong>
        </div>
        <a href="tel:+842873002424" className="cx-btn cx-btn--sm">{t('Direct call')}</a>
      </section>
    </div>
  )
}
