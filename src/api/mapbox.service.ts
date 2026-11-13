/**
 * Mapbox web services for the lot directions map (driving route and address search).
 * Uses fetch, not axiosClient: these calls go to api.mapbox.com and must not carry our auth header.
 */

import type { LineString } from 'geojson'

export interface LngLat {
  lng: number
  lat: number
}

export interface DrivingRoute {
  /** Route line as GeoJSON, ready for a map line layer. */
  geometry: LineString
  distanceMeters: number
  durationSeconds: number
}

const API = 'https://api.mapbox.com'

/** Public Mapbox access token (pk.…); the map is hidden when empty. */
export const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? ''

/** Fastest driving route between two points, or null when Mapbox finds none. */
export async function getDrivingRoute(from: LngLat, to: LngLat, signal?: AbortSignal): Promise<DrivingRoute | null> {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`
  const params = new URLSearchParams({ geometries: 'geojson', overview: 'full', access_token: mapboxToken })
  const res = await fetch(`${API}/directions/v5/mapbox/driving/${coords}?${params}`, { signal })
  if (!res.ok) throw new Error(`Mapbox Directions failed (${res.status})`)
  const body = (await res.json()) as { routes?: { geometry: LineString; distance: number; duration: number }[] }
  const route = body.routes?.[0]
  return route ? { geometry: route.geometry, distanceMeters: route.distance, durationSeconds: route.duration } : null
}

/** Position of an address in Vietnam, or null when it is not found. */
export async function geocodeAddress(address: string, signal?: AbortSignal): Promise<LngLat | null> {
  const params = new URLSearchParams({ q: address, country: 'vn', limit: '1', access_token: mapboxToken })
  const res = await fetch(`${API}/search/geocode/v6/forward?${params}`, { signal })
  if (!res.ok) throw new Error(`Mapbox Geocoding failed (${res.status})`)
  const body = (await res.json()) as { features?: { geometry: { coordinates: [number, number] } }[] }
  const point = body.features?.[0]?.geometry.coordinates
  return point ? { lng: point[0], lat: point[1] } : null
}

/** "850 m" or "3.2 km". */
export const formatDistance = (meters: number) => (meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`)

/** "12 min" or "1 h 5 min". */
export function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes} min`
  const rest = minutes % 60
  return rest ? `${Math.floor(minutes / 60)} h ${rest} min` : `${minutes / 60} h`
}
