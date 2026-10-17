import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  BadgeCheck,
  CircleCheck,
  ClipboardCheck,
  CloudUpload,
  Gauge,
  IdCard,
  Info,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Tag,
  Trash2,
} from 'lucide-react'
import { getErrorMessage } from '@/api/apiError'
import { KIND_ICON, vehicleKind, vehicleTitle } from '@/components/customer/customerFormat'
import { useAuth } from '@/hooks/useAuth'
import { useAddVehicle, useDeleteVehicle, useProfile, useSetDefaultVehicle, useVehicles, useVehicleTypes } from '@/hooks/useProfile'
import type { VehicleDTO, VehicleTypeDTO } from '@/types/profile.dto'

/** Used while the vehicle-type list loads, or if it cannot be fetched (same ids as the backend seed). */
const FALLBACK_TYPES: VehicleTypeDTO[] = [
  { id: 1, code: 'CAR', name: 'Sedan / Hatchback (Car)', sortOrder: 1 },
  { id: 2, code: 'SUV', name: 'SUV / Crossover / 7-Seater', sortOrder: 2 },
  { id: 3, code: 'MOTORBIKE', name: 'Motorbike / Scooter', sortOrder: 3 },
  { id: 4, code: 'EV', name: 'Electric Vehicle (EV)', sortOrder: 4 },
]

const KIND_DESCRIPTION = {
  car: 'Standard parking bay',
  suv: 'Wide bay, 7-seater friendly',
  motorbike: 'Ground & basement 2',
  ev: 'Charger-equipped bay',
} as const

/** Vietnamese plates: 51K-992.88, 30E-1234, 59X1-123.45 (spaces and missing separators allowed). */
const PLATE_PATTERN = /^\d{2}[A-Z]{1,2}\d?[-\s]?\d{3,4}(\.?\d{2})?$/

const EMPTY_FORM = { licensePlate: '', vehicleTypeId: 0, brand: '', model: '', color: '', isDefault: false, consent: false }

/** Best guess at a CSS colour for the swatch next to the colour name ("Gentian Blue" -> blue). */
function swatchColor(name: string): string {
  const words = name.toLowerCase().split(/\s+/).reverse()
  const match = words.find((w) => typeof CSS !== 'undefined' && CSS.supports('color', w))
  return match ?? '#41484c'
}

function MiniVehicle({ vehicle }: { vehicle: VehicleDTO }) {
  const setDefault = useSetDefaultVehicle()
  const remove = useDeleteVehicle()
  const Icon = KIND_ICON[vehicleKind({ name: vehicle.vehicleType })]

  return (
    <div className="cx-mini-vehicle">
      <Icon aria-hidden />
      <div className="cx-mini-vehicle__text">
        <strong>{vehicleTitle(vehicle)}</strong>
        <span className="cx-mono">{vehicle.licensePlate}</span>
      </div>
      {vehicle.isDefault ? (
        <span className="cx-chip cx-chip--gold"><Star aria-hidden /> Primary</span>
      ) : (
        <button
          type="button"
          className="cx-btn cx-btn--sm"
          disabled={setDefault.isPending}
          onClick={() =>
            setDefault.mutate(vehicle.vehicleId, {
              onSuccess: () => toast.success(`${vehicle.licensePlate} is now your primary vehicle.`),
              onError: (error) => toast.error(getErrorMessage(error, 'Could not change the primary vehicle.')),
            })
          }
        >
          Set primary
        </button>
      )}
      <button
        type="button"
        className="cx-icon-btn"
        aria-label={`Remove ${vehicle.licensePlate}`}
        disabled={remove.isPending}
        onClick={() => {
          if (!window.confirm(`Remove ${vehicle.licensePlate} from your fleet?`)) return
          remove.mutate(vehicle.vehicleId, {
            onSuccess: () => toast.success(`${vehicle.licensePlate} removed.`),
            onError: (error) => toast.error(getErrorMessage(error, 'Could not remove the vehicle.')),
          })
        }}
      >
        <Trash2 aria-hidden />
      </button>
    </div>
  )
}

