import { balancing, categoryById, hospitals, places } from '../data/index.ts'
import { haversineKm } from '../engine/geo.ts'
import { generateScenario } from '../engine/scenario.ts'
import { mulberry32 } from '../engine/rng.ts'
import { vehicleSim } from './simulation.ts'
import { useGameStore } from './gameStore.ts'
import { useEventLog } from './eventLog.ts'
import { useDispatchStore } from './dispatchStore.ts'
import { useCallStore } from './callStore.ts'
import { unitDisplayName } from '../lib/format.ts'

const demoRng = mulberry32(4242)

/**
 * Deterministic demo call for testing/tutorial: Festnetz INTERN Brustschmerz,
 * caller knows the address, no disturbances.
 */
export function simulateDemoCall(): void {
  const region = useGameStore.getState().region
  const scenario = generateScenario(demoRng, {
    region,
    forceType: 'notfall',
    forceHauptbeschwerde: 'brustschmerz',
  })
  scenario.phone = 'festnetz'
  scenario.anschlussAdresse = { ...scenario.truth.ort }
  scenario.anrufer.kenntAdresse = true
  scenario.anrufer.emotion = 'aufgeregt'
  scenario.anrufer.sprache = 'de'
  scenario.stoerungen = []
  scenario.amlAfterSec = undefined
  scenario.amlRadiusM = undefined
  useCallStore.getState().incoming(scenario)
}

let testCounter = 1

/**
 * Debug helper (M4): create a random Auftrag like the scenario engine (M5)
 * will — weighted category, real place + street, small position scatter.
 */
export function createRandomAuftrag(): string {
  const region = useGameStore.getState().region
  const weighted = Object.entries(balancing.categoryWeights)
    .map(([id, w]) => ({ id, weight: w[region] ?? w.base }))
    .filter((w) => w.weight > 0 && categoryById.has(w.id))
  let roll = Math.random() * weighted.reduce((s, w) => s + w.weight, 0)
  let categoryId = weighted[0]!.id
  for (const w of weighted) {
    roll -= w.weight
    if (roll <= 0) {
      categoryId = w.id
      break
    }
  }
  const regionPlaces = places.filter((p) => p.region === region)
  const place = regionPlaces[Math.floor(Math.random() * regionPlaces.length)]!
  const strasse = place.strassen[Math.floor(Math.random() * place.strassen.length)]!
  const personen = Math.random() < 0.05 ? 6 + Math.floor(Math.random() * 10) : 1
  return useDispatchStore.getState().createAuftrag({
    categoryId,
    severity: Math.random() < 0.6 ? 'hoch' : 'normal',
    personen,
    ort: {
      lat: place.lat + (Math.random() - 0.5) * 0.01,
      lon: place.lon + (Math.random() - 0.5) * 0.014,
      stadtteil: place.name,
      strasse,
    },
    merkmalskette: ['Testeinsatz (Debug-Generator M4)'],
    uebung: true,
  })
}

/**
 * Debug helper (M3): exercise the full status lifecycle without the dispatch
 * core (M4). Creates a ÜBUNG assignment ~2–6 km away with transport to the
 * nearest basic-care hospital.
 */
export function probealarm(vehicleId: string): boolean {
  const rt = vehicleSim.get(vehicleId)
  if (!rt) return false
  const simSec = useGameStore.getState().simSec
  const from = vehicleSim.posOf(rt, simSec)
  const angle = Math.random() * Math.PI * 2
  const distDeg = 0.02 + Math.random() * 0.04
  const einsatzort = {
    lat: from.lat + Math.sin(angle) * distDeg,
    lon: from.lon + Math.cos(angle) * distDeg,
  }
  const target = hospitals
    .filter((h) => h.capabilities.basic && !h.external)
    .sort((a, b) => haversineKm(einsatzort, a) - haversineKm(einsatzort, b))[0]
  const ok = vehicleSim.dispatch(
    vehicleId,
    {
      id: `uebung-${testCounter++}`,
      label: 'ÜBUNG Probealarm',
      einsatzort,
      sosi: true,
      transport: !!target,
      zielort: target ? { lat: target.lat, lon: target.lon } : undefined,
      zielName: target?.short,
    },
    simSec,
  )
  if (ok) {
    useEventLog.getState().append({
      simSec,
      kind: 'einsatz',
      vehicleId,
      text: `ÜBUNG Probealarm für ${unitDisplayName(rt.unit)}${target ? ` → ${target.short}` : ''}`,
    })
  }
  return ok
}
