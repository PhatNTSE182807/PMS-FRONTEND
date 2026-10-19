import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from '@microsoft/signalr'
import { getApiBaseUrl, isMockService } from '@/config/env'
import { session } from '@/lib/session'

/** Server → client event of PMS.API VehicleVerificationHub (/api/hubs/vehicle-verifications). Ids and status only. */
export interface VerificationChangedEvent {
  verificationId: string
  vehicleId: string
  status: string
}

type Listener = (event: VerificationChangedEvent) => void

const listeners = new Set<Listener>()
let connection: HubConnection | null = null

function hub(): HubConnection {
  if (connection) return connection
  connection = new HubConnectionBuilder()
    // Private channel: the JWT goes in ?access_token= because WebSockets cannot carry headers.
    // No cookies: the API allows any origin only without credentials.
    .withUrl(`${getApiBaseUrl()}/hubs/vehicle-verifications`, {
      accessTokenFactory: () => session.getToken() ?? '',
      withCredentials: false,
    })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build()
  connection.on('VerificationChanged', (event: VerificationChangedEvent) => listeners.forEach((l) => l(event)))
  return connection
}

/**
 * Pushes paper-check status changes for the signed-in user. Mock and demo sessions have no hub,
 * so callers keep polling while a check runs.
 */
export const vehicleVerificationRealtime = {
  isAvailable: () => !isMockService('profile'),

  /** Receives events until the returned function is called. */
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    const c = hub()
    if (c.state === HubConnectionState.Disconnected) {
      c.start().catch(() => {
        // Hub unreachable: polling covers it
      })
    }
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0 && connection?.state === HubConnectionState.Connected) {
        void connection.stop()
      }
    }
  },
}
