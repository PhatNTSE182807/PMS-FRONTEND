import { useEffect } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { HomeFooter } from '@/components/home/HomeFooter'
import { LanguageToggle } from '@/components/LanguageToggle'
import { LOGO_SRC } from '@/components/ParkingLogo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { localDateFormat, t } from '@/i18n'
import '@/styles/home.css'
import '@/styles/legal.css'
import { LEGAL_DOCS, LEGAL_UPDATED_AT, LEGAL_VERSION, legalValues, type LegalDocId } from './legalContent'

const SUPPORT_EMAIL = 'support@xxivparking.vn'
const SUPPORT_PHONE = '+84 (28) 7300-2424'
const updatedFormat = localDateFormat({ day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/** Public Terms of Service and Privacy Policy pages, at /terms and /privacy. */
export default function LegalPage({ doc }: { doc: LegalDocId }) {
  const { hash } = useLocation()
  const { title, intro, summary, sections } = LEGAL_DOCS[doc]
  const values = legalValues()

  // Moving between the two documents starts at the top, unless the link points to a section
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [doc, hash])

  return (
    <div className="home legal">
      <header className="legal-bar">
        <div className="home-container legal-bar__inner">
          <Link to="/" className="home-nav__brand">
            <img src={LOGO_SRC} alt="" className="legal-bar__logo" />
            <span className="home-nav__brand-mark">XXIV</span>
            <span className="home-nav__brand-name">PARKING</span>
          </Link>
          <div className="legal-bar__actions">
            <LanguageToggle className="home-lang-toggle" />
            <ThemeToggle className="home-theme-toggle" />
            <Link to="/" className="legal-bar__back">
              <ArrowLeft aria-hidden />
              {t('Back to home')}
            </Link>
          </div>
        </div>
      </header>

      <main className="home-container legal-main">
        <nav className="legal-tabs" aria-label={t('Legal documents')}>
          <NavLink to="/terms">{t('Terms of Service')}</NavLink>
          <NavLink to="/privacy">{t('Privacy Policy')}</NavLink>
        </nav>

        <div className="legal-head">
          <span className="home-eyebrow home-eyebrow--gold">{t('Legal')}</span>
          <h1 className="home-heading">{t(title)}</h1>
          <p className="legal-head__intro">{t(intro)}</p>
          <p className="legal-head__meta">
            {t('Last updated: {date}', { date: updatedFormat.format(new Date(LEGAL_UPDATED_AT)) })}
            {' · '}
            {t('Version {version}', { version: LEGAL_VERSION })}
          </p>
        </div>

        <div className="legal-layout">
          <nav className="legal-toc" aria-label={t('On this page')}>
            <h2>{t('On this page')}</h2>
            <ol>
              {sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{t(section.title)}</a>
                </li>
              ))}
            </ol>
          </nav>

          <article className="legal-body">
            <section className="legal-summary" aria-labelledby="legal-summary-title">
              <h2 id="legal-summary-title">{t('In short')}</h2>
              <ul>
                {summary.map((line) => (
                  <li key={line}>{t(line, values)}</li>
                ))}
              </ul>
            </section>

            {sections.map((section, index) => (
              <section key={section.id} id={section.id} className="legal-section">
                <h2>
                  <span aria-hidden="true">{index + 1}.</span> {t(section.title)}
                </h2>
                <ul>
                  {section.items.map((line) => (
                    <li key={line}>{t(line, values)}</li>
                  ))}
                </ul>
              </section>
            ))}

            <p className="legal-contact">
              <strong>{t('Questions?')}</strong>{' '}
              {t('Contact us at {email} or {phone}.', { email: SUPPORT_EMAIL, phone: SUPPORT_PHONE })}
            </p>
          </article>
        </div>
      </main>

      <HomeFooter />
    </div>
  )
}
