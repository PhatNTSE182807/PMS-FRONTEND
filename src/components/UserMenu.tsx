import { useEffect, useId, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronLeft, ChevronRight, Languages, LogOut, Moon, Settings, Sun } from 'lucide-react'
import { useColorTheme } from '@/hooks/useColorTheme'
import { t, useLanguage } from '@/i18n'
import { cn } from '@/lib/utils'
import '@/styles/user-menu.css'

export type UserMenuItem = {
  label: string
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  /** A page of the app; the item is marked while that page is open. */
  to?: string
  onSelect?: () => void
}

type UserMenuProps = {
  name: string
  /** Second line of the menu header: email, employee code, role… */
  subtitle?: ReactNode
  avatarUrl?: string | null
  /** Shown in the avatar circle when there is no picture. */
  initials: string
  /** Extra block under the header, e.g. the customer's wallet balance. */
  extra?: ReactNode
  items?: UserMenuItem[]
  onSignOut: () => void
  className?: string
}

/**
 * Account menu of the top bar, the same for every role: the avatar and name open a panel with the pages of the
 * account, Settings (light/dark mode and language) and Sign out.
 */
export function UserMenu({ name, subtitle, avatarUrl, initials, extra, items = [], onSignOut, className }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<'main' | 'settings'>('main')
  const rootRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const { pathname } = useLocation()
  const { theme, setTheme } = useColorTheme()
  const { language, setLanguage } = useLanguage()

  const close = () => {
    setIsOpen(false)
    setView('main')
  }

  // Close on a click outside or Escape
  useEffect(() => {
    if (!isOpen) return
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen])

  // Close when a page of the menu opens
  const [openedAt, setOpenedAt] = useState(pathname)
  if (openedAt !== pathname) {
    setOpenedAt(pathname)
    if (isOpen) close()
  }

  const avatar = (
    <span className="user-menu__avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : initials}</span>
  )

  return (
    <div ref={rootRef} className={cn('user-menu', className)}>
      <button
        type="button"
        className="user-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => (isOpen ? close() : setIsOpen(true))}
      >
        {avatar}
        <span className="user-menu__trigger-name">{name}</span>
        <ChevronDown className="user-menu__chevron" aria-hidden />
      </button>

      {isOpen && (
        <div id={panelId} className="user-menu__panel" role="menu">
          {view === 'main' ? (
            <>
              <div className="user-menu__head">
                {avatar}
                <div className="user-menu__head-text">
                  <p className="user-menu__name">{name}</p>
                  {subtitle && <p className="user-menu__subtitle">{subtitle}</p>}
                </div>
              </div>
              {extra && <div className="user-menu__extra">{extra}</div>}

              {items.length > 0 && (
                <div className="user-menu__group">
                  {items.map(({ label, icon: Icon, to, onSelect }) =>
                    to ? (
                      <Link
                        key={label}
                        to={to}
                        role="menuitem"
                        className={cn('user-menu__item', pathname === to && 'user-menu__item--active')}
                        onClick={close}
                      >
                        <Icon className="user-menu__icon" aria-hidden />
                        {label}
                      </Link>
                    ) : (
                      <button
                        key={label}
                        type="button"
                        role="menuitem"
                        className="user-menu__item"
                        onClick={() => {
                          close()
                          onSelect?.()
                        }}
                      >
                        <Icon className="user-menu__icon" aria-hidden />
                        {label}
                      </button>
                    ),
                  )}
                </div>
              )}

              <div className="user-menu__group">
                <button type="button" role="menuitem" className="user-menu__item" onClick={() => setView('settings')}>
                  <Settings className="user-menu__icon" aria-hidden />
                  {t('Settings')}
                  <ChevronRight className="user-menu__trail" aria-hidden />
                </button>
              </div>

              <div className="user-menu__group">
                <button
                  type="button"
                  role="menuitem"
                  className="user-menu__item user-menu__item--danger"
                  onClick={() => {
                    close()
                    onSignOut()
                  }}
                >
                  <LogOut className="user-menu__icon" aria-hidden />
                  {t('Logout')}
                </button>
              </div>
            </>
          ) : (
            <>
              <button type="button" className="user-menu__back" onClick={() => setView('main')}>
                <ChevronLeft className="user-menu__icon" aria-hidden />
                {t('Settings')}
              </button>

              <div className="user-menu__setting">
                <p className="user-menu__setting-label">{t('Appearance')}</p>
                <div className="user-menu__segment" role="radiogroup" aria-label={t('Appearance')}>
                  <SegmentButton isOn={theme === 'light'} onClick={() => setTheme('light')}>
                    <Sun aria-hidden /> {t('Light')}
                  </SegmentButton>
                  <SegmentButton isOn={theme === 'dark'} onClick={() => setTheme('dark')}>
                    <Moon aria-hidden /> {t('Dark')}
                  </SegmentButton>
                </div>
              </div>

              <div className="user-menu__setting">
                <p className="user-menu__setting-label">
                  <Languages aria-hidden /> {t('Language')}
                </p>
                <div className="user-menu__segment" role="radiogroup" aria-label={t('Language')}>
                  {/* Each language is written in itself so it can be found from the other one */}
                  <SegmentButton isOn={language === 'en'} onClick={() => setLanguage('en')}>
                    English
                  </SegmentButton>
                  <SegmentButton isOn={language === 'vi'} onClick={() => setLanguage('vi')}>
                    Tiếng Việt
                  </SegmentButton>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function SegmentButton({ isOn, onClick, children }: { isOn: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isOn}
      className={cn('user-menu__segment-btn', isOn && 'user-menu__segment-btn--on')}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