/** /me/vehicles: register a vehicle (Users/profile/vehicles) and manage the existing fleet. */
export default function RegisterVehiclePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const vehiclesQuery = useVehicles()
  const typesQuery = useVehicleTypes()
  const addVehicle = useAddVehicle()

  const vehicles = vehiclesQuery.data ?? []
  const types = [...(typesQuery.data?.length ? typesQuery.data : FALLBACK_TYPES)].sort((a, b) => a.sortOrder - b.sortOrder)

  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const typeId = form.vehicleTypeId || types[0]?.id
  const type = types.find((t) => t.id === typeId)
  const plate = form.licensePlate.trim().toUpperCase()
  const plateValid = PLATE_PATTERN.test(plate)
  // The first vehicle always becomes the primary one.
  const isDefault = vehicles.length === 0 || form.isDefault

  const filled = [plateValid, Boolean(type), Boolean(form.brand.trim()), Boolean(form.model.trim()), Boolean(form.color.trim()), form.consent]
  const progress = Math.round((filled.filter(Boolean).length / filled.length) * 100)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!plateValid) return setError('Enter a valid Vietnamese plate number, for example 51K-992.88.')
    if (!form.brand.trim() || !form.model.trim()) return setError('Enter the manufacturer and the model.')
    if (!form.consent) return setError('Please confirm that you own or are authorised to drive this vehicle.')

    addVehicle.mutate(
      {
        licensePlate: plate,
        vehicleTypeId: typeId,
        brand: form.brand.trim(),
        model: form.model.trim(),
        color: form.color.trim() || 'Black',
        isDefault,
      },
      {
        onSuccess: (vehicle) => {
          toast.success(`${vehicle.licensePlate} registered. Gates will recognise it on your next visit.`)
          setForm(EMPTY_FORM)
        },
        onError: (err) => setError(getErrorMessage(err, 'Could not register the vehicle.')),
      },
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      <header className="cx-page-head">
        <div>
          <nav className="cx-crumbs" aria-label="Breadcrumb">
            <span>Fleet management</span> / <span>My vehicles</span> / <span className="cx-crumbs__current">Register new vehicle</span>
          </nav>
          <h1 className="cx-page-title">Register Vehicle &amp; Upload Documents</h1>
          <p className="cx-page-lead">
            Link your vehicle for automated plate recognition at the barrier and seamless digital billing across all Saigon terminals.
          </p>
        </div>
        <span className="cx-pill">
          <span className="cx-dot cx-dot--gold" aria-hidden="true" /> Plate gateway ready
        </span>
      </header>

      <div className="cx-split">
        <div className="cx-stack">
          <section className="cx-card" aria-labelledby="identification-title">
            <div className="cx-card__head">
              <div className="cx-card__title-row">
                <span className="cx-card__icon"><IdCard aria-hidden /></span>
                <h2 className="cx-card__title" id="identification-title">Vehicle Identification</h2>
              </div>
              <span className="cx-label">Step 1 of 2</span>
            </div>

            <div className="cx-form">
              <div className="cx-field">
                <label className="cx-field__label" htmlFor="vehicle-plate">Official license plate number (Biển số xe)</label>
                <div className="cx-plate-input">
                  <span className="cx-plate-input__country">
                    <span className="cx-plate-input__flag" aria-hidden="true" /> VN
                  </span>
                  <input
                    id="vehicle-plate"
                    value={form.licensePlate}
                    onChange={(e) => setForm({ ...form, licensePlate: e.target.value.toUpperCase() })}
                    placeholder="51K-992.88"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={14}
                    aria-describedby="vehicle-plate-hint"
                  />
                  <span className={`cx-plate-input__state ${plateValid ? 'is-valid' : ''}`} aria-hidden="true">
                    <BadgeCheck />
                  </span>
                </div>
                <p className="cx-field__hint" id="vehicle-plate-hint">
                  Vietnamese format: XXA-XXX.XX or XXA-XXXX. Spaces and separators are accepted.
                </p>
              </div>

              <div className="cx-field">
                <span className="cx-field__label" id="vehicle-category-label">Vehicle category</span>
                <div className="cx-categories" role="radiogroup" aria-labelledby="vehicle-category-label">
                  {types.map((t) => {
                    const kind = vehicleKind(t)
                    const Icon = KIND_ICON[kind]
                    const active = t.id === typeId
                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={`cx-category ${active ? 'cx-category--active' : ''}`}
                        onClick={() => setForm({ ...form, vehicleTypeId: t.id })}
                      >
                        <Icon aria-hidden />
                        <span className="cx-category__text">
                          <span className="cx-category__name">{t.name}</span>
                          <span className="cx-category__desc">{t.description || KIND_DESCRIPTION[kind]}</span>
                        </span>
                        {active && <CircleCheck className="cx-category__check" aria-hidden />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="cx-card" aria-labelledby="make-title">
            <div className="cx-card__head">
              <div className="cx-card__title-row">
                <span className="cx-card__icon"><SlidersHorizontal aria-hidden /></span>
                <h2 className="cx-card__title" id="make-title">Make, Model &amp; Ownership</h2>
              </div>
              <span className="cx-label">Step 2 of 2</span>
            </div>

            <div className="cx-form">
              <div className="cx-grid-2">
                <div className="cx-field">
                  <label className="cx-field__label" htmlFor="vehicle-brand">Manufacturer / brand</label>
                  <div className="cx-control">
                    <span className="cx-control__icon"><Tag aria-hidden /></span>
                    <input id="vehicle-brand" className="cx-input cx-input--with-icon" placeholder="Porsche" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
                  </div>
                </div>
                <div className="cx-field">
                  <label className="cx-field__label" htmlFor="vehicle-model">Model variant</label>
                  <div className="cx-control">
                    <span className="cx-control__icon"><Gauge aria-hidden /></span>
                    <input id="vehicle-model" className="cx-input cx-input--with-icon" placeholder="Taycan 4S" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="cx-field">
                <label className="cx-field__label" htmlFor="vehicle-color">Exterior colour</label>
                <div className="cx-control">
                  <span className="cx-control__icon">
                    <span className="cx-swatch" style={{ background: swatchColor(form.color) }} aria-hidden="true" />
                  </span>
                  <input id="vehicle-color" className="cx-input cx-input--with-icon" placeholder="Gentian Blue Metallic" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                </div>
              </div>

              <label className="cx-check">
                <input
                  type="checkbox"
                  checked={isDefault}
                  disabled={vehicles.length === 0}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                />
                <span>
                  <span className="cx-check__title">Set as primary active vehicle</span>
                  <span className="cx-check__text">
                    {vehicles.length === 0
                      ? 'Your first vehicle is always the primary one.'
                      : 'Prioritise this vehicle for reserved bays and quick-lane entry.'}
                  </span>
                </span>
              </label>

              <label className="cx-check">
                <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
                <span>
                  <span className="cx-check__title">Ownership &amp; plate recognition consent</span>
                  <span className="cx-check__text">
                    I own or am authorised to drive this vehicle, and allow XXIV PARKING to recognise its plate at the gates.
                  </span>
                </span>
              </label>
            </div>
          </section>
        </div>

        <div className="cx-stack">
          <section className="cx-card" aria-labelledby="certificate-title">
            <div className="cx-card__head">
              <div className="cx-card__title-row">
                <span className="cx-card__icon cx-card__icon--gold"><ClipboardCheck aria-hidden /></span>
                <h2 className="cx-card__title" id="certificate-title">Registration Certificate</h2>
              </div>
              <span className="cx-label">Cà vẹt xe</span>
            </div>

            <div className="cx-form">
              <p className="cx-note">
                <Info aria-hidden />
                Photos of the registration certificate (front and back) will be verified automatically once document
                verification goes live. Your plate works at the gates as soon as you register.
              </p>

              <div className="cx-doc-head">
                <span>Front &amp; back side (Mặt trước &amp; Mặt sau)</span>
                <span>Coming soon</span>
              </div>
              <div className="cx-dropzone" aria-disabled="true">
                <span className="cx-dropzone__icon"><CloudUpload aria-hidden /></span>
                <strong>Document upload is not available yet</strong>
                <small>JPEG, PNG or PDF up to 10MB will be accepted</small>
              </div>

              <div className="cx-summary" aria-live="polite">
                <div className="cx-summary__head">
                  <span className="cx-label">Registration summary</span>
                  <span className="cx-label" style={{ color: 'var(--cx-gold)' }}>Complete: {progress}%</span>
                </div>
                <div className="cx-summary__row">
                  Owner <strong>{(profile?.fullName || user?.fullName || '—').toUpperCase()}</strong>
                </div>
                <div className="cx-summary__row">
                  Plate <strong className={plateValid ? 'is-teal' : undefined}>{plate || '—'}</strong>
                </div>
                <div className="cx-summary__row">
                  Category <strong>{type?.name ?? '—'}</strong>
                </div>
                <div className="cx-summary__row">
                  Vehicle <strong>{[form.brand, form.model].map((s) => s.trim()).filter(Boolean).join(' ') || '—'}</strong>
                </div>
                <div className="cx-summary__progress">
                  <span style={{ width: `${progress}%` }} />
                </div>
              </div>

              {error && <p className="cx-error" role="alert">{error}</p>}

              <div className="cx-submit-row">
                <button type="submit" className="cx-btn cx-btn--light" disabled={addVehicle.isPending}>
                  <ScanLine aria-hidden /> {addVehicle.isPending ? 'Registering...' : 'Submit registration'}
                </button>
                <button type="button" className="cx-btn" onClick={() => navigate('/me')}>
                  Cancel
                </button>
              </div>

              <p className="cx-fine">
                <ShieldCheck aria-hidden /> Once registered, barrier gates recognise your plate automatically and open in under a second.
              </p>
            </div>
          </section>

          <section className="cx-card" aria-labelledby="fleet-list-title">
            <div className="cx-card__head" style={{ marginBottom: '1rem' }}>
              <h2 className="cx-card__title" id="fleet-list-title">Your fleet</h2>
              <span className="cx-label">{vehicles.length} registered</span>
            </div>
            {vehiclesQuery.isPending && <div className="cx-skeleton" style={{ height: '4rem' }} />}
            {!vehiclesQuery.isPending && vehicles.length === 0 && <p className="cx-empty">No vehicles registered yet.</p>}
            <div className="cx-mini-list">
              {vehicles.map((v) => (
                <MiniVehicle key={v.vehicleId} vehicle={v} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </form>
  )
}
