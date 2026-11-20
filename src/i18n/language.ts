/**
 * The UI language of the whole app (every role and the public pages), remembered in this browser.
 * English is the default. The choice sits on <html lang="en|vi">.
 */
export type Language = 'en' | 'vi'

export const LANGUAGES: readonly Language[] = ['en', 'vi']

const KEY = 'xxiv-lang'
const listeners = new Set<() => void>()
/** The choice made in this page, used when the browser blocks storage. */
let picked: Language | null = null

export function readLanguage(): Language {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'en' || saved === 'vi') return saved
  } catch {
    // Storage blocked: fall back to the choice made in this page
  }
  return picked ?? 'en'
}

function apply(language: Language) {
  document.documentElement.lang = language
}

export function setLanguage(language: Language) {
  picked = language
  try {
    localStorage.setItem(KEY, language)
  } catch {
    // Storage blocked: the choice lasts until the page reloads
  }
  apply(language)
  listeners.forEach((l) => l())
}

export function subscribeLanguage(listener: () => void) {
  listeners.add(listener)
  // Another tab changed the language
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return
    apply(readLanguage())
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** BCP 47 locale for Intl number and date formatting. */
export const localeOf = (language: Language) => (language === 'vi' ? 'vi-VN' : 'en-GB')

// Applied before the first render
apply(readLanguage())
