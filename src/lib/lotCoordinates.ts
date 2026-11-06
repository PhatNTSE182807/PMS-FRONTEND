/** A loose box around Vietnam, islands included; the backend checks the same range. */
export const COORDINATE_LIMITS = { minLat: 8, maxLat: 24, minLng: 102, maxLng: 118 }

/** Problem with a lot position, or null when it can be saved (both values or neither, inside Vietnam). */
export function coordinateError(latitude: number | null, longitude: number | null): string | null {
  if (latitude == null && longitude == null) return null
  if (latitude == null || longitude == null) return 'Enter both latitude and longitude, or leave both empty.'
  const { minLat, maxLat, minLng, maxLng } = COORDINATE_LIMITS
  if (latitude < minLat || latitude > maxLat) return `Latitude must be between ${minLat} and ${maxLat} (inside Vietnam).`
  if (longitude < minLng || longitude > maxLng) return `Longitude must be between ${minLng} and ${maxLng} (inside Vietnam).`
  return null
}
