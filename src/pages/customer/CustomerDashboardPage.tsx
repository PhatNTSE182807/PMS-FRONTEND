import { useState } from 'react'
import { Navigation, Route } from 'lucide-react'
import { LotDirectionsDialog } from '@/components/customer/LotDirectionsDialog'
import { FleetCard } from '@/components/customer/dashboard/FleetCard'
import { NotificationCard } from '@/components/customer/dashboard/NotificationCard'
import { RecentSessions } from '@/components/customer/dashboard/RecentSessions'
import { ActiveSessionCard, ReservationCard } from '@/components/customer/dashboard/SessionCards'
import { UtilitiesCard } from '@/components/customer/dashboard/UtilitiesCard'
import { ZoneMap } from '@/components/customer/dashboard/ZoneMap'
import { useAuth } from '@/hooks/useAuth'
import { useCapacitySimulation, useParkingCapacity } from '@/hooks/useParking'
import { useProfile, useVehicles } from '@/hooks/useProfile'
import { usePublicLots } from '@/hooks/usePublicLots'
import type { PublicLotDTO } from '@/types/publicLot.dto'

/** Customer home at /me: the parked vehicle, the next booking, live terminals, the fleet and the history. */
export default function CustomerDashboardPage() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const vehiclesQuery = useVehicles()
  // The system's parking lots with live free bays (same list as the homepage)
  const publicLots = usePublicLots()
  // Demo capacity data: only the map's fallback model when the booking service runs on mock data
  const capacity = useParkingCapacity()
  useCapacitySimulation(true)

  const lots = [...(publicLots.data ?? [])].sort((a, b) => Number(b.isBookable) - Number(a.isBookable) || a.name.localeCompare(b.name))
  const [lotId, setLotId] = useState<string>()
  const selectedLotId = lotId ?? (lots[0] ? String(lots[0].id) : undefined)
  // Lot whose directions map (with the customer's position and route) is open
  const [directionsLot, setDirectionsLot] = useState<PublicLotDTO | null>(null)

  const vehicles = vehiclesQuery.data ?? []
  const defaultVehicle = vehicles.find((v) => v.isDefault) ?? vehicles[0]
  const name = profile?.fullName || user?.fullName || user?.username || 'Driver'
  const openLots = lots.filter((l) => l.isBookable).length
  const freeBays = lots.filter((l) => l.isBookable).reduce((sum, l) => sum + l.freeBays, 0)

  return (
    <>
      <section className="cx-welcome">
        <div className="cx-welcome__intro">
          <span className="cx-eyebrow">
            <span className="cx-dot cx-dot--gold" aria-hidden="true" /> Client console • Live telemetry
            {defaultVehicle && <span style={{ color: 'var(--cx-on-variant)' }}>• Plate {defaultVehicle.licensePlate} linked</span>}
          </span>
          <h1 className="cx-welcome__title">
            Welcome back, <span className="cx-welcome__name">{name}</span>
          </h1>
          <p className="cx-welcome__lead">
            {publicLots.isPending
              ? 'Connecting to the parking network...'
              : publicLots.isError && lots.length === 0
                ? 'The parking network cannot be reached right now.'
                : `${openLots} of ${lots.length} parking lot${lots.length === 1 ? '' : 's'} open for bookings, ${freeBays.toLocaleString('en-US')} bays free right now.`}
          </p>
        </div>

        {lots.length > 0 && (
          // One compact row under the greeting, so the customer's name keeps the full width
          <div className="cx-tabs cx-tabs--lots" aria-label="Parking lots">
            <span className="cx-tabs__label">
              <Navigation aria-hidden /> Lots
            </span>
            {lots.map((lot) => (
              <span key={lot.id} className="cx-tab-group">
                <button
                  type="button"
                  className={`cx-tab ${String(lot.id) === selectedLotId ? 'cx-tab--active' : ''}`}
                  title={lot.isBookable ? `${lot.freeBays} of ${lot.totalBays} bays free` : (lot.maintenanceNotice ?? 'Under maintenance')}
                  aria-label={lot.isBookable ? `${lot.name}, open` : `${lot.name}, under maintenance`}
                  onClick={() => {
                    setLotId(String(lot.id))
                    document.getElementById('map')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                >
                  {/* Green: open for bookings; amber: under maintenance (the reason is in the tooltip) */}
                  <span className={`cx-tab__dot ${lot.isBookable ? 'cx-tab__dot--open' : 'cx-tab__dot--warn'}`} aria-hidden />
                  {lot.name}
                </button>
                <button
                  type="button"
                  className="cx-tab cx-tab--icon"
                  title={`Directions to ${lot.name}`}
                  aria-label={`Directions to ${lot.name}`}
                  onClick={() => setDirectionsLot(lot)}
                >
                  <Route aria-hidden />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      <div className="cx-row-2">
        <ActiveSessionCard />
        <ReservationCard />
      </div>

      <ZoneMap lots={capacity.data ?? []} isLoading={capacity.isPending} lotId={selectedLotId} onLotChange={setLotId} />

      <div className="cx-row-2">
        <FleetCard vehicles={vehicles} isLoading={vehiclesQuery.isPending} />
        <UtilitiesCard />
      </div>

      <NotificationCard />

      <RecentSessions />

      {directionsLot && <LotDirectionsDialog lot={directionsLot} onClose={() => setDirectionsLot(null)} />}
    </>
  )
}
