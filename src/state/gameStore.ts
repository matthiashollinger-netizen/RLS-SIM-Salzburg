import { create } from 'zustand'
import { seasonOf, type Season, type SimContext } from '../engine/time.ts'

/** Game clock + speed. The tick driver lives in gameLoop.ts. */

export type GameSpeed = 0 | 1 | 2 | 4

interface GameState extends SimContext {
  simSec: number
  speed: GameSpeed
  running: boolean
  season: Season
  setSpeed: (s: GameSpeed) => void
  setRunning: (r: boolean) => void
  advance: (dt: number) => void
  configure: (cfg: { startWeekday: number; month: number; startHour: number }) => void
}

export const useGameStore = create<GameState>((set) => ({
  simSec: 7.5 * 3600, // default shift start 07:30
  speed: 1,
  running: true,
  startWeekday: 1, // Monday
  month: 6,
  season: seasonOf(6),
  setSpeed: (speed) => set({ speed }),
  setRunning: (running) => set({ running }),
  advance: (dt) => set((s) => ({ simSec: s.simSec + dt })),
  configure: ({ startWeekday, month, startHour }) =>
    set({ startWeekday, month, season: seasonOf(month), simSec: startHour * 3600 }),
}))
