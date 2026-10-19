import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from '@microsoft/signalr'
import { getApiBaseUrl, isMockService } from '@/config/env'

/** Server → client events of PMS.API LotHub (/api/hubs/lots). Public: ids and statuses, never plates. */
export interface SlotStatusChangedEvent {
  lotId: number
  slotId: number
  status: string
}
export interface LotStatusChangedEvent {
  lotId: number
  status: string
}
export interface LayoutChangedEvent {
  lotId: number
}

export type LotEvent =
  | ({ type: 'SlotStatusChanged' } & SlotStatusChangedEvent)
  | ({ type: 'LotStatusChanged' } & LotStatusChangedEvent)
  | ({ type: 'LayoutChanged' } & LayoutChangedEvent)

interface Watcher {
  onEvent: (event: LotEvent) => void
  onConnectionChange: (connected: boolean) => void
}

const watchers = new Map<string, Set<Watcher>>()
let connection: HubConnection | null = null

const allWatchers = () => [...watchers.values()].flatMap((set) => [...set])
const notifyConnection = () => {
  const connected = connection?.state === HubConnectionState.Connected
  allWatchers().forEach((w) => w.onConnectionChange(connected))
}

/** Groups are lost when the connection drops, so every watched lot is joined again. */
async function joinAll(hub: HubConnection) {
  await Promise.all([...watchers.keys()].map((lotId) => hub.invoke('JoinLot', Number(lotId))))
}

function hub(): HubConnection {
  if (connection) return connection
  const built = new HubConnectionBuilder()
    // The API allows any origin without credentials; the channel is public.
    .withUrl(`${getApiBaseUrl()}/hubs/lots`, { withCredentials: false })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build()
  const dispatch = (type: LotEvent['type']) => (payload: { lotId: number }) =>
    watchers.get(String(payload.lotId))?.forEach((w) => w.onEvent({ type, ...payload } as LotEvent))
  built.on('SlotStatusChanged', dispatch('SlotStatusChanged'))
  built.on('LotStatusChanged', dispatch('LotStatusChanged'))
  built.on('LayoutChanged', dispatch('LayoutChanged'))
  built.onreconnecting(notifyConnection)
  built.onreconnected(() => joinAll(built).finally(notifyConnection))
  built.onclose(notifyConnection)
  connection = built
  return built
}

let starting: Promise<void> | null = null
async function ensureStarted(): Promise<HubConnection> {
  const c = hub()
  if (c.state === HubConnectionState.Disconnected) starting ??= c.start().finally(() => (starting = null))
  if (starting) await starting
  return c
}

/**
 * Real-time lot channel (SignalR). Mock and demo sessions have no hub, so callers keep polling.
 */
export const lotRealtime = {
  isAvailable: () => !isMockService('parking'),

  /** Receives the lot's events until the returned function is called. */
  watch(lotId: string, watcher: Watcher): () => void {
    const set = watchers.get(lotId) ?? new Set<Watcher>()
    const first = set.size === 0
    set.add(watcher)
    watchers.set(lotId, set)

    ensureStarted()
      .then(async (c) => {
        if (first && c.state === HubConnectionState.Connected) await c.invoke('JoinLot', Number(lotId))
      })
      .catch(() => {
        // Hub unreachable: the caller keeps polling; automatic reconnect only runs after a first connection.
      })
      .finally(notifyConnection)

    return () => {
      set.delete(watcher)
      if (set.size > 0) return
      watchers.delete(lotId)
      if (connection?.state !== HubConnectionState.Connected) return
      if (watchers.size === 0) void connection.stop()
      else void connection.invoke('LeaveLot', Number(lotId)).catch(() => undefined)
    }
  },
}
