import { Capabilities } from '@/components/home/Capabilities'
import { CtaBanner } from '@/components/home/CtaBanner'
import { FacilityShowcase } from '@/components/home/FacilityShowcase'
import { HeroSection } from '@/components/home/HeroSection'
import { HomeFooter } from '@/components/home/HomeFooter'
import { HomeNav } from '@/components/home/HomeNav'
import { TerminalNetwork } from '@/components/home/TerminalNetwork'
import { homePathFor, useAuth } from '@/hooks/useAuth'
import { usePublicLots } from '@/hooks/usePublicLots'
import '@/styles/home.css'

/** Public landing page at "/". The terminal cards list the system's parking lots with live free bays. */
export default function HomePage() {
  const { user } = useAuth()
  const publicLots = usePublicLots()

  const lots = publicLots.data ?? []
  const dashboardTo = user ? homePathFor(user.role) : '/register'

  return (
    <div className="home">
      <a href="#terminals" className="home-skip">
        Skip to live terminals
      </a>
      <HomeNav isOnline={!publicLots.isError} />
      <main>
        <HeroSection reserveTo={dashboardTo} />
        <FacilityShowcase />
        <Capabilities />
        <TerminalNetwork
          lots={lots}
          isLoading={publicLots.isPending}
          isError={publicLots.isError}
          onRetry={() => void publicLots.refetch()}
          reserveTo={dashboardTo}
        />
        <CtaBanner isSignedIn={Boolean(user)} dashboardTo={dashboardTo} />
      </main>
      <HomeFooter />
    </div>
  )
}
