/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_USE_MOCK_DATA?: string
  readonly VITE_MOCK_SERVICES?: string
  /** OAuth 2.0 Web client ID for "Sign in with Google"; the button is hidden when empty. */
  readonly VITE_GOOGLE_CLIENT_ID?: string
  /** Google Maps JavaScript API key for the lot directions map; the map is hidden when empty. */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
  /** Plate reader service (backend repo tools/anpr/service.py); development defaults to http://127.0.0.1:8001. */
  readonly VITE_ANPR_SERVICE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
