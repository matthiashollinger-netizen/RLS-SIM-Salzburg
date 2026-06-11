import {
  unitFromHelicopter,
  unitFromVehicle,
  VehicleSim,
} from '../engine/vehicleSim.ts'
import { helicopters, statusByCode, vehicles } from '../data/index.ts'
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
  }, REAL_TICK_MS)
}

export function stopGameLoop() {
  if (loopHandle) {
    clearInterval(loopHandle)
    loopHandle = null
  }
}
