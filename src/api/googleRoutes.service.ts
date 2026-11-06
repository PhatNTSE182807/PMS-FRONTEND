/**
 * Google Routes API (computeRoutes) for the lot directions map. The legacy Directions API cannot be
 * turned on for new Google Cloud projects, so the route comes from here instead of DirectionsService.
 * Uses fetch, not axiosClient: the call goes to Google and must not carry our auth header.
 */

export interface LatLngPoint {
  lat: number
  lng: number
}

export interface DrivingRoute {
  /** Route line in Google's encoded polyline format (decode with google.maps.geometry.encoding). */
  encodedPolyline: string
  distanceMeters: number
  durationSeconds: number
}

const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes'

const waypoint = (place: LatLngPoint | string) =>
  typeof place === 'string' ? { address: place } : { location: { latLng: { latitude: place.lat, longitude: place.lng } } }

/** Fastest driving route, or null when Google finds none. The destination may be an address. */
export async function computeDrivingRoute(apiKey: string, origin: LatLngPoint, destination: LatLngPoint | string, signal?: AbortSignal): Promise<DrivingRoute | null> {
  const res = await fetch(ROUTES_URL, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      // Only the fields the map needs (Google bills by the fields asked for)
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
    },
    body: JSON.stringify({ origin: waypoint(origin), destination: waypoint(destination), travelMode: 'DRIVE', languageCode: 'en', regionCode: 'VN' }),
  })
  if (!res.ok) throw new Error(`Google Routes failed (${res.status})`)
  const body = (await res.json()) as { routes?: { distanceMeters?: number; duration?: string; polyline?: { encodedPolyline?: string } }[] }
  const route = body.routes?.[0]
  if (!route?.polyline?.encodedPolyline) return null
  return {
    encodedPolyline: route.polyline.encodedPolyline,
    distanceMeters: route.distanceMeters ?? 0,
    // Durations come as "1234s"
    durationSeconds: Number.parseFloat(route.duration ?? '0'),
  }
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
