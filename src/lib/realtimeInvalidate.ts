import type { QueryClient, QueryKey } from '@tanstack/react-query'

/** At most one refetch per data set in this window, however many pushes arrive. */
const WINDOW_MS = 1500

interface Pending {
  timer: ReturnType<typeof setTimeout> | null
  /** When the last refetch was started, to space them out. */
  lastRun: number
  /** A push arrived while waiting: refetch once more at the end of the window. */
  queued: boolean
  predicate?: (queryKey: QueryKey) => boolean
}

const pendingByClient = new WeakMap<QueryClient, Map<string, Pending>>()

/**
 * Refetches the queries under `queryKey` after a realtime push, coalesced: the first push refetches at once, the
 * pushes that follow within the window share one more refetch at its end. A request already running is left to
 * finish instead of being cancelled and sent again.
 *
 * A burst of pushes (the Admin simulation sending a hundred vehicles in, a busy lane) used to start one refetch
 * per push on every open screen. The server still ran each cancelled request, which used up the database
 * connections and froze the other pages.
 */
export function invalidateFromPush(
  queryClient: QueryClient,
  queryKey: QueryKey,
  options: { scope?: string; predicate?: (queryKey: QueryKey) => boolean } = {},
) {
  let pending = pendingByClient.get(queryClient)
  if (!pending) {
    pending = new Map()
    pendingByClient.set(queryClient, pending)
  }
  const id = JSON.stringify(queryKey) + (options.scope ? `|${options.scope}` : '')
  const entry = pending.get(id) ?? { timer: null, lastRun: 0, queued: false }
  entry.predicate = options.predicate
  pending.set(id, entry)

  const run = () => {
    entry.lastRun = Date.now()
    entry.queued = false
    void queryClient.invalidateQueries(
      { queryKey, predicate: entry.predicate ? (q) => entry.predicate!(q.queryKey) : undefined },
      { cancelRefetch: false },
    )
  }

  if (entry.timer) {
    entry.queued = true
    return
  }
  const wait = WINDOW_MS - (Date.now() - entry.lastRun)
  if (wait <= 0) run()
  else entry.queued = true
  entry.timer = setTimeout(
    () => {
      entry.timer = null
      if (entry.queued) run()
    },
    Math.max(wait, WINDOW_MS),
  )
}
