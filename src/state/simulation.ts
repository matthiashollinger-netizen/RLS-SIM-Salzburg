import {
  unitFromHelicopter,
  unitFromVehicle,
  VehicleSim,
} from '../engine/vehicleSim.ts'
import { balancing, helicopters, statusByCode, vehicles } from '../data/index.ts'
import { generateScenario } from '../engine/scenario.ts'
import { mulberry32 } from '../engine/rng.ts'
import { secondsOfDay, weekdayAt } from '../engine/time.ts'
import { unitDisplayName } from '../lib/format.ts'
import { useEventLog } from './eventLog.ts'
import { DIFFICULTY_SETTINGS, useGameStore } from './gameStore.ts'

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

// ---- incoming call generation (M5/M8) ----
const callRng = mulberry32((Date.now() % 99991) + 7)
let nextCallAt: number | null = null
let lastWeatherCheckHour = -1

function scheduleNextCall(simSec: number) {
  const g = useGameStore.getState()
  // playable call rate: emergencies/day × mix factor, scaled by difficulty,
  // weekday + season factors (GAME_DATA Balancing-Block — Tagesgang aktiv)
  const perDay = balancing.calls[g.region].emergenciesPerDay * 1.6
  const hour = Math.floor(secondsOfDay(simSec) / 3600)
  const hourly = balancing.hourlyFactors[hour] ?? 1
  const weekday = String(weekdayAt(simSec, g))
  const weekdayFactor = balancing.weekdayFactors[weekday] ?? 1
  const seasonFactor =
    g.season === 'winter'
      ? balancing.seasons.winterFactor
      : g.season === 'summer'
        ? balancing.seasons.summerFactor
        : 1
  const difficultyFactor = DIFFICULTY_SETTINGS[g.difficulty].callRateFactor
  const ratePerSec =
    (perDay / 86400) * hourly * weekdayFactor * seasonFactor * difficultyFactor
  const wait = -Math.log(Math.max(1e-6, callRng())) / Math.max(1e-9, ratePerSec)
  nextCallAt = simSec + Math.min(Math.max(wait, 25), 3600)
}

async function maybeGenerateCall(simSec: number) {
  const g = useGameStore.getState()
  if (!g.callsEnabled || g.shiftOver) return
  if (nextCallAt === null) scheduleNextCall(simSec)
  if (nextCallAt !== null && simSec >= nextCallAt) {
    scheduleNextCall(simSec)
    const { useCallStore } = await import('./callStore.ts')
    const { useDispatchStore } = await import('./dispatchStore.ts')
    const open = Object.values(useDispatchStore.getState().auftraege)
      .filter((a) => a.state !== 'abgeschlossen' && a.sosi && simSec - a.createdAt < 1800)
      .map((a) => ({ id: a.id, ort: a.ort }))
    const scenario = generateScenario(callRng, { region: g.region, openIncidents: open })
    if (g.role === 'disponent') {
      // KI-Calltaker handles the phone (GAME_MECHANICS §6)
      const { aiCalltakerReceive } = await import('./aiPartners.ts')
      aiCalltakerReceive(scenario, simSec)
    } else {
      const callState = useCallStore.getState()
      if (callState.queue.length >= DIFFICULTY_SETTINGS[g.difficulty].maxQueue) return
      callState.incoming(scenario)
    }
  }
}

/** Weather drift: hourly 15% flip chance (GAME_MECHANICS §3 Wetter-System). */
function driftWeather(simSec: number) {
  const hour = Math.floor(simSec / 3600)
  if (hour === lastWeatherCheckHour) return
  lastWeatherCheckHour = hour
  const g = useGameStore.getState()
  if (callRng() < 0.15) {
    g.setWeather(g.weather === 'gut' ? 'schlecht' : 'gut')
    useEventLog.getState().append({
      simSec,
      kind: 'system',
      text:
        useGameStore.getState().weather === 'schlecht'
          ? 'Wetterumschwung: Flugbetrieb eingestellt!'
          : 'Wetterbesserung: Hubschrauber wieder verfügbar.',
    })
  }
}

async function tickWorld(simSec: number) {
  const g = useGameStore.getState()
  vehicleSim.tick(simSec, {
    startWeekday: g.startWeekday,
    month: g.month,
    season: g.season,
  })
  driftWeather(simSec)
  void maybeGenerateCall(simSec)
  const { useCallStore } = await import('./callStore.ts')
  useCallStore.getState().tick(simSec)
  const ai = await import('./aiPartners.ts')
  if (g.role === 'disponent') ai.aiCalltakerTick(simSec)
  if (g.role === 'calltaker') ai.aiDispatcherTick(simSec)
  const { checkShiftEnd } = await import('./shiftStore.ts')
  checkShiftEnd()
}

/** Start the global game loop once (idempotent — StrictMode-safe). */
export function startGameLoop() {
  if (loopHandle) return
  loopHandle = setInterval(() => {
    const g = useGameStore.getState()
    if (!g.running || g.speed === 0) return
    const dt = (REAL_TICK_MS / 1000) * g.speed
    g.advance(dt)
    void tickWorld(useGameStore.getState().simSec)
  }, REAL_TICK_MS)
}

/**
 * Zeitsprung „bis zum nächsten Ereignis" (CLAUDE.md M8): fast-forwards the
 * simulation in 5-s steps until something happens (log entry, incoming call)
 * or 15 sim-minutes have passed.
 */
export async function jumpToNextEvent() {
  const { useCallStore } = await import('./callStore.ts')
  const { useEventLog } = await import('./eventLog.ts')
  const g = useGameStore.getState()
  if (!g.running || g.shiftOver) return
  const logBefore = useEventLog.getState().entries.length
  const queueBefore = useCallStore.getState().queue.length
  for (let i = 0; i < 180; i++) {
    useGameStore.getState().advance(5)
    await tickWorld(useGameStore.getState().simSec)
    if (
      useEventLog.getState().entries.length > logBefore ||
      useCallStore.getState().queue.length > queueBefore
    )
      break
  }
}

/** Reset the whole world for a fresh shift (M8 Hauptmenü). */
export async function resetWorld() {
  vehicleSim.resetAll()
  nextCallAt = null
  lastWeatherCheckHour = -1
  const [{ useDispatchStore }, { useCallStore }, { useFunkStore }, ai] = await Promise.all([
    import('./dispatchStore.ts'),
    import('./callStore.ts'),
    import('./funkStore.ts'),
    import('./aiPartners.ts'),
  ])
  useDispatchStore.getState().reset()
  useCallStore.getState().reset()
  useFunkStore.getState().reset()
  useEventLog.getState().clear()
  ai.aiCalltakerReset()
  ai.aiDispatcherReset()
}

export function stopGameLoop() {
  if (loopHandle) {
    clearInterval(loopHandle)
    loopHandle = null
  }
}
