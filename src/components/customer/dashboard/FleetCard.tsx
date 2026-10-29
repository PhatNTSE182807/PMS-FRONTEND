import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { IdCard, Info, Plus, Star } from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { useSetDefaultVehicle } from '@/hooks/useProfile'
import type { VehicleDTO } from '@/types/profile.dto'
import { vehicleTitle } from '../customerFormat'

/**
 * Status chip of a vehicle: only a vehicle Staff approved is "Active". Anything still waiting
 * (papers not sent, draft, or under review) is "Pending"; a rejected one says so.
 * AutoVerified is a legacy approved status the API may still return.
 */
function vehicleChip(vehicle: VehicleDTO): { label: string; className: string } {
  if (vehicle.isActive === false) return { label: 'Inactive', className: 'cx-chip--muted' }
  const status: string | null | undefined = vehicle.verificationStatus
  if (status === 'Approved' || status === 'AutoVerified') return { label: 'Active', className: '' }
  if (status === 'Rejected') return { label: 'Rejected', className: 'cx-chip--red' }
  return { label: 'Pending', className: 'cx-chip--gold' }
}

interface FleetCardProps {
  vehicles: VehicleDTO[]
  isLoading: boolean
}

/** The customer's registered vehicles (Users/profile/vehicles). */
export function FleetCard({ vehicles, isLoading }: FleetCardProps) {
  const setDefault = useSetDefaultVehicle()
  // Default first, then in registration order.
  const sorted = [...vehicles].sort((a, b) => Number(b.isDefault) - Number(a.isDefault))

  const makeDefault = (vehicle: VehicleDTO) =>
    setDefault.mutate(vehicle.vehicleId, {
      onSuccess: () => toast.success(`${vehicle.licensePlate} is now your default vehicle.`),
      onError: (error) => toast.error(getErrorMessage(error, 'Could not change the default vehicle.')),
    })

  return (
    <section className="cx-card" aria-labelledby="fleet-title">
      <div className="cx-card__head">
        <div className="cx-card__title-row">
          <span className="cx-card__icon"><IdCard aria-hidden /></span>
          <div>
            <h2 className="cx-card__title" id="fleet-title">Registered Fleet</h2>
            <p className="cx-card__subtitle">Active vehicles for automatic barrier clearance and ticketing</p>
          </div>
        </div>
        <Link to="/me/vehicles" className="cx-btn cx-btn--sm">
          <Plus aria-hidden /> Register vehicle
        </Link>
      </div>

      {isLoading && <div className="cx-skeleton" style={{ height: '7.5rem' }} />}
      {!isLoading && sorted.length === 0 && (
        <p className="cx-empty">
          No vehicles yet. <Link to="/me/vehicles" className="cx-link">Register your first vehicle</Link> to enable plate recognition at the gates.
        </p>
      )}

      {sorted.length > 0 && (
        <div className="cx-fleet">
          {sorted.map((vehicle) => {
            const chip = vehicleChip(vehicle)
            return (
            <article key={vehicle.vehicleId} className={`cx-vehicle ${vehicle.isDefault ? 'cx-vehicle--default' : ''}`}>
              <div className="cx-vehicle__top">
                <span className="cx-label">{vehicle.isDefault ? 'Default vehicle' : 'Secondary'}</span>
                <span className={`cx-chip ${chip.className}`} title={vehicle.verificationNote ?? undefined}>
                  {chip.label}
                </span>
              </div>
              <h3 className="cx-vehicle__name">{vehicleTitle(vehicle)}</h3>
              <p className="cx-vehicle__meta">
                {vehicle.vehicleType}
                {vehicle.color ? ` • ${vehicle.color}` : ''}
              </p>
              <div className="cx-vehicle__bottom">
                <span className="cx-plate">{vehicle.licensePlate}</span>
                {vehicle.isDefault ? (
                  <Star size={16} aria-label="Default vehicle" style={{ color: 'var(--cx-gold)' }} fill="currentColor" />
                ) : (
                  <button
                    type="button"
                    className="cx-link cx-link--gold"
                    style={{ fontSize: '0.8125rem' }}
                    disabled={setDefault.isPending}
                    onClick={() => makeDefault(vehicle)}
                  >
                    Set default
                  </button>
                )}
              </div>
            </article>
            )
          })}
        </div>
      )}

      <p className="cx-footnote">
        <Info aria-hidden /> Cameras recognise your plates automatically at every gate. Parking records attach to the default vehicle.
      </p>
    </section>
  )
}
