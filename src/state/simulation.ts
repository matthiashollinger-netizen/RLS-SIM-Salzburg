import {
  unitFromHelicopter,
  unitFromVehicle,
  VehicleSim,
} from '../engine/vehicleSim.ts'
import { balancing, helicopters, statusByCode, vehicles } from '../data/index.ts'
import { generateScenario, type GenerateOpts } from '../engine/scenario.ts'
import { HAUPTBESCHWERDEN } from '../engine/abfrage.ts'
import { pickSonderlage } from '../engine/sonderlage.ts'
import { mulberry32 } from '../engine/rng.ts'
import { secondsOfDay, weekdayAt } from '../engine/time.ts'
import { unitDisplayName } from '../lib/format.ts'
import { useEventLog } from './eventLog.ts'
import { DIFFICULTY_SETTINGS, useGameStore } from './gameStore.ts'
import { useSonderlageStore } from './sonderlageStore.ts'

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
let lastSonderlageCheckHour = -1
/** one-shot scripted MANV: next generated call becomes this scenario */
let pendingManv: { hauptbeschwerdeId: string; personen: number } | null = null

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
  // active Sonderlage raises the call rate (Welt-Direktor)
  const active = useSonderlageStore.getState().active
  const sonderlageFactor = active ? active.def.callRateFactor : 1
  const ratePerSec =
    (perDay / 86400) *
    hourly *
    weekdayFactor *
    seasonFactor *
    difficultyFactor *
    sonderlageFactor
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
    // Welt-Direktor: time of day, weather and Sonderlage shape the incident mix
    const active = useSonderlageStore.getState().active
    const manv = pendingManv // consume the one-shot scripted MANV
    pendingManv = null
    const opts: GenerateOpts = {
      region: g.region,
      openIncidents: manv ? [] : open, // scripted MANV is always a fresh incident
      hour: Math.floor(secondsOfDay(simSec) / 3600),
      weather: g.weather,
      season: g.season,
    }
    if (active) opts.categoryFactors = active.def.categoryFactors
    if (manv) {
      opts.forceType = 'notfall'
      opts.forceHauptbeschwerde = manv.hauptbeschwerdeId
      opts.forceManvPersonen = manv.personen
    }
    const scenario = generateScenario(callRng, opts)
    if (g.role === 'disponent') {
      // KI-Calltaker handles the phone (GAME_MECHANICS §6)
      const { aiCalltakerReceive } = await import('./aiPartners.ts')
      aiCalltakerReceive(scenario, simSec)
    } else {
      const callState = useCallStore.getState()
      if (callState.queue.length >= DIFFICULTY_SETTINGS[g.difficulty].maxQueue) {
        if (manv) pendingManv = manv // a full queue must not swallow the MANV
        return
      }
      callState.incoming(scenario)
    }
  }
}

/**
 * Sonderlagen (Welt-Direktor): rare dynamic world events. Hourly start chance
 * (same seeded-rng pattern as driftWeather), expiry checked every tick.
 */
const SONDERLAGE_HOURLY_CHANCE = 0.08

function driftSonderlage(simSec: number) {
  const store = useSonderlageStore.getState()
  if (store.active && simSec >= store.active.endsAt) {
    const { name } = store.active.def
    store.end()
    useEventLog.getState().append({
      simSec,
      kind: 'system',
      text: `Sonderlage beendet: ${name}`,
    })
  }
  const hour = Math.floor(simSec / 3600)
  if (hour === lastSonderlageCheckHour) return
  // first check after a reset only arms the gate — the first roll happens
  // after a full sim hour, keeping the opening minutes of every shift calm
  const firstCheck = lastSonderlageCheckHour === -1
  lastSonderlageCheckHour = hour
  if (firstCheck) return
  const st = useSonderlageStore.getState()
  if (st.active) return
  if (callRng() >= SONDERLAGE_HOURLY_CHANCE) return
  const g = useGameStore.getState()
  const def = pickSonderlage(callRng, {
    month: g.month,
    hour: Math.floor(secondsOfDay(simSec) / 3600),
    weather: g.weather,
    region: g.region,
    exclude: st.recent,
  })
  if (!def) return
  st.start(def, simSec)
  if (def.forceWeather && g.weather !== def.forceWeather) g.setWeather(def.forceWeather)
  // the SONDERLAGE prefix keys ticker/toast UIs — keep it stable
  useEventLog.getState().append({
    simSec,
    kind: 'system',
    text: `SONDERLAGE: ${def.name} — ${def.tickerText}`,
  })
  if (def.scriptedManv) {
    const m = def.scriptedManv
    const hb = HAUPTBESCHWERDEN.find((h) => h.categoryId === m.categoryId)
    pendingManv = {
      hauptbeschwerdeId: hb?.id ?? 'verkehrsunfall',
      personen: m.personenMin + Math.floor(callRng() * (m.personenMax - m.personenMin + 1)),
    }
  }
}

