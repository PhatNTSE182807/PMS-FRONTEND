import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { LOGO_SRC } from '@/components/ParkingLogo'
import { useReveal } from './useHomeEffects'

const FAQS = [
  {
    q: 'How do I reserve a space?',
    a: 'Create a free account, choose a lot and zone on your dashboard and pick a time. You get a QR code to show at the gate.',
  },
  {
    q: 'Can I sign in without a password?',
    a: 'Yes. Use "Sign in with email code" to get a one-time 6-digit code, or sign in with your Google account.',
  },
  {
    q: 'Can I register more than one vehicle?',
    a: 'Yes. Add every car or motorbike you use and mark one as the default for quick reservations.',
  },
  {
    q: 'How is the fee calculated?',
    a: 'By vehicle type and how long you stay, with a daily cap. The current fee is shown live while you are parked.',
  },
  {
    q: 'How up to date is the availability?',
    a: 'Free spaces refresh every few seconds as vehicles check in and out at the gates.',
  },
]

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const revealRef = useReveal<HTMLElement>()

  return (
    <section className="home-section home-section--tinted home-reveal" id="faq" ref={revealRef}>
      <div className="home-container home-faq">
        <div>
          <p className="home-eyebrow">FAQ</p>
          <h2 className="home-section__title">Questions drivers ask</h2>
        </div>
        <div className="home-faq__list">
          {FAQS.map((item, index) => {
            const isOpen = openIndex === index
            const panelId = `faq-panel-${index}`
            return (
              <div key={item.q} className={`home-faq__item ${isOpen ? 'is-open' : ''}`}>
                <button
                  type="button"
                  className="home-faq__question"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                >
                  {item.q}
                  <ChevronDown aria-hidden />
                </button>
                <div id={panelId} className="home-faq__answer" role="region" hidden={!isOpen}>
                  <p>{item.a}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export function HomeFooter() {
  return (
    <>
      <section className="home-cta">
        <div className="home-container home-cta__inner">
          <h2>Ready to stop circling the block?</h2>
          <div className="home-cta__actions">
            <Link to="/register" className="home-btn home-btn--light">
              Create a free account
            </Link>
            <Link to="/login" className="home-btn home-btn--ghost-light">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-container home-footer__inner">
          <div className="home-footer__brand">
            <img src={LOGO_SRC} alt="" />
            <span>XXIV Parking</span>
          </div>
          <nav className="home-footer__links" aria-label="Footer">
            <a href="#availability">Live availability</a>
            <a href="#how-it-works">How it works</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>
          <p className="home-footer__copy">© {new Date().getFullYear()} XXIV Parking</p>
        </div>
      </footer>
    </>
  )
}
