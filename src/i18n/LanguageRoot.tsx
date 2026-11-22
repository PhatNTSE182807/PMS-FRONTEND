import { Fragment, type ReactNode } from 'react'
import { useLanguage } from '@/i18n'

/**
 * Renders its children again from scratch when the language changes, so text translated with `t` while
 * rendering (and memoised values built from it) switches everywhere at once. Data in the React Query cache
 * and the signed-in session sit above it and are kept.
 */
export function LanguageRoot({ children }: { children: ReactNode }) {
  const { language } = useLanguage()
  return <Fragment key={language}>{children}</Fragment>
}
