/// <reference types="google.maps" />
import { useEffect, useState } from 'react'
import { APIProvider, Map, Marker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { Crosshair, MapPinOff, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form-controls'
import { coordinateError } from '@/lib/lotCoordinates'

type LatLng = google.maps.LatLngLiteral

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''
/** Map centre when the lot has no position yet (Ho Chi Minh City). */
const DEFAULT_CENTER: LatLng = { lat: 10.7769, lng: 106.7009 }

/** Six decimals, as stored on the backend (about 10 cm). */
const round6 = (n: number) => Math.round(n * 1e6) / 1e6
const parse = (text: string) => {
  const n = Number(text.trim())
  return text.trim() === '' || !Number.isFinite(n) ? null : round6(n)
}
/** "10.8016, 106.6551" as copied from Google Maps (right-click on the map). */
const parsePair = (text: string): LatLng | null => {
  const parts = text.split(/[,;\s]+/).filter(Boolean)
  if (parts.length !== 2) return null
  const [lat, lng] = parts.map(Number)
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat: round6(lat), lng: round6(lng) } : null
}
const fromLatLng = (latLng: google.maps.LatLng | null | undefined): LatLng | null =>
  latLng ? { lat: round6(latLng.lat()), lng: round6(latLng.lng()) } : null

interface Props {
  latitude: number | null
  longitude: number | null
  /** Address typed in the form; used by "Find from address". */
  address: string
  onChange: (latitude: number | null, longitude: number | null) => void
}

/**
 * Lot position for the customer's directions map: two inputs (a "lat, lng" pair pasted from Google Maps
 * fills both) and, with a Google Maps key, a small map where a click or a drag of the pin sets the point.
 */
export function LotLocationPicker({ latitude, longitude, address, onChange }: Props) {
  // Inputs keep their own text so a half-typed number is not thrown away
  const [latText, setLatText] = useState(latitude?.toString() ?? '')
  const [lngText, setLngText] = useState(longitude?.toString() ?? '')
  const [findError, setFindError] = useState('')

  const setPoint = (point: LatLng | null) => {
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

  const error = coordinateError(latitude, longitude)
  const point = latitude != null && longitude != null && !error ? { lat: latitude, lng: longitude } : null
  const hint = apiKey
    ? 'Click the map or drag the pin to the lot entrance. You can also paste "latitude, longitude" copied from Google Maps (right-click on the map). Empty: the customer map finds the lot by its address.'
    : 'Paste "latitude, longitude" copied from Google Maps (right-click on the map). Empty: the customer map finds the lot by its address.'

  const inputs = (
    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <Input inputMode="decimal" placeholder="Latitude, e.g. 10.801684" aria-label="Latitude" value={latText} onChange={(e) => typed('lat', e.target.value)} />
      <Input inputMode="decimal" placeholder="Longitude, e.g. 106.655154" aria-label="Longitude" value={lngText} onChange={(e) => typed('lng', e.target.value)} />
      <div className="flex gap-2">
        {apiKey && <FindFromAddressButton address={address} onFound={setPoint} onError={setFindError} />}
        <Button type="button" variant="outline" disabled={latitude == null && longitude == null} onClick={() => setPoint(null)} aria-label="Clear the map position">
          <MapPinOff className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  )

  return (
    <div className="grid gap-2 sm:col-span-2">
      <span className="text-sm font-medium text-slate-700">Map position</span>
      {apiKey ? (
        <APIProvider apiKey={apiKey} language="en" region="VN">
          {inputs}
          <PickerMap point={point} onPick={setPoint} />
        </APIProvider>
      ) : (
        inputs
      )}
      <p className={error || findError ? 'text-xs text-rose-600' : 'text-xs text-slate-500'}>{error || findError || hint}</p>
    </div>
  )
}

const NOT_FOUND = 'No place found for this address. Click the map or paste the position from Google Maps.'

/** Places the pin at the address typed in the form (Google Geocoding); a starting point to adjust by hand. */
function FindFromAddressButton({ address, onFound, onError }: { address: string; onFound: (point: LatLng) => void; onError: (message: string) => void }) {
  const geocoding = useMapsLibrary('geocoding')
  const [finding, setFinding] = useState(false)

  const find = async () => {
    if (!geocoding) return
    setFinding(true)
    try {
      const { results } = await new geocoding.Geocoder().geocode({ address, region: 'vn' })
      const found = fromLatLng(results[0]?.geometry.location)
      if (found) onFound(found)
      else onError(NOT_FOUND)
    } catch {
      onError(NOT_FOUND)
    } finally {
      setFinding(false)
    }
  }

  return (
    <Button type="button" variant="outline" disabled={!address.trim() || !geocoding || finding} onClick={find}>
      <Search className="size-4" aria-hidden /> {finding ? 'Searching…' : 'Find from address'}
    </Button>
  )
}

/** Small Google map: a click moves the pin there, and the pin can be dragged. */
function PickerMap({ point, onPick }: { point: LatLng | null; onPick: (point: LatLng) => void }) {
  return (
    <div className="relative h-64 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      <Map
        defaultCenter={point ?? DEFAULT_CENTER}
        defaultZoom={16}
        gestureHandling="greedy"
        clickableIcons={false}
        streetViewControl={false}
        mapTypeControl={false}
        draggableCursor="crosshair"
        onClick={(e) => {
          const at = e.detail.latLng
          if (at) onPick({ lat: round6(at.lat), lng: round6(at.lng) })
        }}
      >
        {point && (
          <Marker
            position={point}
            draggable
            onDragEnd={(e) => {
              const at = fromLatLng(e.latLng)
              if (at) onPick(at)
            }}
          />
        )}
        <KeepInView point={point} />
      </Map>
      {!point && (
        <span className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs text-slate-600 shadow">
          <Crosshair className="size-3.5" aria-hidden /> Click the lot entrance to place the pin
        </span>
      )}
    </div>
  )
}

/** Moves the camera to the pin when it is set outside the view (typed, pasted or found by address). */
function KeepInView({ point }: { point: LatLng | null }) {
  const map = useMap()
  const lat = point?.lat
  const lng = point?.lng
  useEffect(() => {
    if (!map || lat == null || lng == null) return
    if (!map.getBounds()?.contains({ lat, lng })) map.panTo({ lat, lng })
  }, [map, lat, lng])
  return null
}
