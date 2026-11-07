import { useState, type CSSProperties } from 'react'
import { BayVehicleCard, BayVehicleNotice } from '@/components/customer/garage/BayVehicleCard'
import type { Bay } from '@/components/customer/garage/garageModel'
import { BaySessionPopup } from '@/components/features/lots/BaySessionPopup'
import { useDeployWalkInToBay, useOccupyBookedBayAt } from '@/hooks/useParkingSimulation'
import { WALK_IN_MAX_STAY_HOURS } from '@/types/simulation.dto'
import { isBooked } from './simulationBays'

const TITLE = 'Simulate in this bay'

/**
 * Popup of the Admin simulation's 3D model. A bay with a vehicle shows that vehicle (nothing can be sent there);
 * a free bay sends one walk-in of the type and stay the Admin picks; a held or booked bay offers the exception
 * of a walk-in parking in it by mistake.
 */
export function SimulationBayPopup({ lotId, bay, onClose }: { lotId: string; bay: Bay; onClose: () => void }) {
  const deploy = useDeployWalkInToBay()
  const occupy = useOccupyBookedBayAt()
  const carBay = bay.bayTypeCode !== 'MOTORBIKE'
  const [type, setType] = useState(carBay ? (bay.bayTypeCode === 'CAR_7' ? 'CAR_7' : 'CAR_4') : 'MOTORBIKE')
  const [minStay, setMinStay] = useState('2')
  const [maxStay, setMaxStay] = useState('4')

  if (bay.status === 'OCCUPIED') return <BaySessionPopup lotId={lotId} bay={bay} onClose={onClose} />

  if (isBooked(bay))
    return (
      <BayVehicleCard
        bayCode={bay.code}
        title={TITLE}
        badge={{ text: bay.status === 'RESERVED' ? 'Held for a booking' : 'Booked for later', tone: 'mine' }}
        rows={[{ label: 'Walk-ins', value: 'Not sent here on their own' }]}
        footer={
          <div style={styles.form}>
            <p style={styles.note}>
              A walk-in ignores the signs and parks here. When the customer checks in, the entry lane moves the booking to
              another bay with the first hour free, or refunds and compensates them. Staff get the case in Exceptions &amp;
              Alerts.
            </p>
            <button
              type="button"
              style={styles.danger}
              disabled={occupy.isPending}
              onClick={() => occupy.mutate({ lotId: Number(lotId), slotId: Number(bay.id) }, { onSuccess: onClose })}
            >
              {occupy.isPending ? 'Parking…' : 'Park a walk-in here by mistake'}
            </button>
          </div>
        }
        onClose={onClose}
      />
    )

  if (bay.countedWalkIn)
    return (
      <BayVehicleNotice
        bayCode={bay.code}
        title={TITLE}
        message="The model draws a walk-in without a bay of its own here, so this bay stays free for it."
        onClose={onClose}
      />
    )

  const min = Number(minStay)
  const max = Number(maxStay)
  const stayError =
    !(min > 0) || !(max >= min) || max > WALK_IN_MAX_STAY_HOURS
      ? `The stay is more than 0 and at most ${WALK_IN_MAX_STAY_HOURS} hours; the shortest is not longer than the longest.`
      : null

  return (
    <BayVehicleCard
      bayCode={bay.code}
      title={TITLE}
      badge={{ text: 'Free bay', tone: 'member' }}
      rows={[]}
      footer={
        <form
          style={styles.form}
          onSubmit={(e) => {
            e.preventDefault()
            if (stayError) return
            deploy.mutate(
              { lotId: Number(lotId), slotId: Number(bay.id), vehicleTypeCode: type, minStayHours: min, maxStayHours: max },
              { onSuccess: onClose },
            )
          }}
        >
          <label style={styles.field}>
            <span style={styles.label}>Vehicle</span>
            <select value={type} onChange={(e) => setType(e.target.value)} style={styles.input}>
              {carBay ? (
                <>
                  <option value="CAR_4">4-seat car</option>
                  <option value="CAR_7">7-seat car</option>
                </>
              ) : (
                <option value="MOTORBIKE">Motorbike</option>
              )}
            </select>
          </label>
          <div style={styles.pair}>
            <label style={styles.field}>
              <span style={styles.label}>Shortest stay (h)</span>
              <input inputMode="decimal" value={minStay} onChange={(e) => setMinStay(e.target.value)} style={styles.input} />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Longest stay (h)</span>
              <input inputMode="decimal" value={maxStay} onChange={(e) => setMaxStay(e.target.value)} style={styles.input} />
            </label>
          </div>
          {stayError && <p style={styles.error}>{stayError}</p>}
          <button type="submit" style={styles.primary} disabled={Boolean(stayError) || deploy.isPending}>
            {deploy.isPending ? 'Parking…' : 'Park a walk-in here'}
          </button>
          <p style={styles.note}>A random plate enters through the lot&apos;s entry lane, then pays cash and leaves after its stay.</p>
        </form>
      }
      onClose={onClose}
    />
  )
}

const button: CSSProperties = {
  width: '100%',
  padding: '0.45rem 0.6rem',
  borderRadius: '0.45rem',
  border: 'none',
  fontWeight: 700,
  fontSize: '0.78rem',
  cursor: 'pointer',
}

const styles = {
  form: { display: 'grid', gap: '0.55rem', color: '#e2e8f0' },
  pair: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' },
  field: { display: 'grid', gap: '0.2rem' },
  label: { fontSize: '0.7rem', color: '#94a3b8' },
  input: {
    width: '100%',
    padding: '0.35rem 0.45rem',
    borderRadius: '0.4rem',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    background: 'rgba(15, 23, 42, 0.9)',
    color: '#e2e8f0',
    fontSize: '0.78rem',
  },
  primary: { ...button, background: '#e9c349', color: '#1f1600' },
  danger: { ...button, background: '#f59e0b', color: '#1f1600' },
  note: { margin: 0, color: '#94a3b8', lineHeight: 1.4 },
  error: { margin: 0, color: '#fda4af' },
} satisfies Record<string, CSSProperties>
