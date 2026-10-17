import { Capabilities } from '@/components/home/Capabilities'
import { CtaBanner } from '@/components/home/CtaBanner'
import { FacilityShowcase } from '@/components/home/FacilityShowcase'
import { HeroSection } from '@/components/home/HeroSection'
import { HomeFooter } from '@/components/home/HomeFooter'
import { HomeNav } from '@/components/home/HomeNav'
import { TerminalNetwork } from '@/components/home/TerminalNetwork'
import { homePathFor, useAuth } from '@/hooks/useAuth'
import { useCapacitySimulation, useParkingCapacity } from '@/hooks/useParking'
import '@/styles/home.css'

/** Public landing page at "/". The terminal cards use the same capacity feed as the admin page. */
export default function HomePage() {
  const { user } = useAuth()
  const capacity = useParkingCapacity()
  // With mock data, vehicles arrive and leave every few seconds so the page feels live.
  useCapacitySimulation(true)

  const lots = capacity.data ?? []
  const dashboardTo = user ? homePathFor(user.role) : '/register'

  return (
    <div className="home">
      <a href="#terminals" className="home-skip">
        Skip to live terminals
      </a>
      <HomeNav isOnline={!capacity.isError} />
      <main>
        <HeroSection lots={lots} isLoading={capacity.isPending} reserveTo={dashboardTo} />
        <FacilityShowcase />
        <Capabilities />
        <TerminalNetwork
          lots={lots}
          isLoading={capacity.isPending}
          isError={capacity.isError}
          reserveTo={dashboardTo}
        />
        <CtaBanner isSignedIn={Boolean(user)} dashboardTo={dashboardTo} />
      </main>
      <HomeFooter />
    </div>
  )
}
