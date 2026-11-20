import { useSyncExternalStore } from 'react'
import { localeOf, readLanguage, setLanguage, subscribeLanguage, type Language } from './language'
import { vi } from './vi'

export { LANGUAGES, localeOf, readLanguage, setLanguage, subscribeLanguage, type Language } from './language'

/**
 * UI translation. The English text is the key: `t('Save changes')` returns it as is in English and the
 * Vietnamese entry of `./vi` in Vietnamese, or the English text when no entry exists yet.
 *
 * Placeholders are written `{name}` and filled from `vars`: `t('{count} bays free', { count: 4 })`.
 *
 * Call `t` while rendering or when an event happens (a toast, a validation message), never at module load:
 * a constant built at import time keeps the language of that moment. Label maps declared at module level
 * keep the English text and are translated where they are shown (`t(STATUS_LABEL[status])`).
 * Changing the language re-mounts the app below <LanguageRoot>, so every screen renders again in the new one.
 */
export function t(text: string, vars?: Record<string, string | number | null | undefined>): string {
  const translated = readLanguage() === 'vi' ? (vi[text] ?? text) : text
  return vars ? interpolate(translated, vars) : translated
}

function interpolate(text: string, vars: Record<string, string | number | null | undefined>): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name] ?? '') : match))
}

/**
 * `t` for a value that may not be text: a label read from a map, an API message, a prop typed ReactNode.
 * Strings are translated; anything else (undefined, a number, an element) is returned unchanged.
 */
export function tMaybe<T>(value: T): T {
  return (typeof value === 'string' && value ? t(value) : value) as T
}

/** The locale of the current language for Intl number and date formatting: 'en-GB' or 'vi-VN'. */
export const currentLocale = () => localeOf(readLanguage())

/** The current UI language and a way to change it. */
export function useLanguage() {
  const language = useSyncExternalStore(subscribeLanguage, readLanguage, (): Language => 'en')
  return {
    language,
    setLanguage,
    toggle: () => setLanguage(language === 'vi' ? 'en' : 'vi'),
  }
}

/** Locale for numbers: 1,250,000 in English, 1.250.000 in Vietnamese. */
export const numberLocale = () => (readLanguage() === 'vi' ? 'vi-VN' : 'en-US')

type DateFormat = Pick<Intl.DateTimeFormat, 'format' | 'formatToParts'>
type NumberFormat = Pick<Intl.NumberFormat, 'format' | 'formatToParts'>

/**
 * `new Intl.DateTimeFormat(locale, options)` in the current language. Safe to declare at module level:
 * the formatter is picked (and cached) each time it is used, so it follows a language change.
 */
export function localDateFormat(options?: Intl.DateTimeFormatOptions): DateFormat {
  const cache = new Map<string, Intl.DateTimeFormat>()
  const get = () => {
    const locale = currentLocale()
    let f = cache.get(locale)
    if (!f) cache.set(locale, (f = new Intl.DateTimeFormat(locale, options)))
    return f
  }
  return { format: (date) => get().format(date), formatToParts: (date) => get().formatToParts(date) }
}

/** `new Intl.NumberFormat(locale, options)` in the current language; safe at module level like localDateFormat. */
export function localNumberFormat(options?: Intl.NumberFormatOptions): NumberFormat {
  const cache = new Map<string, Intl.NumberFormat>()
  const get = () => {
    const locale = numberLocale()
    let f = cache.get(locale)
    if (!f) cache.set(locale, (f = new Intl.NumberFormat(locale, options)))
    return f
  }
  return { format: (value) => get().format(value), formatToParts: (value) => get().formatToParts(value) }
}
