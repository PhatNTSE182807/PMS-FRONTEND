import { useEffect, useRef, useState } from 'react'
import type { Map as MapboxMap, Marker } from 'mapbox-gl'
import type { Feature, LineString } from 'geojson'
import { ExternalLink, LocateFixed, MapPin, X } from 'lucide-react'
import type { PublicLotDTO } from '@/types/publicLot.dto'
import { formatDistance, formatDuration, geocodeAddress, getDrivingRoute, mapboxToken, type DrivingRoute, type LngLat } from '@/api/mapbox.service'

type DirectionsLot = Pick<PublicLotDTO, 'name' | 'address' | 'district' | 'city' | 'latitude' | 'longitude'>

/** Map centre before the lot is found (Ho Chi Minh City). */
const DEFAULT_CENTER: LngLat = { lng: 106.7009, lat: 10.7769 }
const ROUTE_SOURCE = 'lot-route'

type LocateState = 'locating' | 'found' | 'denied' | 'unsupported'

/** Full address used to find the lot when it has no saved coordinates. */
const lotAddress = (lot: DirectionsLot) => [lot.name, lot.address, lot.district, lot.city].filter(Boolean).join(', ')

const lotCoords = (lot: DirectionsLot): LngLat | null =>
  lot.latitude != null && lot.longitude != null ? { lat: Number(lot.latitude), lng: Number(lot.longitude) } : null

