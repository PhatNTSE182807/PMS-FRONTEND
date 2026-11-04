import { Suspense, useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { LogOut } from 'lucide-react'
import { LOGO_SRC } from '@/components/ParkingLogo'
import { isTypingTarget } from '@/components/features/staff/staffKeys'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { useAuth, useSignOut } from '@/hooks/useAuth'
import { useDemoIncidents } from '@/hooks/useDemoIncidents'
import { useOpenSessions } from '@/hooks/useGate'
import { useProfile } from '@/hooks/useProfile'
import { useStaffLot } from '@/hooks/useStaffLot'
import { useCashAlerts } from '@/hooks/useCashAlerts'
import { CashDeadlineBanner } from '@/components/features/staff/CashDeadlineBanner'
import { cn } from '@/lib/utils'
import { resolveMediaUrl } from '@/lib/format'
import { session } from '@/lib/session'
import { STAFF_NAV } from './adminNav'

function Kbd({ children }: { children: string }) {
  return <kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-950 ring-1 ring-slate-200">{children}</kbd>
}

function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading page">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  )
}

/** Shell of the Staff POS terminal console (Stitch "Gate Operations" design): top bar and tabs. */
export function StaffLayout() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const { lots, lot, setLotId } = useStaffLot()
  useCashAlerts(lot?.id)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const handleLogout = useSignOut()
  const { open } = useDemoIncidents()
  const openSessions = useOpenSessions(lot?.id)
  const exceptionsCount = openSessions.isSuccess
    ? (openSessions.data?.filter((s) => s.isLostTicket || s.lostTicketStatus === 'Pending' || s.isOverdue || s.plateMismatch).length ?? 0)
    : open.length

  // Sync profile details (FullName, EmployeeCode, Avatar) into session if received from API
  useEffect(() => {
    if (profile) {
      const updates: Record<string, string> = {}
      if (profile.fullName && profile.fullName !== user?.fullName) {
        updates.fullName = profile.fullName
      }
      if (profile.employeeCode && profile.employeeCode !== user?.employeeCode) {
        updates.employeeCode = profile.employeeCode
      }
      if (profile.avatarUrl && profile.avatarUrl !== user?.avatarUrl) {
        updates.avatarUrl = profile.avatarUrl
      }
      if (Object.keys(updates).length > 0) {
        session.updateUser(updates)
      }
    }
  }, [profile, user?.fullName, user?.employeeCode, user?.avatarUrl])

  // F1 Quick Pay and F2 Plate Scan work from every Staff screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.key === 'F1') {
        e.preventDefault()
        void navigate('/staff/checkout')
      } else if (e.key === 'F2') {
        e.preventDefault()
        void navigate('/staff/gate')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  return (
    <div className="admin-root flex min-h-dvh flex-col bg-[#0b141b]">
      <header className="sticky top-0 z-20 bg-[#060f16]/95 shadow-[0_1px_8px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <img src={LOGO_SRC} alt="" className="h-10 w-auto shrink-0 drop-shadow" />
          <div className="leading-tight">
            <p className="font-display text-lg font-bold tracking-wide text-slate-950 uppercase">
              XXIV <span className="text-amber-500">Parking</span>
            </p>
            <p className="text-[11px] font-bold tracking-[0.14em] text-amber-500 uppercase">POS terminal console</p>
          </div>

          <div className="ml-4 hidden min-w-0 items-center gap-2 rounded-lg bg-white px-3 py-1.5 whitespace-nowrap 2xl:flex ring-1 ring-slate-200">
            <span className="text-xs font-semibold text-slate-700 uppercase">Facility</span>
            {lots.isLoading ? (
              <span className="text-sm font-semibold text-slate-400">Loading...</span>
            ) : lots.data && lots.data.length > 1 ? (
              <select
                value={lot?.id}
                onChange={(e) => setLotId(e.target.value)}
                className="max-w-64 cursor-pointer truncate bg-transparent text-sm font-semibold text-slate-950 focus-visible:outline-none"
              >
                {lots.data.map((l) => (
                  <option key={l.id} value={l.id} className="bg-white">
                    {l.name} (#{l.code})
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm font-semibold text-slate-950">
                {lot ? `${lot.name} (#${lot.code})` : 'No lot assigned yet'}
              </span>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3">
              <div className="hidden text-right leading-tight whitespace-nowrap sm:block">
                <p className="text-sm font-semibold text-slate-950">
                  {profile?.fullName || user?.fullName || user?.username}
                </p>
                <p className="text-xs text-slate-700">
                  {[profile?.employeeCode || user?.employeeCode, 'Gate staff'].filter(Boolean).join(' • ')}
                </p>
              </div>
              <img
                src={resolveMediaUrl(profile?.avatarUrl || user?.avatarUrl) || LOGO_SRC}
                alt=""
                className="hidden size-9 rounded-full bg-slate-50 object-cover p-0.5 ring-1 ring-amber-300 sm:block"
              />
              <Button variant="ghost" size="icon" aria-label="Sign out" title="Sign out" onClick={handleLogout}>
                <LogOut />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 bg-slate-50 px-4 sm:px-6">
          <nav aria-label="Staff navigation" className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto py-1.5 [scrollbar-width:none]">
            {STAFF_NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                    isActive ? 'bg-[#124e66] font-bold text-indigo-800' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950',
                  )
                }
              >
                <Icon className="size-4" aria-hidden />
                {label}
                {to === '/staff/exceptions' && exceptionsCount > 0 && (
                  <span className="rounded-full bg-rose-600 px-1.5 text-[11px] font-bold text-white tabular-nums">{exceptionsCount}</span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="hidden shrink-0 items-center gap-4 text-xs text-slate-700 lg:flex">
            <span className="flex items-center gap-1.5">
              <Kbd>F1</Kbd> Quick Pay
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>F2</Kbd> Plate Scan
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:py-8">
        {/* The gate dashboard uses the whole width for its four cameras and the lane panel */}
        <div key={pathname} className={cn('admin-page-enter mx-auto', pathname.startsWith('/staff/gate') ? 'max-w-none' : 'max-w-[1400px]')}>
          <CashDeadlineBanner lotId={lot?.id} />
          <ErrorBoundary
            fallback={(error, reset) => (
              <div className="rounded-xl bg-white ring-1 ring-slate-200">
                <ErrorState message={error.message} onRetry={reset} />
              </div>
            )}
          >
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      <footer className="flex flex-col gap-1 border-t border-slate-200 px-4 py-4 text-[11px] font-semibold tracking-wider text-slate-600 uppercase sm:flex-row sm:justify-between sm:px-6">
        <span>XXIV Parking • Gate console</span>
        <span>All gate operations are logged</span>
      </footer>

      <Toaster position="top-right" theme="dark" richColors closeButton toastOptions={{ className: 'font-sans' }} />
    </div>
  )
}
