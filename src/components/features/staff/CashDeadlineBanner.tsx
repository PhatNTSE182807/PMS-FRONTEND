import { Link } from 'react-router-dom'
import { AlarmClock } from 'lucide-react'
import { useCashDrawer } from '@/hooks/useCashDrawer'
import { useNow } from '@/hooks/useNow'
import { cn } from '@/lib/utils'

/** The banner shows once the deadline is this close (or past). */
const SHOW_WITHIN_MS = 60 * 60_000

const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** "4:05" or "1:02:03" */
function countdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/**
 * Staff console: when the open cash drawer must be closed soon (23:00, or a simulated end of day), a banner
 * with a countdown and a shortcut to the cash tally; red once the deadline has passed (the Manager was told).
 */
export function CashDeadlineBanner({ lotId }: { lotId: string | undefined }) {
  const now = useNow(1000)
  const { data: drawer } = useCashDrawer(lotId)
  if (drawer?.status !== 'Open' || !drawer.closeDueAt) return null

  const left = Date.parse(drawer.closeDueAt) - now
  if (left > SHOW_WITHIN_MS) return null
  const overdue = left <= 0

  return (
    <div
      role="status"
      className={cn(
        'mb-6 flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-sm ring-1',
        overdue ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-amber-50 text-amber-800 ring-amber-200',
      )}
    >
      <AlarmClock className="size-5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        {overdue
          ? `Your cash drawer should have been closed at ${clock.format(Date.parse(drawer.closeDueAt))}: your Manager has been told. Close it now.`
          : `The business day is ending: close your cash drawer by ${clock.format(Date.parse(drawer.closeDueAt))}.`}
      </span>
      {!overdue && <span className="font-mono text-lg font-bold tabular-nums">{countdown(left)}</span>}
      <Link to="/staff/cash-tally" className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-950 ring-1 ring-slate-200 hover:bg-slate-100">
        Count and close now
      </Link>
    </div>
  )
}
