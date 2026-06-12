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

/** Cumulative distances (km) along a polyline; index 0 = 0. */
export function pathCumulativeKm(path: LatLon[]): number[] {
  const cum = [0]
  for (let i = 1; i < path.length; i++) {
    cum.push(cum[i - 1]! + haversineKm(path[i - 1]!, path[i]!))
  }
  return cum
}

/** Position along a polyline at `fraction` (0..1) of its total length. */
export function pathPosition(path: LatLon[], cum: number[], fraction: number): LatLon {
  const total = cum[cum.length - 1] ?? 0
  if (total === 0 || path.length < 2) return path[path.length - 1] ?? { lat: 0, lon: 0 }
  const target = Math.min(1, Math.max(0, fraction)) * total
  let lo = 0
  let hi = cum.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (cum[mid]! < target) lo = mid + 1
    else hi = mid
  }
  const i = Math.max(1, lo)
  const segLen = cum[i]! - cum[i - 1]!
  const t = segLen === 0 ? 0 : (target - cum[i - 1]!) / segLen
  return lerpLatLon(path[i - 1]!, path[i]!, t)
}

/** Circle polygon (lon/lat ring) around a center, radius in meters. */
export function geoCircle(center: LatLon, radiusM: number, points = 48): [number, number][] {
  const ring: [number, number][] = []
  const latR = radiusM / 111320
  const lonR = radiusM / (111320 * Math.cos((center.lat * Math.PI) / 180))
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2
    ring.push([center.lon + Math.cos(a) * lonR, center.lat + Math.sin(a) * latR])
  }
  return ring
}
