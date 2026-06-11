import {
  unitFromHelicopter,
  unitFromVehicle,
  VehicleSim,
} from '../engine/vehicleSim.ts'
import { balancing, helicopters, statusByCode, vehicles } from '../data/index.ts'
import { generateScenario } from '../engine/scenario.ts'
import { mulberry32 } from '../engine/rng.ts'
import { secondsOfDay } from '../engine/time.ts'
import { unitDisplayName } from '../lib/format.ts'
import { useEventLog } from './eventLog.ts'
import { useGameStore } from './gameStore.ts'

/** Singleton unit simulation (ground fleet + helicopters) wired to the event log. */
export const vehicleSim = new VehicleSim(Date.now() % 100000, [
  ...vehicles.map(unitFromVehicle),
  ...helicopters.map(unitFromHelicopter),
])

vehicleSim.addEventListener((e) => {
  const rt = vehicleSim.get(e.vehicleId)
  const name = rt ? unitDisplayName(rt.unit) : e.vehicleId
  if (e.type === 'spawn') {
    useEventLog.getState().append({
      simSec: e.simSec,
      kind: 'system',
      vehicleId: e.vehicleId,
      text: `${name} in Dienst`,
    })
  } else if (e.type === 'despawn') {
    useEventLog.getState().append({
      simSec: e.simSec,
      kind: 'system',
      vehicleId: e.vehicleId,
      text: `${name} außer Dienst`,
    })
  } else if (e.type === 'status' && e.to) {
    const label = statusByCode.get(e.to)?.label ?? ''
    useEventLog.getState().append({
      simSec: e.simSec,
      kind: 'status',
      vehicleId: e.vehicleId,
      text: `${name} → Status ${e.to}${label ? ` (${label})` : ''}${e.note ? ` — ${e.note}` : ''}`,
    })
  }
})

let loopHandle: ReturnType<typeof setInterval> | null = null
const REAL_TICK_MS = 250

// ---- incoming call generation (M5) ----
const callRng = mulberry32((Date.now() % 99991) + 7)
let nextCallAt: number | null = null
const MAX_QUEUE = 4 // solo playability cap (ANNAHMEN.md M5)

function scheduleNextCall(simSec: number) {
  const g = useGameStore.getState()
  // playable call rate: emergencies/day × mix factor for KT/Rückfragen etc.
  const perDay = balancing.calls[g.region].emergenciesPerDay * 1.6
  const hour = Math.floor(secondsOfDay(simSec) / 3600)
  const hourly = balancing.hourlyFactors[hour] ?? 1
  const ratePerSec = (perDay / 86400) * hourly
  const wait = -Math.log(Math.max(1e-6, callRng())) / Math.max(1e-9, ratePerSec)
  nextCallAt = simSec + Math.min(Math.max(wait, 25), 3600)
}

async function maybeGenerateCall(simSec: number) {
  const g = useGameStore.getState()
  if (!g.callsEnabled) return
  if (nextCallAt === null) scheduleNextCall(simSec)
  if (nextCallAt !== null && simSec >= nextCallAt) {
    scheduleNextCall(simSec)
    const { useCallStore } = await import('./callStore.ts')
    const { useDispatchStore } = await import('./dispatchStore.ts')
    const callState = useCallStore.getState()
    if (callState.queue.length >= MAX_QUEUE) return
    const open = Object.values(useDispatchStore.getState().auftraege)
      .filter((a) => a.state !== 'abgeschlossen' && a.sosi && simSec - a.createdAt < 1800)
      .map((a) => ({ id: a.id, ort: a.ort }))
    callState.incoming(
      generateScenario(callRng, { region: g.region, openIncidents: open }),
    )
  }
}

/** Start the global game loop once (idempotent — StrictMode-safe). */
export function startGameLoop() {
  if (loopHandle) return
  loopHandle = setInterval(() => {
    const g = useGameStore.getState()
    if (!g.running || g.speed === 0) return
    const dt = (REAL_TICK_MS / 1000) * g.speed
    g.advance(dt)
    const after = useGameStore.getState()
    vehicleSim.tick(after.simSec, {
      startWeekday: after.startWeekday,
      month: after.month,
      season: after.season,
    })
    void maybeGenerateCall(after.simSec)
    void import('./callStore.ts').then(({ useCallStore }) =>
      useCallStore.getState().tick(after.simSec),
    )
  }, REAL_TICK_MS)
}

export function stopGameLoop() {
  if (loopHandle) {
    clearInterval(loopHandle)
    loopHandle = null
  }
}
