import type { AccountRole } from '@/types/identity.dto'

const TOKEN_KEY = 'pms_token'
const USER_KEY = 'pms_user'
const DEMO_TOKEN_PREFIX = 'demo.'

/** The signed-in account as the UI needs it (cached next to the JWT). */
export interface SessionUser {
  userId: string
  username: string
  fullName: string
  email: string
  phoneNumber: string
  role: AccountRole
  avatarUrl?: string
}

type Listener = (user: SessionUser | null) => void
const listeners = new Set<Listener>()

function read(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function emit(user: SessionUser | null) {
  listeners.forEach((listener) => listener(user))
}

/**
 * Persists the JWT and the cached user. "Remember me" uses localStorage; otherwise the
 * session ends with the browser tab (sessionStorage).
 */
export const session = {
  getToken(): string | null {
    return read(localStorage, TOKEN_KEY) || read(sessionStorage, TOKEN_KEY)
  },

  getUser(): SessionUser | null {
    const raw = read(localStorage, USER_KEY) || read(sessionStorage, USER_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as SessionUser
    } catch {
      return null
    }
  },

  /** Demo sessions run entirely on mock data and never call the backend. */
  isDemo(): boolean {
    return session.getToken()?.startsWith(DEMO_TOKEN_PREFIX) ?? false
  },

  save(token: string, user: SessionUser, remember: boolean) {
    session.clear({ silent: true })
    const storage = remember ? localStorage : sessionStorage
    storage.setItem(TOKEN_KEY, token)
    storage.setItem(USER_KEY, JSON.stringify(user))
    emit(user)
  },

  startDemo(user: SessionUser) {
    session.save(`${DEMO_TOKEN_PREFIX}${user.userId}`, user, true)
  },

  updateUser(patch: Partial<SessionUser>) {
    const current = session.getUser()
    if (!current) return
    const next = { ...current, ...patch }
    const storage = read(localStorage, TOKEN_KEY) ? localStorage : sessionStorage
    storage.setItem(USER_KEY, JSON.stringify(next))
    emit(next)
  },

  clear(options: { silent?: boolean } = {}) {
    for (const storage of [localStorage, sessionStorage]) {
      try {
        storage.removeItem(TOKEN_KEY)
        storage.removeItem(USER_KEY)
      } catch {
        // Storage unavailable; nothing to clear.
      }
    }
    if (!options.silent) emit(null)
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