/** Google Maps directions in a new tab; works without any API key. */
function googleMapsUrl(lot: DirectionsLot, origin: LngLat | null) {
  const coords = lotCoords(lot)
  const params = new URLSearchParams({ api: '1', destination: coords ? `${coords.lat},${coords.lng}` : lotAddress(lot), travelmode: 'driving' })
  if (origin) params.set('origin', `${origin.lat},${origin.lng}`)
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

/**
 * Mapbox map with the lot, the customer's position and the driving route between them. When there is
 * no route (location refused, or Directions unavailable) it still shows the lot and, if known, the customer.
 */
function DirectionsMap({ lot, origin, onRoute }: { lot: DirectionsLot; origin: LngLat | null; onRoute: (route: DrivingRoute | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<MapboxMap | null>(null)
  const [lotPosition, setLotPosition] = useState<LngLat | null>(() => lotCoords(lot))
  const [route, setRoute] = useState<DrivingRoute | null>(null)

  // Create the map once; mapbox-gl is loaded only when the dialog opens
  useEffect(() => {
    let created: MapboxMap | null = null
    let cancelled = false
    void Promise.all([import('mapbox-gl'), import('mapbox-gl/dist/mapbox-gl.css')]).then(([{ default: mapboxgl }]) => {
      if (cancelled || !containerRef.current) return
      const center = lotCoords(lot) ?? DEFAULT_CENTER
      created = new mapboxgl.Map({
        container: containerRef.current,
        accessToken: mapboxToken,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [center.lng, center.lat],
        zoom: 14,
        language: 'en',
      })
      created.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
      created.on('load', () => !cancelled && setMap(created))
    })
    return () => {
      cancelled = true
      created?.remove()
    }
  }, [lot])

  // Find the lot by address when it has no saved coordinates
  useEffect(() => {
    if (lotPosition) return
    const abort = new AbortController()
    geocodeAddress(lotAddress(lot), abort.signal)
      .then((found) => found && setLotPosition(found))
      .catch(() => undefined)
    return () => abort.abort()
  }, [lot, lotPosition])

  // Driving route from the customer's position to the lot
  useEffect(() => {
    if (!origin || !lotPosition) return
    const abort = new AbortController()
    getDrivingRoute(origin, lotPosition, abort.signal)
      .then((found) => {
        setRoute(found)
        onRoute(found)
      })
      .catch(() => {
        if (!abort.signal.aborted) onRoute(null)
      })
    return () => abort.abort()
  }, [origin, lotPosition, onRoute])

  // Markers, route line and camera
  useEffect(() => {
    if (!map) return
    let markers: Marker[] = []
    let cancelled = false
    void import('mapbox-gl').then(({ default: mapboxgl }) => {
      if (cancelled) return
      if (lotPosition) {
        markers.push(new mapboxgl.Marker({ color: '#0f766e' }).setLngLat([lotPosition.lng, lotPosition.lat]).setPopup(new mapboxgl.Popup().setText(lot.name)).addTo(map))
      }
      if (origin) {
        const dot = document.createElement('div')
        dot.className = 'cx-map-dialog__me'
        dot.title = 'You are here'
        markers.push(new mapboxgl.Marker({ element: dot }).setLngLat([origin.lng, origin.lat]).addTo(map))
      }

      if (route) {
        const data: Feature<LineString> = { type: 'Feature', properties: {}, geometry: route.geometry }
        map.addSource(ROUTE_SOURCE, { type: 'geojson', data })
        map.addLayer({ id: ROUTE_SOURCE, type: 'line', source: ROUTE_SOURCE, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#1a73e8', 'line-width': 6 } })
      }

      const points = route ? route.geometry.coordinates : [lotPosition, origin].filter((p): p is LngLat => p != null).map((p) => [p.lng, p.lat])
      if (points.length > 1) {
        const bounds = new mapboxgl.LngLatBounds()
        points.forEach((p: number[]) => bounds.extend(p as [number, number]))
        map.fitBounds(bounds, { padding: 64, duration: 0 })
      } else if (lotPosition) {
        map.jumpTo({ center: [lotPosition.lng, lotPosition.lat], zoom: 16 })
      }
    })
    return () => {
      cancelled = true
      markers.forEach((m) => m.remove())
      markers = []
      if (map.getLayer(ROUTE_SOURCE)) map.removeLayer(ROUTE_SOURCE)
      if (map.getSource(ROUTE_SOURCE)) map.removeSource(ROUTE_SOURCE)
    }
  }, [map, lot, lotPosition, origin, route])

  return <div ref={containerRef} className="cx-map-dialog__canvas" />
}

/** Popup with a map: the parking lot, the customer's current position and the driving route between them. */
export function LotDirectionsDialog({ lot: openedLot, onClose }: { lot: DirectionsLot; onClose: () => void }) {
  // The lot list refreshes every few seconds; keep the lot as opened so the route is not asked for again
  const [lot] = useState(openedLot)
  const [origin, setOrigin] = useState<LngLat | null>(null)
  const [locate, setLocate] = useState<LocateState>(() => ('geolocation' in navigator ? 'locating' : 'unsupported'))
  const [route, setRoute] = useState<DrivingRoute | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Ask the browser for the customer's position once per opening
  useEffect(() => {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin({ lat: position.coords.latitude, lng: position.coords.longitude })
        setLocate('found')
      },
      () => setLocate('denied'),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }, [])

  const status =
    locate === 'locating'
      ? 'Finding your location…'
      : locate === 'found'
        ? route
          ? `${formatDistance(route.distanceMeters)} • about ${formatDuration(route.durationSeconds)} by car`
          : 'Showing your location and the parking lot.'
        : locate === 'denied'
          ? 'Location access is off: allow it in your browser to see the route from where you are.'
          : 'This browser cannot share your location.'

  return (
    <div className="cx-pass-backdrop" role="presentation" onClick={onClose}>
      <div className="cx-map-dialog" role="dialog" aria-modal="true" aria-labelledby="lot-directions-title" onClick={(e) => e.stopPropagation()}>
        <div className="cx-map-dialog__head">
          <div>
            <h2 className="cx-card__title" id="lot-directions-title">Directions to {lot.name}</h2>
            <p className="cx-map-dialog__addr">
              <MapPin size={14} aria-hidden /> {[lot.address, lot.district, lot.city].filter(Boolean).join(', ') || '—'}
            </p>
          </div>
          <button type="button" className="cx-icon-btn" aria-label="Close" onClick={onClose}>
            <X aria-hidden />
          </button>
        </div>

        <div className="cx-map-dialog__map">
          {mapboxToken ? (
            <DirectionsMap lot={lot} origin={locate === 'locating' ? null : origin} onRoute={setRoute} />
          ) : (
            <p className="cx-map-dialog__empty">The map is not set up yet. Open the directions in Google Maps instead.</p>
          )}
        </div>

        <div className="cx-map-dialog__foot">
          <span className="cx-map-dialog__status" aria-live="polite">
            <LocateFixed size={15} aria-hidden /> {status}
          </span>
          <a className="cx-btn cx-btn--teal" href={googleMapsUrl(lot, origin)} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden /> Open in Google Maps
          </a>
        </div>
      </div>
    </div>
  )
}
