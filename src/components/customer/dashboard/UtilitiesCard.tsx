import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { CreditCard, Headset, Map, Phone, Receipt } from 'lucide-react'

export function UtilitiesCard() {
  const navigate = useNavigate()
  const soon = (what: string) => toast.info(`${what} is coming soon.`)

  const items = [
    { icon: Map, title: 'Parking Map', text: 'Live zone availability', onClick: () => navigate('/me#map') },
    { icon: Receipt, title: 'Payment History', text: 'Invoices & e-tax receipts', onClick: () => navigate('/me#history') },
    { icon: CreditCard, title: 'Auto-Deduct (VNPAY)', text: 'Manage payment gateways', onClick: () => soon('Automatic payment') },
    { icon: Headset, title: 'Terminal Assistance', text: 'Station control intercom', onClick: () => soon('Terminal intercom') },
  ]

  return (
    <div className="cx-stack">
      <section className="cx-card" aria-labelledby="utilities-title">
        <div className="cx-card__head" style={{ marginBottom: '1rem' }}>
          <h2 className="cx-label" id="utilities-title" style={{ color: 'var(--cx-on-surface)', fontSize: '0.8rem' }}>
            Operational utilities
          </h2>
          <span className="cx-label">Quick actions</span>
        </div>
        <div className="cx-utilities">
          {items.map(({ icon: Icon, ...item }) => (
            <button key={item.title} type="button" className="cx-utility" onClick={item.onClick}>
              <Icon aria-hidden />
              <strong>{item.title}</strong>
              <span>{item.text}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="cx-card cx-hotline" aria-label="Terminal control hotline">
        <span className="cx-hotline__icon"><Phone aria-hidden /></span>
        <div className="cx-hotline__text">
          <span className="cx-label">Terminal control hotline</span>
          <strong>+84 (28) 7300-2424</strong>
        </div>
        <a href="tel:+842873002424" className="cx-btn cx-btn--sm">Direct call</a>
      </section>
    </div>
  )
}
