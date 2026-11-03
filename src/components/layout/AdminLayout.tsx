import { Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ChevronRight, LogOut, Menu } from 'lucide-react'
import { LOGO_SRC } from '@/components/ParkingLogo'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle, NavDrawerContent } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { roleLabel, useAuth, useSignOut } from '@/hooks/useAuth'
import { useManagerLot } from '@/hooks/useManagerLot'
import { useProfile } from '@/hooks/useProfile'
import { resolveMediaUrl } from '@/lib/format'
import { session } from '@/lib/session'
import { cn } from '@/lib/utils'
import { ADMIN_NAV, MANAGER_NAV } from './adminNav'

/** Manager top bar: which assigned lot the console is showing. */
function ManagerLotSelect() {
  const { lots, lot, setLotId } = useManagerLot()
  if (!lots.data?.length) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 ring-1 ring-slate-200">
        <span className="text-xs font-semibold text-slate-700 uppercase">Facility</span>
        <span className="text-sm font-semibold text-slate-500 italic">No facility assigned</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 ring-1 ring-slate-200">
        <span className="text-xs font-semibold text-slate-700 uppercase">Facility</span>
        {lots.data.length > 1 ? (
          <select
            value={lot?.id}
            onChange={(e) => setLotId(e.target.value)}
            className="max-w-56 cursor-pointer truncate bg-transparent text-sm font-semibold text-slate-950 focus-visible:outline-none sm:max-w-64"
          >
            {lots.data.map((l) => (
              <option key={l.id} value={l.id} className="bg-white">
                {l.name} (#{l.code})
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm font-semibold text-slate-950">
            {lot ? `${lot.name} (#${lot.code})` : '—'}
          </span>
        )}
      </div>

      <div className="hidden min-w-0 items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 whitespace-nowrap xl:flex ring-1 ring-slate-200/60">
        <span className="text-xs font-semibold text-indigo-700 uppercase">Station</span>
        <span className="text-sm font-semibold text-slate-950">
          Central Hub & All Zones {lot ? `(${lot.code})` : ''}
        </span>
      </div>
    </div>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth()
  const navigation = user?.role === 'MANAGER' ? MANAGER_NAV : ADMIN_NAV
  return (
    <div className="flex h-full w-full flex-col border-r border-slate-200 bg-[#101920] text-slate-700">
      <div className="flex items-center gap-3 px-4 pt-4 pb-5">
        <img src={LOGO_SRC} alt="" className="h-11 w-auto shrink-0 drop-shadow" />
        <div className="leading-tight">
          <p className="font-display text-lg font-bold tracking-wide text-slate-950">
            XXIV <span className="text-amber-500">PARKING</span>
          </p>
          <p className="text-xs font-bold tracking-[0.14em] text-indigo-700 uppercase">
            {user?.role === 'MANAGER' ? 'Manager console' : 'Admin command'}
          </p>
        </div>
      </div>

      <nav aria-label="Admin navigation" className="flex-1 space-y-1 px-3 py-4">
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors',
                isActive ? 'bg-[#124e66] text-indigo-800' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn('size-5', isActive ? 'text-indigo-800' : 'text-slate-500 group-hover:text-amber-500')}
                  aria-hidden
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading page">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  )
}

/** Shell of the admin dashboard: sidebar navigation, top bar and page outlet. */
export function AdminLayout() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const { pathname } = useLocation()
  const [isNavOpen, setIsNavOpen] = useState(false)

  // Sync profile details into session if received from API
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

  const current = [...ADMIN_NAV, ...MANAGER_NAV].find((item) => pathname.startsWith(item.to))

  const handleLogout = useSignOut()

  return (
    <div className="admin-root min-h-dvh bg-[#0b141b]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 lg:flex">
        <SidebarContent />
      </aside>

      {/* Mobile navigation drawer */}
      <Dialog open={isNavOpen} onOpenChange={setIsNavOpen}>
        <NavDrawerContent aria-describedby={undefined}>
          <DialogTitle className="sr-only">Admin menu</DialogTitle>
          <SidebarContent onNavigate={() => setIsNavOpen(false)} />
        </NavDrawerContent>
      </Dialog>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-[#0b141b]/90 px-4 backdrop-blur sm:px-6 lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" onClick={() => setIsNavOpen(true)}>
            <Menu />
          </Button>

          {user?.role === 'MANAGER' && <ManagerLotSelect />}

          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
            <span className="hidden text-slate-500 sm:inline">Administration</span>
            <ChevronRight className="hidden size-4 text-slate-400 sm:inline" aria-hidden />
            <span className="truncate font-medium text-slate-900">{current?.label ?? 'Overview'}</span>
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3">
              <img
                src={resolveMediaUrl(profile?.avatarUrl || user?.avatarUrl) || LOGO_SRC}
                alt=""
                className="size-9 rounded-full bg-slate-50 object-cover p-0.5 ring-1 ring-amber-300"
              />
              <div className="hidden leading-tight md:block">
                <p className="text-sm font-semibold text-slate-950">
                  {profile?.fullName || user?.fullName || user?.username}
                </p>
                <p className="text-xs font-bold tracking-wide text-amber-500 uppercase">
                  {profile?.employeeCode ? `${profile.employeeCode} • ` : user?.employeeCode ? `${user.employeeCode} • ` : ''}{roleLabel(user?.role)}
                </p>
              </div>
              <Button variant="ghost" size="icon" aria-label="Sign out" title="Sign out" onClick={handleLogout}>
                <LogOut />
              </Button>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div key={pathname} className="admin-page-enter mx-auto max-w-7xl">
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
      </div>

      <Toaster position="top-right" theme="dark" richColors closeButton toastOptions={{ className: 'font-sans' }} />
    </div>
  )
}
