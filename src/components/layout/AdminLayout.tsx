import { Suspense, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ChevronRight, LogOut, Menu } from 'lucide-react'
import { LOGO_SRC } from '@/components/ParkingLogo'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle, NavDrawerContent } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { isMockService } from '@/config/env'
import { roleLabel, useAuth } from '@/hooks/useAuth'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ADMIN_NAV, MANAGER_NAV } from './adminNav'

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth()
  const navigation = user?.role === 'MANAGER' ? MANAGER_NAV : ADMIN_NAV
  return (
    <div className="flex h-full w-full flex-col bg-slate-950 text-slate-300">
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
        <img src={LOGO_SRC} alt="" className="h-10 w-auto shrink-0 drop-shadow" />
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">XXIV Parking</p>
          <p className="text-xs text-slate-400">Admin console</p>
        </div>
      </div>

      <nav aria-label="Admin navigation" className="flex-1 space-y-1 px-3 py-5">
        <p className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Administration</p>
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-indigo-500/15 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn('size-4.5', isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300')} aria-hidden />
                {label}
                {isActive && <span className="ml-auto size-1.5 rounded-full bg-indigo-400" aria-hidden />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 px-5 py-4 text-xs text-slate-500">XXIV Parking</div>
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
  const { user, isDemo, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [isNavOpen, setIsNavOpen] = useState(false)

  const current = [...ADMIN_NAV, ...MANAGER_NAV].find((item) => pathname.startsWith(item.to))
  const usesMockData = isDemo || isMockService('staff') || isMockService('parking') || isMockService('reports')

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="admin-root min-h-dvh bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:flex">
        <SidebarContent />
      </aside>

      {/* Mobile navigation drawer */}
      <Dialog open={isNavOpen} onOpenChange={setIsNavOpen}>
        <NavDrawerContent aria-describedby={undefined}>
          <DialogTitle className="sr-only">Admin menu</DialogTitle>
          <SidebarContent onNavigate={() => setIsNavOpen(false)} />
        </NavDrawerContent>
      </Dialog>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur sm:px-6 lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" onClick={() => setIsNavOpen(true)}>
            <Menu />
          </Button>

          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
            <span className="hidden text-slate-500 sm:inline">Administration</span>
            <ChevronRight className="hidden size-4 text-slate-300 sm:inline" aria-hidden />
            <span className="truncate font-medium text-slate-900">{current?.label ?? 'Overview'}</span>
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {usesMockData && (
              <Badge tone="amber" title="Some services are using mock data instead of the real API.">
                Sample data
              </Badge>
            )}
            <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3">
              <div className="grid size-8 place-items-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                {initials(user?.fullName ?? 'A')}
              </div>
              <div className="hidden leading-tight md:block">
                <p className="text-sm font-medium text-slate-900">{user?.fullName}</p>
                <p className="text-xs text-slate-500">{roleLabel(user?.role)}</p>
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

      <Toaster position="top-right" richColors closeButton toastOptions={{ className: 'font-sans' }} />
    </div>
  )
}
