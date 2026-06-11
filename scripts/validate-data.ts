/**
 * npm run validate-data — Zod-parses all data files and runs cross-reference
 * checks (unique funkrufnamen, station/code/hospital references).
 * Exits non-zero on any problem.
 */
import {
  balancing,
  categories,
  codes,
  crossValidate,
  helicopters,
  hospitals,
  stations,
  statusDefs,
  vehicles,
} from '../src/data/index.ts'

const counts = {
  codes: codes.length,
  categories: categories.length,
  status: statusDefs.length,
  stations: stations.length,
  vehicles: vehicles.length,
  hospitals: hospitals.length,
  helicopters: helicopters.length,
  categoryWeights: Object.keys(balancing.categoryWeights).length,
}

console.log('Data files parsed:', JSON.stringify(counts))

const problems = crossValidate()
if (problems.length > 0) {
  console.error(`\n${problems.length} cross-validation problem(s):`)
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}

const estimatedVehicles = vehicles.filter((v) => v.estimated).length
console.log(
  `OK — all schemas valid, cross-references consistent. ` +
    `(${estimatedVehicles}/${vehicles.length} vehicles flagged estimated)`,
)
