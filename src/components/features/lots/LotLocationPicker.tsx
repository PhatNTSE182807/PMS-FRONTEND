import { useEffect, useRef, useState } from 'react'
import type { Map as MapboxMap, Marker } from 'mapbox-gl'
import { Crosshair, MapPinOff, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form-controls'
import { geocodeAddress, mapboxToken, type LngLat } from '@/api/mapbox.service'
import { coordinateError } from '@/lib/lotCoordinates'

/** Map centre when the lot has no position yet (Ho Chi Minh City). */
const DEFAULT_CENTER: LngLat = { lng: 106.7009, lat: 10.7769 }

/** Six decimals, as stored on the backend (about 10 cm). */
const round6 = (n: number) => Math.round(n * 1e6) / 1e6
const parse = (text: string) => {
  const n = Number(text.trim())
  return text.trim() === '' || !Number.isFinite(n) ? null : round6(n)
}
/** "10.8016, 106.6551": latitude first, as most map sites copy a point. */
const parsePair = (text: string): LngLat | null => {
  const parts = text.split(/[,;\s]+/).filter(Boolean)
  if (parts.length !== 2) return null
  const [lat, lng] = parts.map(Number)
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat: round6(lat), lng: round6(lng) } : null
}

interface Props {
  latitude: number | null
  longitude: number | null
  /** Address typed in the form; used by "Find from address". */
  address: string
  onChange: (latitude: number | null, longitude: number | null) => void
}

/**
 * Lot position for the customer's directions map: two inputs (a pasted "lat, lng" pair fills both)
 * and, with a Mapbox token, a small map where a click or a drag of the pin sets the point.
 */
export function LotLocationPicker({ latitude, longitude, address, onChange }: Props) {
  // Inputs keep their own text so a half-typed number is not thrown away
  const [latText, setLatText] = useState(latitude?.toString() ?? '')
  const [lngText, setLngText] = useState(longitude?.toString() ?? '')
  const [finding, setFinding] = useState(false)
  const [findError, setFindError] = useState('')

  const setPoint = (point: LngLat | null) => {
    setLatText(point ? String(point.lat) : '')
    setLngText(point ? String(point.lng) : '')
    setFindError('')
    onChange(point?.lat ?? null, point?.lng ?? null)
  }

  const typed = (field: 'lat' | 'lng', text: string) => {
    const pair = parsePair(text)
    if (pair) return setPoint(pair)
    if (field === 'lat') {
      setLatText(text)
      onChange(parse(text), longitude)
    } else {
      setLngText(text)
      onChange(latitude, parse(text))
    }
  }

  // Mapbox finds Vietnamese addresses only roughly: a starting point to adjust by hand
  const findFromAddress = async () => {
    setFindError('')
    setFinding(true)
    try {
      const found = await geocodeAddress(address)
      if (found) setPoint({ lat: round6(found.lat), lng: round6(found.lng) })
      else setFindError('No place found for this address. Click the map to place the pin.')
    } catch {
      setFindError('Could not search the address right now.')
    } finally {
      setFinding(false)
    }
  }

  const error = coordinateError(latitude, longitude)
  const point = latitude != null && longitude != null && !error ? { lat: latitude, lng: longitude } : null
  const hint = mapboxToken
    ? 'Click the map or drag the pin to the lot entrance. You can also paste "latitude, longitude" into either box. Empty: the customer map finds the lot by its address.'
    : 'Paste "latitude, longitude" into either box. Empty: the customer map finds the lot by its address.'

  return (
    <div className="grid gap-2 sm:col-span-2">
      <span className="text-sm font-medium text-slate-700">Map position</span>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input inputMode="decimal" placeholder="Latitude, e.g. 10.801684" aria-label="Latitude" value={latText} onChange={(e) => typed('lat', e.target.value)} />
        <Input inputMode="decimal" placeholder="Longitude, e.g. 106.655154" aria-label="Longitude" value={lngText} onChange={(e) => typed('lng', e.target.value)} />
        <div className="flex gap-2">
          {mapboxToken && (
            <Button type="button" variant="outline" disabled={!address.trim() || finding} onClick={findFromAddress}>
              <Search className="size-4" aria-hidden /> {finding ? 'Searching…' : 'Find from address'}
            </Button>
          )}
          <Button type="button" variant="outline" disabled={latitude == null && longitude == null} onClick={() => setPoint(null)} aria-label="Clear the map position">
            <MapPinOff className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
      {mapboxToken && <PickerMap point={point} onPick={setPoint} />}
      <p className={error || findError ? 'text-xs text-rose-600' : 'text-xs text-slate-500'}>{error || findError || hint}</p>
    </div>
  )
}

/** Small Mapbox map: a click moves the pin there, and the pin can be dragged. */
function PickerMap({ point, onPick }: { point: LngLat | null; onPick: (point: LngLat) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<MapboxMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  // Latest callback, so the map's listeners never go stale
  const onPickRef = useRef(onPick)
  useEffect(() => {
    onPickRef.current = onPick
  }, [onPick])
  // Centre of the first render, read once when the map is created
  const startRef = useRef(point ?? DEFAULT_CENTER)

  // Create the map once; mapbox-gl is loaded only when the form opens
  useEffect(() => {
    let created: MapboxMap | null = null
    let cancelled = false
    void Promise.all([import('mapbox-gl'), import('mapbox-gl/dist/mapbox-gl.css')]).then(([{ default: mapboxgl }]) => {
      if (cancelled || !containerRef.current) return
      const start = startRef.current
      created = new mapboxgl.Map({
        container: containerRef.current,
        accessToken: mapboxToken,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [start.lng, start.lat],
        zoom: 15,
        language: 'en',
      })
      created.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
      created.getCanvas().style.cursor = 'crosshair'
      created.on('click', (e) => onPickRef.current({ lat: round6(e.lngLat.lat), lng: round6(e.lngLat.lng) }))
      created.on('load', () => {
        if (cancelled || !created) return
        // The dialog opens with an animation: measure the map again once it has its final size
        created.resize()
        setMap(created)
      })
    })
    return () => {
      cancelled = true
      markerRef.current = null
      created?.remove()
    }
  }, [])

  // Pin follows the value; the camera moves only when the point leaves the view
  const lat = point?.lat
  const lng = point?.lng
  useEffect(() => {
    if (!map) return
    if (lat == null || lng == null) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }
    let cancelled = false
    void import('mapbox-gl').then(({ default: mapboxgl }) => {
      if (cancelled) return
      if (!markerRef.current) {
        markerRef.current = new mapboxgl.Marker({ color: '#4f46e5', draggable: true }).setLngLat([lng, lat]).addTo(map)
        markerRef.current.on('dragend', () => {
          const at = markerRef.current?.getLngLat()
          if (at) onPickRef.current({ lat: round6(at.lat), lng: round6(at.lng) })
        })
      } else {
        markerRef.current.setLngLat([lng, lat])
      }
      if (!map.getBounds()?.contains([lng, lat])) map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15) })
    })
    return () => {
      cancelled = true
    }
  }, [map, lat, lng])

  return (
    <div className="relative h-64 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      <div ref={containerRef} className="size-full" />
      {!point && (
        <span className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs text-slate-600 shadow">
          <Crosshair className="size-3.5" aria-hidden /> Click the lot entrance to place the pin
        </span>
      )}
    </div>
  )
}
