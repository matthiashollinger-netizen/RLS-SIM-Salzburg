import { hospitals } from '../data/index.ts'
import { haversineKm } from '../engine/geo.ts'
import { vehicleSim } from './simulation.ts'
import { useGameStore } from './gameStore.ts'
import { useEventLog } from './eventLog.ts'
import { shortCallSign } from '../lib/format.ts'

let testCounter = 1

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
      text: `ÜBUNG Probealarm für ${shortCallSign(vehicleId)}${target ? ` → ${target.short}` : ''}`,
    })
  }
  return ok
}
