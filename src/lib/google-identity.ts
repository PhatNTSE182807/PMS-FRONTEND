/**
 * Google Identity Services ("Sign in with Google"). The button hands back an ID token
 * (a JWT signed by Google) that the backend verifies before signing the user in.
 * https://developers.google.com/identity/gsi/web
 */

interface CredentialResponse {
  credential: string
}

interface GoogleAccountsId {
  initialize(config: {
    client_id: string
    callback: (response: CredentialResponse) => void
    ux_mode?: 'popup' | 'redirect'
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }): void
  renderButton(
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon'
      theme?: 'outline' | 'filled_blue' | 'filled_black'
      size?: 'large' | 'medium' | 'small'
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
      shape?: 'rectangular' | 'pill' | 'circle' | 'square'
      logo_alignment?: 'left' | 'center'
      width?: number
      locale?: string
    },
  ): void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } }
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

/**
 * The project's OAuth 2.0 Web client ID (Google Cloud Console). It is public by design: Google
 * only accepts it from the origins listed there. VITE_GOOGLE_CLIENT_ID overrides it, and must
 * match GoogleAuth:ClientId on the backend.
 */
const PROJECT_GOOGLE_CLIENT_ID = '338219481698-9e5noh3cim8dpiedco5r9lqb6dv90k53.apps.googleusercontent.com'

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || PROJECT_GOOGLE_CLIENT_ID

let loading: Promise<GoogleAccountsId> | undefined

export function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  loading ??= new Promise<GoogleAccountsId>((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve(window.google.accounts.id)
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () =>
      window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error('Google sign-in did not load.'))
    script.onerror = () => reject(new Error('Could not load Google sign-in. Check your internet connection.'))
    document.head.appendChild(script)
  }).catch((error: unknown) => {
    // Allow a retry on the next mount (e.g. after the connection comes back).
    loading = undefined
    throw error
  })
  return loading
}
