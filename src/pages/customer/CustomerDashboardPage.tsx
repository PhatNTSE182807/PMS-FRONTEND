import { useState } from 'react'
import { Navigation, Route } from 'lucide-react'
import { LotDirectionsDialog } from '@/components/customer/LotDirectionsDialog'
import { FleetCard } from '@/components/customer/dashboard/FleetCard'
import { NotificationCard } from '@/components/customer/dashboard/NotificationCard'
import { RecentSessions } from '@/components/customer/dashboard/RecentSessions'
import { ActiveSessionCard, ReservationCard } from '@/components/customer/dashboard/SessionCards'
import { UtilitiesCard } from '@/components/customer/dashboard/UtilitiesCard'
import { ZoneMap } from '@/components/customer/dashboard/ZoneMap'
import { isMockService } from '@/config/env'
import { useAuth } from '@/hooks/useAuth'
import { useCapacitySimulation, useParkingCapacity } from '@/hooks/useParking'
import { useProfile, useVehicles } from '@/hooks/useProfile'
import { usePublicLots } from '@/hooks/usePublicLots'
import type { PublicLotDTO } from '@/types/publicLot.dto'
import { t, tMaybe } from '@/i18n'

/** Customer home at /me: the parked vehicle, the next booking, live terminals, the fleet and the history. */
export default function CustomerDashboardPage() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const vehiclesQuery = useVehicles()
  // The system's parking lots with live free bays (same list as the homepage)
  const publicLots = usePublicLots()
  // Demo capacity data: only the map's fallback model when the booking service runs on mock data. The live
  // overview is an Admin / Manager endpoint, so a customer asking for it got a 403 every 15 seconds.
  const demoBooking = isMockService('booking')
  const capacity = useParkingCapacity({ enabled: demoBooking })
  useCapacitySimulation(demoBooking)

  const lots = [...(publicLots.data ?? [])].sort((a, b) => Number(b.isBookable) - Number(a.isBookable) || a.name.localeCompare(b.name))
  const [lotId, setLotId] = useState<string>()
  const selectedLotId = lotId ?? (lots[0] ? String(lots[0].id) : undefined)
  // Lot whose directions map (with the customer's position and route) is open
  const [directionsLot, setDirectionsLot] = useState<PublicLotDTO | null>(null)

  const vehicles = vehiclesQuery.data ?? []
  const name = profile?.fullName || user?.fullName || user?.username || 'Driver'

  return (
    <>
      <section className="cx-welcome">
        <div className="cx-welcome__intro">
          <h1 className="cx-welcome__title">
            {t('Welcome back,')}{' '}<span className="cx-welcome__name">{tMaybe(name)}</span>
          </h1>
          {/* Only a status line while the lot list is loading or unreachable */}
          {(publicLots.isPending || (publicLots.isError && lots.length === 0)) && (
            <p className="cx-welcome__lead">
              {publicLots.isPending ? t('Connecting to the parking network...') : t('The parking network cannot be reached right now.')}
            </p>
          )}
        </div>

        {lots.length > 0 && (
          // One compact row under the greeting, so the customer's name keeps the full width
          <div className="cx-tabs cx-tabs--lots" aria-label={t('Parking lots')}>
            <span className="cx-tabs__label">
              <Navigation aria-hidden />{' '}{t('Lots')}
            </span>
            {lots.map((lot) => (
              <span key={lot.id} className="cx-tab-group">
                <button
                  type="button"
                  className={`cx-tab ${String(lot.id) === selectedLotId ? 'cx-tab--active' : ''}`}
                  title={lot.isBookable ? t('{freeBays} of {totalBays} bays free', { freeBays: lot.freeBays, totalBays: lot.totalBays }) : (tMaybe(lot.maintenanceNotice) ?? t('Under maintenance'))}
                  aria-label={lot.isBookable ? t('{name}, open', { name: lot.name }) : t('{name}, under maintenance', { name: lot.name })}
                  onClick={() => {
                    setLotId(String(lot.id))
                    document.getElementById('map')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                >
                  {/* Green: open for bookings; amber: under maintenance (the reason is in the tooltip) */}
                  <span className={`cx-tab__dot ${lot.isBookable ? 'cx-tab__dot--open' : 'cx-tab__dot--warn'}`} aria-hidden />
                  {tMaybe(lot.name)}
                </button>
                <button
                  type="button"
                  className="cx-tab cx-tab--icon"
                  title={t('Directions to {name}', { name: lot.name })}
                  aria-label={t('Directions to {name}', { name: lot.name })}
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
