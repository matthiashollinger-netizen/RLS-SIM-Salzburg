import { create } from 'zustand'
import type { Region } from '../data/schemas.ts'
import { seasonOf, type Season, type SimContext } from '../engine/time.ts'

/** Game clock + speed + world flags. The tick driver lives in simulation.ts. */

export type GameSpeed = 0 | 1 | 2 | 4
export type Weather = 'gut' | 'schlecht'

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
  setCallsEnabled: (v: boolean) => void
  setSpeed: (s: GameSpeed) => void
  setRunning: (r: boolean) => void
  setWeather: (w: Weather) => void
  setRegion: (r: Region) => void
  advance: (dt: number) => void
  configure: (cfg: {
    startWeekday: number
    month: number
    startHour: number
    region?: Region
  }) => void
}

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
  setCallsEnabled: (callsEnabled) => set({ callsEnabled }),
  setSpeed: (speed) => set({ speed }),
  setRunning: (running) => set({ running }),
  setWeather: (weather) => set({ weather }),
  setRegion: (region) => set({ region }),
  advance: (dt) => set((s) => ({ simSec: s.simSec + dt })),
  configure: ({ startWeekday, month, startHour, region }) =>
    set((s) => ({
      startWeekday,
      month,
      season: seasonOf(month),
      simSec: startHour * 3600,
      region: region ?? s.region,
    })),
}))
