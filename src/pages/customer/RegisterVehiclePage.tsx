import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  BadgeCheck,
  CircleCheck,
  ClipboardCheck,
  FileCheck2,
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
import { VehicleDocumentsPanel } from '@/components/customer/VehicleDocumentsPanel'
import { useAuth } from '@/hooks/useAuth'
import { useAddVehicle, useDeleteVehicle, useProfile, useSetDefaultVehicle, useVehicles, useVehicleTypes } from '@/hooks/useProfile'
import { useRejectedVehicles, useVehicleDocumentDraft } from '@/hooks/useVehicleDocuments'
import type { VehicleDTO, VehicleTypeDTO } from '@/types/profile.dto'
import { DOCUMENT_SLOTS } from '@/types/vehicleDocument.dto'

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

// citizenId stays null until edited, so the field shows the account's own Citizen ID
const EMPTY_FORM = { licensePlate: '', vehicleTypeId: 0, brand: '', model: '', color: '', citizenId: null as string | null, isDefault: false, consent: false }
const CITIZEN_ID_PATTERN = /^\d{12}$/

/** Best guess at a CSS colour for the swatch next to the colour name ("Gentian Blue" -> blue). */
function swatchColor(name: string): string {
  const words = name.toLowerCase().split(/\s+/).reverse()
  const match = words.find((w) => typeof CSS !== 'undefined' && CSS.supports('color', w))
  return match ?? '#41484c'
}

/** Registration status chip of a vehicle in the fleet list. */
const REGISTRATION_CHIP: Record<string, { label: string; className: string }> = {
  Approved: { label: 'Approved', className: '' },
  NeedsReview: { label: 'Pending review', className: 'cx-chip--gold' },
  Rejected: { label: 'Rejected', className: 'cx-chip--red' },
  missing: { label: 'Papers missing', className: 'cx-chip--red' },
}

function MiniVehicle({ vehicle, onPapers }: { vehicle: VehicleDTO; onPapers: () => void }) {
  const setDefault = useSetDefaultVehicle()
  const remove = useDeleteVehicle()
  const Icon = KIND_ICON[vehicleKind({ name: vehicle.vehicleType })]
  const chip = REGISTRATION_CHIP[vehicle.verificationStatus && vehicle.verificationStatus !== 'Draft' ? vehicle.verificationStatus : 'missing']

  return (
    <div className="cx-mini-vehicle">
      <Icon aria-hidden />
      <div className="cx-mini-vehicle__text">
        <strong>{vehicleTitle(vehicle)}</strong>
        <span className="cx-mono">{vehicle.licensePlate}</span>
        <span className={`cx-chip ${chip.className}`} title={vehicle.verificationNote ?? undefined}>{chip.label}</span>
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
        aria-label={`Papers of ${vehicle.licensePlate}`}
        title="Papers and review status"
        onClick={onPapers}
      >
        <FileCheck2 aria-hidden />
      </button>
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

const decidedOn = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)) : ''

/**
 * Registrations Staff rejected: those vehicles were removed from the fleet, so they are listed apart
 * with Staff's reason. Registering the same plate again makes the entry go away.
 */
