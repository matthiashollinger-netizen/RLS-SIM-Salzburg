import { balancing } from '../data/index.ts'
import { haversineKm, pointInPolygon, type LatLon } from './geo.ts'
import { routeRoad } from './roadGraph.ts'
import type { VehicleType } from '../data/schemas.ts'

/**
 * Deterministic travel-time model (CLAUDE.md §3):
 * time = haversine distance × detour factor / v(typ, sosi, terrain).
 * Base 60 km/h rural, 35 km/h inside the Salzburg city polygon, +30% with SoSi.
 * Helicopter: 220 km/h straight line + 3 min start. All factors from balancing.json.
 * No external routing service at runtime; an OSRM adapter may replace this in
 * Phase 2 (interface: routeTravelSec below).
 */

export interface TravelOptions {
  typ: VehicleType | 'HELI'
  sosi: boolean
}

function groundSpeedKmh(from: LatLon, to: LatLon, sosi: boolean): number {
  const { speedRuralKmh, speedCityKmh, sosiSpeedFactor, cityPolygon } = balancing.routing
  const fromCity = pointInPolygon(from, cityPolygon as [number, number][])
  const toCity = pointInPolygon(to, cityPolygon as [number, number][])
  let base: number
  if (fromCity && toCity) base = speedCityKmh
  else if (fromCity || toCity)
    base = (speedCityKmh + speedRuralKmh) / 2 // mixed route approximation
  else base = speedRuralKmh
  return sosi ? base * sosiSpeedFactor : base
}

/** Travel time in seconds. The OSRM adapter interface for Phase 2 mirrors this. */
export function routeTravelSec(from: LatLon, to: LatLon, opts: TravelOptions): number {
  const dist = haversineKm(from, to)
  if (opts.typ === 'HELI') {
    const { heliSpeedKmh, heliStartMin } = balancing.routing
    return heliStartMin * 60 + (dist / heliSpeedKmh) * 3600
  }
  const km = dist * balancing.routing.detourFactor
  const v = groundSpeedKmh(from, to, opts.sosi)
  return (km / v) * 3600
}

export interface GroundRoute {
  sec: number
  km: number
  /** street polyline (only when the road graph is loaded) */
  path?: LatLon[]
}

/**
 * Ground route following real streets when the road graph is available
 * (Rework: Luftlinie nur für Helis); falls back to the haversine model
 * otherwise (tests, graph still loading).
 */
export function routeGround(from: LatLon, to: LatLon, opts: TravelOptions): GroundRoute {
  if (opts.typ !== 'HELI') {
    const road = routeRoad(from, to)
    if (road) {
      const sosiFactor = opts.sosi ? balancing.routing.sosiSpeedFactor : 1
      return { sec: (road.timeH * 3600) / sosiFactor, km: road.km, path: road.path }
    }
  }
  return { sec: routeTravelSec(from, to, opts), km: haversineKm(from, to) }
}
