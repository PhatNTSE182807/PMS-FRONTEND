import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from '@microsoft/signalr'
import { getApiBaseUrl, isMockService } from '@/config/env'
import { session } from '@/lib/session'

/**
 * Server → client events of PMS.API ParkingOpsHub (/api/hubs/parking-ops). Customers receive their own
 * reservation and payment changes; Staff and Managers join a lot and receive its sessions, payments,
 * zone counters and alerts.
 */
export type ParkingOpsEvent =
  | { type: 'ReservationChanged'; reservationId: number; lotId: number; status: string; slotId: number | null }
  | { type: 'ReservationReminder'; reservationId: number; kind: 'Arrival' | 'HoldEnding'; at: string }
  | { type: 'PaymentChanged'; paymentId: number; status: string; purpose: string; reservationId: number | null; sessionId: number | null }
  | { type: 'SessionChanged'; lotId: number; sessionId: number; status: string; plateNumber: string }
  | { type: 'ZoneCounterChanged'; lotId: number; zoneId: number; availableSpaces: number; occupiedSpaces: number; totalCapacity: number }
  | { type: 'OpsAlert'; lotId: number; code: string; message: string; sessionId: number | null }

type Listener = (event: ParkingOpsEvent) => void

const EVENTS: ParkingOpsEvent['type'][] = ['ReservationChanged', 'ReservationReminder', 'PaymentChanged', 'SessionChanged', 'ZoneCounterChanged', 'OpsAlert']

const listeners = new Set<Listener>()
const joinedLots = new Map<string, number>()
let connection: HubConnection | null = null
let starting: Promise<void> | null = null

function hub(): HubConnection {
  if (connection) return connection
  connection = new HubConnectionBuilder()
    // Private channel: the JWT goes in ?access_token= because WebSockets cannot carry headers.
    .withUrl(`${getApiBaseUrl()}/hubs/parking-ops`, {
      accessTokenFactory: () => session.getToken() ?? '',
      withCredentials: false,
    })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build()
  for (const type of EVENTS) {
    connection.on(type, (payload: object) => listeners.forEach((l) => l({ type, ...payload } as ParkingOpsEvent)))
  }
  // Groups are lost on reconnect: join the lots again
  connection.onreconnected(() => {
    for (const lotId of joinedLots.keys()) void connection?.invoke('JoinLot', Number(lotId)).catch(() => undefined)
  })
  return connection
}

async function ensureStarted(): Promise<HubConnection> {
  const c = hub()
  if (c.state === HubConnectionState.Disconnected) {
    starting ??= c.start().finally(() => {
      starting = null
    })
  }
  if (starting) await starting
  return c
}

/** Demo and mock sessions have no hub: callers keep polling. */
export const parkingOpsRealtime = {
  isAvailable: (service: 'booking' | 'gate') => !isMockService(service) && Boolean(session.getToken()),

  /** Receives events until the returned function is called; `lotId` also joins that lot's Staff channel. */
  subscribe(listener: Listener, lotId?: string): () => void {
    listeners.add(listener)
    ensureStarted()
      .then((c) => {
        if (!lotId) return
        joinedLots.set(lotId, (joinedLots.get(lotId) ?? 0) + 1)
        return c.invoke('JoinLot', Number(lotId))
      })
      .catch(() => {
        // Hub unreachable or lot outside the caller's scope: polling covers it
      })

    return () => {
      listeners.delete(listener)
      if (lotId) {
        const left = (joinedLots.get(lotId) ?? 1) - 1
        if (left <= 0) {
          joinedLots.delete(lotId)
          if (connection?.state === HubConnectionState.Connected) void connection.invoke('LeaveLot', Number(lotId)).catch(() => undefined)
        } else joinedLots.set(lotId, left)
      }
      if (listeners.size === 0 && connection?.state === HubConnectionState.Connected) void connection.stop()
    }
  },
}
