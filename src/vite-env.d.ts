/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_USE_MOCK_DATA?: string
  readonly VITE_MOCK_SERVICES?: string
  /** OAuth 2.0 Web client ID for "Sign in with Google"; the button is hidden when empty. */
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
