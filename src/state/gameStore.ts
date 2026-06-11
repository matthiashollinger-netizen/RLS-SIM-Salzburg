import { create } from 'zustand'
import type { Region } from '../data/schemas.ts'
import { seasonOf, type Season, type SimContext } from '../engine/time.ts'

/** Game clock + speed + world flags. The tick driver lives in simulation.ts. */

export type GameSpeed = 0 | 1 | 2 | 4
export type Weather = 'gut' | 'schlecht'
export type GameMode = 'schicht' | 'endlos'
export type Difficulty = 'entspannt' | 'realistisch' | 'albtraum'
export type PlayerRole = 'voll' | 'calltaker' | 'disponent'

export const DIFFICULTY_SETTINGS: Record<
  Difficulty,
  { callRateFactor: number; maxQueue: number }
> = {
  entspannt: { callRateFactor: 0.6, maxQueue: 3 },
  realistisch: { callRateFactor: 1, maxQueue: 4 },
  albtraum: { callRateFactor: 1.6, maxQueue: 6 },
}

export interface ShiftConfig {
  region: Region
  mode: GameMode
  difficulty: Difficulty
  role: PlayerRole
  month: number
  startHour: number
  startWeekday: number
}

interface GameState extends SimContext {
  simSec: number
  speed: GameSpeed
  running: boolean
  season: Season
  /** Heli no-go when 'schlecht' (GAME_MECHANICS §2 Heli-Logik) */
  weather: Weather
  region: Region
  /** incoming call generation (calltaker role) */
  callsEnabled: boolean
  mode: GameMode
  difficulty: Difficulty
  role: PlayerRole
  shiftStartSec: number
  shiftEndSec: number | null
  shiftOver: boolean
  setCallsEnabled: (v: boolean) => void
  setSpeed: (s: GameSpeed) => void
  setRunning: (r: boolean) => void
  setWeather: (w: Weather) => void
  setRegion: (r: Region) => void
  advance: (dt: number) => void
  markShiftOver: () => void
  startShift: (cfg: ShiftConfig) => void
  configure: (cfg: {
    startWeekday: number
    month: number
    startHour: number
    region?: Region
  }) => void
}

const SHIFT_HOURS = 8

export const useGameStore = create<GameState>((set) => ({
  simSec: 7.5 * 3600, // default shift start 07:30
  speed: 1,
  running: true,
  startWeekday: 1, // Monday
  month: 6,
  season: seasonOf(6),
  weather: 'gut',
  region: 'NORD',
  callsEnabled: true,
  mode: 'endlos',
  difficulty: 'realistisch',
  role: 'voll',
  shiftStartSec: 7.5 * 3600,
  shiftEndSec: null,
  shiftOver: false,
  setCallsEnabled: (callsEnabled) => set({ callsEnabled }),
  setSpeed: (speed) => set({ speed }),
  setRunning: (running) => set({ running }),
  setWeather: (weather) => set({ weather }),
  setRegion: (region) => set({ region }),
  advance: (dt) => set((s) => ({ simSec: s.simSec + dt })),
  markShiftOver: () => set({ shiftOver: true }),
  startShift: (cfg) =>
    set({
      region: cfg.region,
      mode: cfg.mode,
      difficulty: cfg.difficulty,
      role: cfg.role,
      month: cfg.month,
      season: seasonOf(cfg.month),
      startWeekday: cfg.startWeekday,
      simSec: cfg.startHour * 3600,
      shiftStartSec: cfg.startHour * 3600,
      shiftEndSec: cfg.mode === 'schicht' ? (cfg.startHour + SHIFT_HOURS) * 3600 : null,
      shiftOver: false,
      running: true,
      speed: 1,
      weather: 'gut',
      callsEnabled: true,
    }),
  configure: ({ startWeekday, month, startHour, region }) =>
    set((s) => ({
      startWeekday,
      month,
      season: seasonOf(month),
      simSec: startHour * 3600,
      region: region ?? s.region,
    })),
}))
