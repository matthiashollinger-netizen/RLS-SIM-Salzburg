import type { LatLon } from './geo.ts'
import { haversineKm } from './geo.ts'
import { routeGround } from './routing.ts'
import { isAvailable } from './status.ts'
import type { DutyContext } from './duty.ts'
import type { UnitType } from './ao.ts'
import type { VehicleRuntime, VehicleSim } from './vehicleSim.ts'

/**
 * Nächstes-geeignetes-Mittel-Suche (CLAUDE.md M4): rank available units of an
 * acceptable type by estimated time-to-scene (turnout + travel). Helicopter
 * candidates additionally respect the weather flag (GAME_MECHANICS §2 Heli-Logik;
 * daylight/season is handled by the unit's in-service state).
 */

export interface SearchContext extends DutyContext {
  simSec: number
  weather: 'gut' | 'schlecht'
}

export interface UnitCandidate {
  id: string
  runtime: VehicleRuntime
  etaSec: number
  distanceKm: number
  /** Slot preference rank (index in the requirement's type list) */
  typeRank: number
}

function matchesType(rt: VehicleRuntime, types: UnitType[]): number {
  for (let i = 0; i < types.length; i++) {
    const t = types[i]!
    if (t === 'NKTW') {
      if (rt.unit.typ === 'KTW' && rt.unit.notfallKtw) return i
    } else if (rt.unit.typ === t) {
      return i
    }
  }
  return -1
}

export function findUnits(
  sim: VehicleSim,
  types: UnitType[],
  einsatzort: LatLon,
  sosi: boolean,
  ctx: SearchContext,
  limit = 8,
): UnitCandidate[] {
  const out: UnitCandidate[] = []
  for (const rt of sim.all()) {
    if (!isAvailable(rt.status)) continue
    const typeRank = matchesType(rt, types)
    if (typeRank < 0) continue
    if (rt.unit.typ === 'HELI' && ctx.weather === 'schlecht') continue
    const pos = sim.posOf(rt, ctx.simSec)
    const travel = routeGround(pos, einsatzort, { typ: rt.unit.typ, sosi }).sec
    const turnout = sim.estimateTurnoutSec(rt.id, ctx.simSec)
    out.push({
      id: rt.id,
      runtime: rt,
      etaSec: Math.round(turnout + travel),
      distanceKm: haversineKm(pos, einsatzort),
      typeRank,
    })
  }
  // primary: ETA; type preference only breaks near-ties (±60 s)
  out.sort((a, b) => {
    if (Math.abs(a.etaSec - b.etaSec) > 60) return a.etaSec - b.etaSec
    if (a.typeRank !== b.typeRank) return a.typeRank - b.typeRank
    return a.etaSec - b.etaSec
  })
  return out.slice(0, limit)
}
