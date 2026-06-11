import codesJson from './codes.json'
import categoriesJson from './categories.json'
import statusJson from './status.json'
import stationsJson from './stations.json'
import vehiclesJson from './vehicles.json'
import hospitalsJson from './hospitals.json'
import helicoptersJson from './helicopters.json'
import balancingJson from './balancing.json'
import {
  balancingSchema,
  categoriesFileSchema,
  codesFileSchema,
  helicoptersFileSchema,
  hospitalsFileSchema,
  stationsFileSchema,
  statusFileSchema,
  vehiclesFileSchema,
  type Balancing,
  type Category,
  type EinsatzCode,
  type Helicopter,
  type Hospital,
  type Station,
  type StatusDef,
  type Vehicle,
} from './schemas.ts'

/**
 * Single validated access point for all static game data.
 * Parsing happens once at module load; invalid data fails loudly.
 */

export const codes: EinsatzCode[] = codesFileSchema.parse(codesJson)
export const categories: Category[] = categoriesFileSchema.parse(categoriesJson)
export const statusDefs: StatusDef[] = statusFileSchema.parse(statusJson)
export const stations: Station[] = stationsFileSchema.parse(stationsJson)
export const vehicles: Vehicle[] = vehiclesFileSchema.parse(vehiclesJson)
export const hospitals: Hospital[] = hospitalsFileSchema.parse(hospitalsJson)
export const helicopters: Helicopter[] = helicoptersFileSchema.parse(helicoptersJson)
export const balancing: Balancing = balancingSchema.parse(balancingJson)

export const codeByCode = new Map(codes.map((c) => [c.code, c]))
export const categoryById = new Map(categories.map((c) => [c.id, c]))
export const statusByCode = new Map(statusDefs.map((s) => [s.code, s]))
export const stationById = new Map(stations.map((s) => [s.id, s]))
export const vehicleByFunkrufname = new Map(vehicles.map((v) => [v.funkrufname, v]))
export const hospitalById = new Map(hospitals.map((h) => [h.id, h]))

/**
 * Cross-reference checks beyond per-file schemas.
 * Returns a list of problems (empty = consistent).
 */
export function crossValidate(): string[] {
  const problems: string[] = []

  // Unique funkrufnamen (GAME_DATA §5 anomalies must be resolved in data)
  const seen = new Set<string>()
  for (const v of vehicles) {
    if (seen.has(v.funkrufname)) problems.push(`duplicate funkrufname: ${v.funkrufname}`)
    seen.add(v.funkrufname)
  }

  // Vehicles reference existing stations
  for (const v of vehicles) {
    if (!stationById.has(v.homeStation))
      problems.push(`vehicle ${v.funkrufname}: unknown homeStation "${v.homeStation}"`)
  }

  // Categories reference existing codes
  for (const c of categories) {
    if (!codeByCode.has(c.defaultCode))
      problems.push(`category ${c.id}: unknown defaultCode "${c.defaultCode}"`)
    if (c.altCode && !codeByCode.has(c.altCode))
      problems.push(`category ${c.id}: unknown altCode "${c.altCode}"`)
  }

  // Position status codes reference existing hospitals
  for (const s of statusDefs) {
    if (s.positionHospital && !hospitalById.has(s.positionHospital))
      problems.push(`status ${s.code}: unknown positionHospital "${s.positionHospital}"`)
  }

  // Hospital position codes exist in status defs
  for (const h of hospitals) {
    if (h.positionsCode && !statusByCode.has(h.positionsCode))
      problems.push(`hospital ${h.id}: unknown positionsCode "${h.positionsCode}"`)
  }

  // Vehicle vorhalteposition codes exist
  for (const v of vehicles) {
    if (v.vorhalteposition && !statusByCode.has(v.vorhalteposition))
      problems.push(`vehicle ${v.funkrufname}: unknown vorhalteposition "${v.vorhalteposition}"`)
  }

  // Category weights reference existing categories
  for (const id of Object.keys(balancing.categoryWeights)) {
    if (!categoryById.has(id)) problems.push(`balancing.categoryWeights: unknown category "${id}"`)
  }

  // Non-reserve vehicles need at least one duty window
  for (const v of vehicles) {
    if (!v.reserve && v.dienstzeiten.length === 0)
      problems.push(`vehicle ${v.funkrufname}: no duty windows and not a reserve`)
  }

  return problems
}