function RejectedRegistrations() {
  const { data: rejected = [] } = useRejectedVehicles()
  if (rejected.length === 0) return null
  return (
    <div className="vd-rejected" role="status">
      <p className="vd-rejected__title">Rejected registrations</p>
      {rejected.map((r) => (
        <div key={r.verificationId} className="vd-rejected__item">
          <div className="vd-rejected__head">
            <strong className="vd-mono">{r.licensePlate}</strong>
            {(r.brand || r.model) && <span>{[r.brand, r.model].filter(Boolean).join(' ')}</span>}
            <span className="cx-chip cx-chip--red">Rejected {decidedOn(r.decidedAt)}</span>
          </div>
          {r.reviewNote && <p>Staff note: {r.reviewNote}</p>}
          <p className="vd-rejected__hint">This vehicle was removed from your fleet. Register it again with new photos.</p>
        </div>
      ))}
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
  // Registration certificate + Citizen ID photos, and the vehicle they belong to (null: the one being registered)
  const papers = useVehicleDocumentDraft()
  const [papersVehicle, setPapersVehicle] = useState<VehicleDTO | null>(null)
  const typeId = form.vehicleTypeId || types[0]?.id
  const type = types.find((t) => t.id === typeId)
  const plate = form.licensePlate.trim().toUpperCase()
  const plateValid = PLATE_PATTERN.test(plate)
  // The first vehicle always becomes the primary one.
  const isDefault = vehicles.length === 0 || form.isDefault
  // Owner on the vehicle papers; defaults to the account's own Citizen ID
  const citizenId = (form.citizenId ?? profile?.citizenId ?? '').trim()
  const citizenIdValid = CITIZEN_ID_PATTERN.test(citizenId)

  // The papers panel holds a fresh set only while it is not showing an existing vehicle
  const newPapersComplete = papersVehicle === null && papers.complete
  const filled = [plateValid, Boolean(type), Boolean(form.brand.trim()), Boolean(form.model.trim()), Boolean(form.color.trim()), citizenIdValid, newPapersComplete, form.consent]
  const progress = Math.round((filled.filter(Boolean).length / filled.length) * 100)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!plateValid) return setError('Enter a valid Vietnamese plate number, for example 51K-992.88.')
    if (!form.brand.trim() || !form.model.trim()) return setError('Enter the manufacturer and the model.')
    if (!citizenIdValid) return setError('Enter the 12-digit Citizen ID of the owner on the vehicle papers.')
    // Every registration needs its papers: Staff compare them before the vehicle can be used
    if (papersVehicle !== null)
      return setError('The papers panel shows another vehicle. Click "New vehicle" and add the papers for this one.')
    if (!papers.complete)
      return setError('Add the front of the registration certificate and both sides of the Citizen ID card.')
    if (!form.consent) return setError('Please confirm that you own or are authorised to drive this vehicle.')

    addVehicle.mutate(
      {
        licensePlate: plate,
        vehicleTypeId: typeId,
        brand: form.brand.trim(),
        model: form.model.trim(),
        color: form.color.trim() || 'Black',
        citizenId,
        isDefault,
      },
      {
        onSuccess: async (vehicle) => {
          setForm(EMPTY_FORM)
          // Then the papers: upload with progress, submit to Staff, and follow the decision on this panel
          setPapersVehicle(vehicle)
          try {
            await papers.uploadAndSubmit(vehicle.vehicleId)
            toast.success(`${vehicle.licensePlate} registered. Staff will check its papers before it can be booked.`)
          } catch (err) {
            setError(getErrorMessage(err, 'The vehicle is saved, but its papers could not be uploaded. Send them again below.'))
          }
        },
        onError: (err) => setError(getErrorMessage(err, 'Could not register the vehicle.')),
      },
    )
  }

  /** Show (and upload) the papers of a vehicle already in the fleet. */
  const openPapers = (vehicle: VehicleDTO) => {
    papers.reset()
    setPapersVehicle(vehicle)
  }

  const closePapers = () => {
    papers.reset()
    setPapersVehicle(null)
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
                <label className="cx-field__label" htmlFor="vehicle-plate">Official license plate number</label>
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

              <div className="cx-field">
                <label className="cx-field__label" htmlFor="vehicle-citizen-id">Owner Citizen ID</label>
                <div className="cx-control">
                  <span className="cx-control__icon"><IdCard aria-hidden /></span>
                  <input
                    id="vehicle-citizen-id"
                    className="cx-input cx-input--with-icon"
                    inputMode="numeric"
                    maxLength={12}
                    autoComplete="off"
                    placeholder="12 digits"
                    value={citizenId}
                    onChange={(e) => setForm({ ...form, citizenId: e.target.value.replace(/\D/g, '') })}
                    aria-describedby="vehicle-citizen-id-hint"
                  />
                </div>
                <p className="cx-field__hint" id="vehicle-citizen-id-hint">
                  The owner named on the vehicle papers. Filled in with your own Citizen ID; change it if the vehicle is in someone else's name.
                </p>
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
              <span className="cx-label">Vehicle papers</span>
            </div>

            <div className="cx-form">
              <p className="cx-note">
                <Info aria-hidden />
                Required: the front of the registration certificate and both sides of your Citizen ID card.
                Our Staff compare them with this form and your profile, then approve the vehicle. You can book
                with it once it is approved.
              </p>

              <VehicleDocumentsPanel
                draft={papers}
                vehicleId={papersVehicle?.vehicleId ?? null}
                vehicleLabel={papersVehicle?.licensePlate}
                onClearVehicle={closePapers}
              />

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
                <div className="cx-summary__row">
                  Papers <strong className={newPapersComplete ? 'is-teal' : undefined}>{papersVehicle ? '—' : `${papers.chosen}/${DOCUMENT_SLOTS.length} files`}</strong>
                </div>
                <div className="cx-summary__progress">
                  <span style={{ width: `${progress}%` }} />
                </div>
              </div>

              {error && <p className="cx-error" role="alert">{error}</p>}

              <div className="cx-submit-row">
                <button type="submit" className="cx-btn cx-btn--light" disabled={addVehicle.isPending || papers.busy}>
                  <ScanLine aria-hidden />{' '}
                  {addVehicle.isPending ? 'Registering...' : papers.busy ? 'Uploading papers...' : 'Submit registration'}
                </button>
                <button type="button" className="cx-btn" onClick={() => navigate('/me')}>
                  Cancel
                </button>
              </div>

              <p className="cx-fine">
                <ShieldCheck aria-hidden /> Once Staff approve the vehicle, barrier gates recognise your plate automatically.
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
                <MiniVehicle key={v.vehicleId} vehicle={v} onPapers={() => openPapers(v)} />
              ))}
            </div>
            <RejectedRegistrations />
          </section>
        </div>
      </div>
    </form>
  )
}
