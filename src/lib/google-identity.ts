/**
 * "Sign in with Google" by full-page redirect (OpenID Connect, response_type=id_token).
 *
 * The browser goes to Google and comes back to /auth/google/callback with an ID token (a JWT signed by
 * Google) in the URL fragment; the backend verifies that token as before. A redirect needs no popup and
 * no third-party cookies, so it also works in Safari on iPhone and iPad, where Google's popup button
 * fails. Every origin's callback URL must be listed under "Authorized redirect URIs" of the OAuth
 * client in Google Cloud Console, e.g. https://<site>/auth/google/callback.
 */

/**
 * The project's OAuth 2.0 Web client ID (Google Cloud Console). It is public by design: Google
 * only accepts it from the URLs listed there. VITE_GOOGLE_CLIENT_ID overrides it, and must
 * match GoogleAuth:ClientId on the backend.
 */
const PROJECT_GOOGLE_CLIENT_ID = '338219481698-9e5noh3cim8dpiedco5r9lqb6dv90k53.apps.googleusercontent.com'

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || PROJECT_GOOGLE_CLIENT_ID

export const GOOGLE_CALLBACK_PATH = '/auth/google/callback'

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const STORAGE_KEY = 'pms.googleSignIn'
// A sign-in left at Google longer than this is started again
const MAX_AGE_MS = 15 * 60_000

interface PendingSignIn {
  state: string
  nonce: string
  rememberMe: boolean
  returnTo?: string
  startedAt: number
}

export interface GoogleRedirectResult {
  idToken: string
  rememberMe: boolean
  returnTo?: string
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Sends the browser to Google's sign-in page; it comes back to GOOGLE_CALLBACK_PATH. */
export function startGoogleSignIn(options: { rememberMe?: boolean; returnTo?: string } = {}): void {
  const pending: PendingSignIn = {
    state: randomToken(),
    nonce: randomToken(),
    rememberMe: options.rememberMe ?? false,
    returnTo: options.returnTo,
    startedAt: Date.now(),
  }
  // sessionStorage stays with this tab, which is the one Google sends back
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending))

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${window.location.origin}${GOOGLE_CALLBACK_PATH}`,
    response_type: 'id_token',
    scope: 'openid email profile',
    state: pending.state,
    nonce: pending.nonce,
    prompt: 'select_account',
  })
  window.location.assign(`${AUTHORIZE_URL}?${params}`)
}

/** The claims of a JWT, without checking its signature (the backend does that). */
function jwtClaims(token: string): Record<string, unknown> {
  const payload = token.split('.')[1] ?? ''
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=')
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
}

/**
 * Reads what Google sent back in the URL fragment of the callback page. The state must be the one this
 * tab sent and the token must carry its nonce, so a token from another sign-in is never accepted.
 * Throws an Error with a message for the user otherwise.
 */
export function finishGoogleSignIn(fragment: string): GoogleRedirectResult {
  const stored = sessionStorage.getItem(STORAGE_KEY)
  sessionStorage.removeItem(STORAGE_KEY)
  const pending = stored ? (JSON.parse(stored) as PendingSignIn) : null

  const params = new URLSearchParams(fragment.replace(/^#/, ''))
  const error = params.get('error')
  if (error === 'access_denied') throw new Error('Google sign-in was cancelled.')
  if (error) throw new Error(`Google sign-in failed (${error}). Please try again.`)

  const idToken = params.get('id_token')
  if (!pending || Date.now() - pending.startedAt > MAX_AGE_MS)
    throw new Error('This Google sign-in has expired. Please try again.')
  if (!idToken || params.get('state') !== pending.state)
    throw new Error('Google sign-in could not be verified. Please try again.')

  let nonce: unknown
  try {
    nonce = jwtClaims(idToken).nonce
  } catch {
    nonce = undefined
  }
  if (nonce !== pending.nonce) throw new Error('Google sign-in could not be verified. Please try again.')

  return { idToken, rememberMe: pending.rememberMe, returnTo: pending.returnTo }
}
