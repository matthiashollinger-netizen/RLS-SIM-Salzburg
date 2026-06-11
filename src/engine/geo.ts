export interface LatLon {
  lat: number
  lon: number
}

const EARTH_RADIUS_KM = 6371

/** Great-circle distance in km (CLAUDE.md §3 routing basis). */
export function haversineKm(a: LatLon, b: LatLon): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

/** Ray-casting point-in-polygon; polygon as [lon, lat][] ring. */
export function pointInPolygon(p: LatLon, polygon: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!
    const [xj, yj] = polygon[j]!
    const intersects =
      yi > p.lat !== yj > p.lat && p.lon < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

/** Linear interpolation between two points, t in [0,1]. */
export function lerpLatLon(a: LatLon, b: LatLon, t: number): LatLon {
  const c = Math.min(1, Math.max(0, t))
  return { lat: a.lat + (b.lat - a.lat) * c, lon: a.lon + (b.lon - a.lon) * c }
}
