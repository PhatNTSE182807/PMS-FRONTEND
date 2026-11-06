/// <reference types="google.maps" />
import { useEffect, useState } from 'react'
import { APIProvider, Map, Marker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { ExternalLink, LocateFixed, MapPin, X } from 'lucide-react'
import type { PublicLotDTO } from '@/types/publicLot.dto'

type LatLng = google.maps.LatLngLiteral
type DirectionsLot = Pick<PublicLotDTO, 'name' | 'address' | 'district' | 'city' | 'latitude' | 'longitude'>

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''
/** Map centre before the lot is found (Ho Chi Minh City). */
const DEFAULT_CENTER: LatLng = { lat: 10.7769, lng: 106.7009 }

type LocateState = 'locating' | 'found' | 'denied' | 'unsupported'

/** Full address used to find the lot when it has no saved coordinates. */
const lotAddress = (lot: DirectionsLot) => [lot.name, lot.address, lot.district, lot.city].filter(Boolean).join(', ')

const lotCoords = (lot: DirectionsLot): LatLng | null =>
  lot.latitude != null && lot.longitude != null ? { lat: Number(lot.latitude), lng: Number(lot.longitude) } : null

/** Google Maps directions in a new tab; works without an API key. */
function googleMapsUrl(lot: DirectionsLot, origin: LatLng | null) {
  const coords = lotCoords(lot)
  const params = new URLSearchParams({ api: '1', destination: coords ? `${coords.lat},${coords.lng}` : lotAddress(lot), travelmode: 'driving' })
  if (origin) params.set('origin', `${origin.lat},${origin.lng}`)
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

interface RouteInfo {
  distance: string
  duration: string
}

/**
 * Draws the driving route from the customer to the lot. When there is no route (location refused,
 * or the Directions service is unavailable) it still shows the lot and, if known, the customer.
 */
function RouteLayer({ lot, origin, onRoute }: { lot: DirectionsLot; origin: LatLng | null; onRoute: (route: RouteInfo | null) => void }) {
  const map = useMap()
  const routes = useMapsLibrary('routes')
  const geocoding = useMapsLibrary('geocoding')
  const [lotPosition, setLotPosition] = useState<LatLng | null>(() => lotCoords(lot))
  const [routeFailed, setRouteFailed] = useState(false)

  // Route from the customer's position to the lot
  useEffect(() => {
    if (!map || !routes || !origin) return
    const renderer = new routes.DirectionsRenderer({ map, suppressMarkers: true, polylineOptions: { strokeColor: '#1a73e8', strokeWeight: 6 } })
    let cancelled = false
    new routes.DirectionsService()
      .route({ origin, destination: lotCoords(lot) ?? lotAddress(lot), travelMode: google.maps.TravelMode.DRIVING })
      .then((result) => {
        if (cancelled) return
        renderer.setDirections(result)
        const leg = result.routes[0]?.legs[0]
        if (leg) setLotPosition((current) => current ?? leg.end_location.toJSON())
        onRoute(leg ? { distance: leg.distance?.text ?? '', duration: leg.duration?.text ?? '' } : null)
      })
      .catch(() => {
        if (cancelled) return
        setRouteFailed(true)
        onRoute(null)
      })
    return () => {
      cancelled = true
      renderer.setMap(null)
    }
  }, [map, routes, origin, lot, onRoute])

  // No route to read the lot's position from: find it by address
  const needsGeocode = !lotPosition && (!origin || routeFailed)
  useEffect(() => {
    if (!geocoding || !needsGeocode) return
    let cancelled = false
    new geocoding.Geocoder()
      .geocode({ address: lotAddress(lot), region: 'vn' })
      .then(({ results }) => {
        const location = results[0]?.geometry.location
        if (!cancelled && location) setLotPosition(location.toJSON())
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [geocoding, needsGeocode, lot])

  // Keep both points in view when the route does not do it
  const showMarkersOnly = !origin || routeFailed
  useEffect(() => {
    if (!map || !showMarkersOnly) return
    if (lotPosition && origin) {
      const bounds = new google.maps.LatLngBounds()
      bounds.extend(lotPosition)
      bounds.extend(origin)
      map.fitBounds(bounds, 64)
    } else if (lotPosition) {
      map.panTo(lotPosition)
      map.setZoom(16)
    }
  }, [map, showMarkersOnly, lotPosition, origin])

  return (
    <>
      {lotPosition && <Marker position={lotPosition} title={lot.name} />}
      {origin && (
        <Marker
          position={origin}
          title="You are here"
          icon={{ path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#1a73e8', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 3 }}
        />
      )}
    </>
  )
}

/** Popup with a Google map: the parking lot, the customer's current position and the driving route between them. */
export function LotDirectionsDialog({ lot: openedLot, onClose }: { lot: DirectionsLot; onClose: () => void }) {
  // The lot list refreshes every few seconds; keep the lot as opened so the route is not asked for again
  const [lot] = useState(openedLot)
  const [origin, setOrigin] = useState<LatLng | null>(null)
  const [locate, setLocate] = useState<LocateState>(() => ('geolocation' in navigator ? 'locating' : 'unsupported'))
  const [route, setRoute] = useState<RouteInfo | null>(null)

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
          ? `${route.distance} • about ${route.duration} by car`
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
          {apiKey ? (
            <APIProvider apiKey={apiKey} language="en" region="VN">
              <Map defaultCenter={lotCoords(lot) ?? DEFAULT_CENTER} defaultZoom={14} gestureHandling="greedy" disableDefaultUI={false} clickableIcons={false}>
                {locate !== 'locating' && <RouteLayer lot={lot} origin={origin} onRoute={setRoute} />}
              </Map>
            </APIProvider>
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