/** Weather drift: hourly 15% flip chance (GAME_MECHANICS §3 Wetter-System). */
function driftWeather(simSec: number) {
  const hour = Math.floor(simSec / 3600)
  if (hour === lastWeatherCheckHour) return
  lastWeatherCheckHour = hour
  const g = useGameStore.getState()
  // an active Sonderlage may pin the weather (e.g. Sturmfront)
  const forced = useSonderlageStore.getState().active?.def.forceWeather
  if (forced) {
    if (g.weather !== forced) g.setWeather(forced)
    return
  }
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
  driftSonderlage(simSec)
  driftWeather(simSec)
  void maybeGenerateCall(simSec)
  const { useCallStore } = await import('./callStore.ts')
  useCallStore.getState().tick(simSec)
  const { useDispatchStore } = await import('./dispatchStore.ts')
  useDispatchStore.getState().tick(simSec)
  const ai = await import('./aiPartners.ts')
  if (g.role === 'disponent') ai.aiCalltakerTick(simSec)
  if (g.role === 'calltaker') ai.aiDispatcherTick(simSec)
  const { useUebungStore } = await import('./uebungStore.ts')
  useUebungStore.getState().tick(simSec)
  const { storyTick } = await import('./storyStore.ts')
  storyTick(simSec)
  const { checkShiftEnd } = await import('./shiftStore.ts')
  checkShiftEnd()
}

// ---- street routing graph (Rework: Fahrzeuge folgen der Straße) ----
let roadGraphRequested = false

async function loadRoads() {
  if (roadGraphRequested) return
  roadGraphRequested = true
  try {
    const { isRoadGraphLoaded, loadRoadGraph } = await import('../engine/roadGraph.ts')
    if (isRoadGraphLoaded()) return
    const base = import.meta.env.BASE_URL ?? './'
    const res = await fetch(`${base}roads-sbg.json`)
    if (!res.ok) throw new Error(String(res.status))
    loadRoadGraph(await res.json())
    useEventLog.getState().append({
      simSec: useGameStore.getState().simSec,
      kind: 'system',
      text: 'Straßennetz geladen — Routen folgen jetzt dem Straßenverlauf.',
    })
  } catch {
    // fallback model (Luftlinie × Umwegfaktor) keeps working
    roadGraphRequested = false
  }
}

/** Start the global game loop once (idempotent — StrictMode-safe). */
export function startGameLoop() {
  void loadRoads()
  if (loopHandle) return
  loopHandle = setInterval(() => {
    const g = useGameStore.getState()
    if (!g.running || g.speed === 0) return
    // coop guests mirror the host instead of simulating (M9)
    const coop = coopGuestCheck?.()
    if (coop) return
    const dt = (REAL_TICK_MS / 1000) * g.speed
    g.advance(dt)
    void tickWorld(useGameStore.getState().simSec)
  }, REAL_TICK_MS)
}

let coopGuestCheck: (() => boolean) | null = null
void import('./coopStore.ts').then((m) => {
  coopGuestCheck = m.isCoopGuest
})

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
  // entry COUNT pins at the log's 500-entry cap — compare the monotone id
  const lastLogId = (entries: { id: number }[]) => entries[entries.length - 1]?.id ?? 0
  const logBefore = lastLogId(useEventLog.getState().entries)
  const queueBefore = useCallStore.getState().queue.length
  for (let i = 0; i < 180; i++) {
    useGameStore.getState().advance(5)
    await tickWorld(useGameStore.getState().simSec)
    if (
      lastLogId(useEventLog.getState().entries) > logBefore ||
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
  lastSonderlageCheckHour = -1
  pendingManv = null
  useSonderlageStore.getState().reset()
  const [{ useDispatchStore }, { useCallStore }, { useFunkStore }, { useHospitalLoad }, ai] =
    await Promise.all([
      import('./dispatchStore.ts'),
      import('./callStore.ts'),
      import('./funkStore.ts'),
      import('./hospitalLoadStore.ts'),
      import('./aiPartners.ts'),
    ])
  useDispatchStore.getState().reset()
  useCallStore.getState().reset()
  useFunkStore.getState().reset()
  useHospitalLoad.getState().reset()
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
