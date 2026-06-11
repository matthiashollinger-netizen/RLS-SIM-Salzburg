import { hospitals } from '../data/index.ts'
import type { Hospital, HospitalCapabilities } from '../data/schemas.ts'
import { haversineKm, type LatLon } from './geo.ts'
import { routeTravelSec } from './routing.ts'

/**
 * Zielklinik-Matching (GAME_DATA §9): „nächstes KH ≠ richtiges KH".
 * Ranks hospitals by travel time; marks suitability against the required
 * capabilities. Choosing an unsuitable house causes a secondary transfer
 * (scored in M8).
 */

export interface HospitalCandidate {
  hospital: Hospital
  etaSec: number
  distanceKm: number
  suitable: boolean
  missing: string[]
}

export function matchHospitals(
  needs: Partial<HospitalCapabilities>,
  from: LatLon,
  sosi: boolean,
): HospitalCandidate[] {
  const out: HospitalCandidate[] = hospitals.map((hospital) => {
    const missing = (Object.keys(needs) as (keyof HospitalCapabilities)[]).filter(
      (k) => needs[k] && !hospital.capabilities[k],
    )
    return {
      hospital,
      etaSec: Math.round(
        routeTravelSec(from, { lat: hospital.lat, lon: hospital.lon }, { typ: 'RTW', sosi }),
      ),
      distanceKm: haversineKm(from, { lat: hospital.lat, lon: hospital.lon }),
      suitable: missing.length === 0,
      missing: missing as string[],
    }
  })
  out.sort((a, b) => a.etaSec - b.etaSec)
  return out
}

/** Closest suitable hospital (auto-suggestion). */
export function bestHospital(
  needs: Partial<HospitalCapabilities>,
  from: LatLon,
  sosi: boolean,
): HospitalCandidate | undefined {
  return matchHospitals(needs, from, sosi).find((c) => c.suitable)
}
