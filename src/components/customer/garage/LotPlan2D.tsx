import { useState, type CSSProperties } from 'react'
import { Bike, Car, Layers, LayoutGrid } from 'lucide-react'
import type { Garage3DProps } from './Garage3D'
import type { Bay, GarageFloor } from './garageModel'

/** Above this many bays on screen, the whole-building view starts at level summaries (Level of Detail). */
const DETAIL_LIMIT = 240

const STATUS_STYLE: Record<Bay['status'], { fill: string; label: string }> = {
  AVAILABLE: { fill: '#10b981', label: 'available' },
  RESERVED: { fill: '#f59e0b', label: 'reserved' },
  OCCUPIED: { fill: '#64748b', label: 'occupied' },
}

const styles = {
  root: { display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.75rem', overflow: 'auto', cursor: 'default' },
  bar: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--map-text-soft)' },
  toggle: (active: boolean): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0.25rem 0.6rem',
    borderRadius: '0.4rem',
    border: '1px solid var(--map-card-border)',
    background: active ? 'var(--map-active-bg)' : 'transparent',
    color: active ? 'var(--map-active-text)' : 'var(--map-text-soft)',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
  }),
  floor: { display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.6rem', borderRadius: '0.5rem', background: 'var(--map-panel-bg)', border: '1px solid var(--map-card-border)' },
  floorHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--map-text)' },
  lane: { height: '0.6rem', borderTop: '1px dashed rgba(148,163,184,0.35)', borderBottom: '1px dashed rgba(148,163,184,0.35)', margin: '0.15rem 0' },
  legend: { display: 'inline-flex', alignItems: 'center', gap: '0.3rem' },
  swatch: (fill: string): CSSProperties => ({ width: '0.6rem', height: '0.6rem', borderRadius: '0.15rem', background: fill }),
} satisfies Record<string, CSSProperties | ((...args: never[]) => CSSProperties)>

/**
 * 2D fallback of the 3D lot model (SRS FR-3D-06): the same levels, rows and bays drawn as a flat plan,
 * for browsers without WebGL 2 or slow devices. Large buildings start at one summary per level
 * (Level of Detail); picking a level shows its bays.
 */
export function LotPlan2D({ floors, focusFloor, selectedBayId, myBayId, onSelectBay, canSelectBay, className }: Garage3DProps) {
  const visible = focusFloor === null ? floors : floors.filter((f) => f.index === focusFloor)
  const bayCount = visible.reduce((n, f) => n + f.bays.length, 0)
  const [detail, setDetail] = useState<'bays' | 'levels' | null>(null)
  const showBays = (detail ?? (bayCount > DETAIL_LIMIT ? 'levels' : 'bays')) === 'bays'

  return (
    <div className={`garage3d ${className ?? ''}`} style={styles.root} role="region" aria-label="Parking plan (2D)">
      <div style={styles.bar}>
        <button type="button" style={styles.toggle(showBays)} aria-pressed={showBays} onClick={() => setDetail('bays')}>
          <LayoutGrid size={13} aria-hidden /> Bays
        </button>
        <button type="button" style={styles.toggle(!showBays)} aria-pressed={!showBays} onClick={() => setDetail('levels')}>
          <Layers size={13} aria-hidden /> Levels
        </button>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '0.75rem' }}>
          {Object.values(STATUS_STYLE).map((s) => (
            <span key={s.label} style={styles.legend}>
              <span style={styles.swatch(s.fill)} aria-hidden /> {s.label}
            </span>
          ))}
        </span>
      </div>

      {[...visible].reverse().map((floor) =>
        showBays ? (
          <FloorBays key={floor.index} floor={floor} selectedBayId={selectedBayId} myBayId={myBayId} onSelectBay={onSelectBay} canSelectBay={canSelectBay} />
        ) : (
          <FloorSummary key={floor.index} floor={floor} onOpen={() => setDetail('bays')} />
        ),
      )}
    </div>
  )
}

function FloorTitle({ floor }: { floor: GarageFloor }) {
  const free = floor.bays.filter((b) => b.status === 'AVAILABLE').length
  return (
    <div style={styles.floorHead}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
        {floor.kind === 'car' ? <Car size={14} aria-hidden /> : <Bike size={14} aria-hidden />}
        {floor.level}
        {floor.zoneLabel && <span style={{ fontWeight: 400, color: 'var(--map-muted)' }}>· {floor.zoneLabel}</span>}
      </span>
      <span style={{ color: free ? 'var(--map-good)' : 'var(--map-bad)' }}>
        {free}/{floor.bays.length} free
      </span>
    </div>
  )
}

function FloorSummary({ floor, onOpen }: { floor: GarageFloor; onOpen: () => void }) {
  const counts = (status: Bay['status']) => floor.bays.filter((b) => b.status === status).length
  const total = Math.max(1, floor.bays.length)
  return (
    <button type="button" onClick={onOpen} style={{ ...styles.floor, textAlign: 'left', cursor: 'pointer', color: 'inherit' }} aria-label={`Show the bays of ${floor.level}`}>
      <FloorTitle floor={floor} />
      <div style={{ display: 'flex', height: '0.6rem', borderRadius: '0.3rem', overflow: 'hidden' }} aria-hidden>
        {(Object.keys(STATUS_STYLE) as Bay['status'][]).map((status) => (
          <span key={status} style={{ width: `${(counts(status) / total) * 100}%`, background: STATUS_STYLE[status].fill }} />
        ))}
      </div>
    </button>
  )
}

function FloorBays({
  floor,
  selectedBayId,
  myBayId,
  onSelectBay,
  canSelectBay,
}: {
  floor: GarageFloor
  selectedBayId: string | null
  myBayId: string | null
  onSelectBay: (bay: Bay) => void
  canSelectBay?: (bay: Bay) => boolean
}) {
  // Two rows of bays face each other across one driving lane
  const rows = Array.from({ length: floor.rows }, (_, row) => floor.bays.filter((b) => b.row === row).sort((a, b) => a.col - b.col))
  return (
    <section style={styles.floor} aria-label={floor.level}>
      <FloorTitle floor={floor} />
      {rows.map((bays, row) => (
        <div key={row}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${floor.cols}, minmax(1.4rem, 1fr))`, gap: '0.2rem' }}>
            {bays.map((bay) => {
              const selected = bay.id === selectedBayId
              const mine = bay.id === myBayId
              const selectable = canSelectBay?.(bay) ?? true
              return (
                <button
                  key={bay.id}
                  type="button"
                  title={`${bay.code} · ${STATUS_STYLE[bay.status].label}`}
                  aria-label={`Bay ${bay.code}, ${STATUS_STYLE[bay.status].label}`}
                  aria-pressed={selected}
                  onClick={() => selectable && onSelectBay(bay)}
                  aria-disabled={!selectable || undefined}
                  style={{
                    height: '1.6rem',
                    borderRadius: '0.2rem',
                    border: 'none',
                    background: STATUS_STYLE[bay.status].fill,
                    opacity: bay.status === 'AVAILABLE' || selected || mine ? 1 : 0.75,
                    outline: selected ? '2px solid var(--map-selected)' : mine ? '2px solid var(--map-mine)' : 'none',
                    outlineOffset: '1px',
                    cursor: selectable ? 'pointer' : 'default',
                  }}
                />
              )
            })}
          </div>
          {row % 2 === 0 && row < floor.rows - 1 && <div style={styles.lane} aria-hidden />}
        </div>
      ))}
    </section>
  )
}
