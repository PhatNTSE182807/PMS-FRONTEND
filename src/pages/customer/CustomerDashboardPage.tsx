import { useState } from 'react'
import { Navigation } from 'lucide-react'
import { FleetCard } from '@/components/customer/dashboard/FleetCard'
import { RecentSessions } from '@/components/customer/dashboard/RecentSessions'
import { ActiveSessionCard, ReservationCard } from '@/components/customer/dashboard/SessionCards'
import { UtilitiesCard } from '@/components/customer/dashboard/UtilitiesCard'
import { ZoneMap } from '@/components/customer/dashboard/ZoneMap'
import { isOperating } from '@/components/home/capacityStats'
import { useAuth } from '@/hooks/useAuth'
import { useCapacitySimulation, useParkingCapacity } from '@/hooks/useParking'
import { useProfile, useVehicles } from '@/hooks/useProfile'

/** Customer home at /me: live terminals and the customer's own fleet (plus demo session data). */
export default function CustomerDashboardPage() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const vehiclesQuery = useVehicles()
  const capacity = useParkingCapacity()
  useCapacitySimulation(true)

  const lots = capacity.data ?? []
  const [lotId, setLotId] = useState<string>()
  const selectedLotId = lotId ?? lots[0]?.id

  const vehicles = vehiclesQuery.data ?? []
  const defaultVehicle = vehicles.find((v) => v.isDefault) ?? vehicles[0]
  const name = profile?.fullName || user?.fullName || user?.username || 'Driver'
  const openLots = lots.filter(isOperating).length

  return (
    <>
      <section className="cx-welcome">
        <div>
          <span className="cx-eyebrow">
            <span className="cx-dot cx-dot--gold" aria-hidden="true" /> Client console • Live telemetry
            {defaultVehicle && <span style={{ color: 'var(--cx-on-variant)' }}>• Plate {defaultVehicle.licensePlate} linked</span>}
          </span>
          <h1 className="cx-welcome__title">
            Welcome back, <span className="cx-welcome__name">{name}</span>
          </h1>
          <p className="cx-welcome__lead">
            {capacity.isPending
              ? 'Connecting to the Saigon terminal network...'
              : `Saigon metropolitan terminal status operational. ${openLots} automated hub${openLots === 1 ? '' : 's'} active in Ho Chi Minh City.`}
          </p>
        </div>

        {lots.length > 0 && (
          <div className="cx-tabs" aria-label="HCMC hubs">
            <span className="cx-tabs__label">
              <Navigation aria-hidden /> HCMC hubs:
            </span>
            {lots.slice(0, 3).map((lot) => (
              <button
                key={lot.id}
                type="button"
                className={`cx-tab ${lot.id === selectedLotId ? 'cx-tab--active' : ''}`}
                onClick={() => {
                  setLotId(lot.id)
                  document.getElementById('map')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              >
                {lot.name}
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="cx-row-2">
        <ActiveSessionCard vehicle={defaultVehicle} />
        <ReservationCard vehicle={defaultVehicle} />
      </div>

      <ZoneMap lots={lots} isLoading={capacity.isPending} lotId={selectedLotId} onLotChange={setLotId} />

      <div className="cx-row-2">
        <FleetCard vehicles={vehicles} isLoading={vehiclesQuery.isPending} />
        <UtilitiesCard />
      </div>

      <RecentSessions plates={vehicles.map((v) => v.licensePlate)} />
    </>
  )
}
