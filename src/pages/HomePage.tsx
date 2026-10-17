import { useState } from 'react'
import { FaqSection, HomeFooter } from '@/components/home/FaqSection'
import { FeeEstimator } from '@/components/home/FeeEstimator'
import { HeroSection } from '@/components/home/HeroSection'
import { HomeNav } from '@/components/home/HomeNav'
import { HowItWorks } from '@/components/home/HowItWorks'
import { LiveAvailability } from '@/components/home/LiveAvailability'
import { useCapacitySimulation, useParkingCapacity } from '@/hooks/useParking'
import '@/styles/home.css'

/** Public landing page at "/". Live availability uses the same capacity feed as the admin page. */
export default function HomePage() {
  const capacity = useParkingCapacity()
  // With mock data, vehicles arrive and leave every few seconds so the page feels live.
  useCapacitySimulation(true)

  const [search, setSearch] = useState('')
  const lots = capacity.data ?? []

  const searchFromHero = (query: string) => {
    setSearch(query)
    document.getElementById('availability')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="home">
      <a href="#availability" className="home-skip">
        Skip to live availability
      </a>
      <HomeNav />
      <main>
        <HeroSection lots={lots} isLoading={capacity.isPending} onSearch={searchFromHero} />
        <LiveAvailability
          lots={lots}
          isLoading={capacity.isPending}
          isError={capacity.isError}
          updatedAt={capacity.dataUpdatedAt}
          search={search}
          onSearchChange={setSearch}
        />
        <HowItWorks />
        <FeeEstimator />
        <FaqSection />
      </main>
      <HomeFooter />
    </div>
  )
}
