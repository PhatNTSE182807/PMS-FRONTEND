import { lazy, Suspense, useState } from 'react'
import { Box, LayoutGrid } from 'lucide-react'
import { isLowEndDevice, supportsWebGL2 } from '@/lib/webgl'
import type { Garage3DProps } from './Garage3D'
import { LotPlan2D } from './LotPlan2D'

// three.js is large: load it only when the 3D model is on screen.
const Garage3D = lazy(() => import('./Garage3D'))

/**
 * The lot model: 3D when the browser has WebGL 2, otherwise (or on slow devices, or on request)
 * the 2D plan of the same levels and bays (SRS FR-3D-06, NFR-3D-04).
 */
export function GarageView(props: Garage3DProps) {
  const can3D = supportsWebGL2()
  const [mode, setMode] = useState<'3d' | '2d'>(() => (can3D && !isLowEndDevice() ? '3d' : '2d'))

  return (
    <div style={{ position: 'relative' }}>
      {mode === '3d' ? (
        <Suspense fallback={<div className={`garage3d garage3d--loading ${props.className ?? ''}`}>Loading 3D model…</div>}>
          <Garage3D {...props} />
        </Suspense>
      ) : (
        <LotPlan2D {...props} />
      )}
      <button
        type="button"
        onClick={() => setMode(mode === '3d' ? '2d' : '3d')}
        disabled={!can3D}
        title={can3D ? undefined : '3D needs WebGL 2, which this browser does not support'}
        style={{
          position: 'absolute',
          right: '0.6rem',
          bottom: '0.6rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.3rem 0.65rem',
          borderRadius: '0.4rem',
          border: '1px solid var(--map-card-border)',
          background: 'var(--map-chip-bg)',
          color: 'var(--map-text)',
          fontSize: '0.75rem',
          fontWeight: 600,
          cursor: can3D ? 'pointer' : 'not-allowed',
        }}
      >
        {mode === '3d' ? <LayoutGrid size={13} aria-hidden /> : <Box size={13} aria-hidden />}
        {mode === '3d' ? '2D plan' : can3D ? '3D view' : '2D plan (no WebGL 2)'}
      </button>
    </div>
  )
}
