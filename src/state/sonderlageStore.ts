import { create } from 'zustand'
import type { SonderlageDef } from '../engine/sonderlage.ts'

/**
 * Active Sonderlage (dynamic world event) — driven by simulation.ts.
 * UI panels subscribe with narrow selectors; the sim reads via getState().
 */

export interface ActiveSonderlage {
  def: SonderlageDef
  /** simSec when the event started */
  startedAt: number
  /** simSec when the event expires */
  endsAt: number
}

/** how many finished event ids are kept to avoid immediate repeats */
const RECENT_MAX = 3

interface SonderlageState {
  active: ActiveSonderlage | null
  /** ids of recently finished events (newest last) */
  recent: string[]
  start: (def: SonderlageDef, simSec: number) => void
  end: () => void
  reset: () => void
}

export const useSonderlageStore = create<SonderlageState>((set) => ({
  active: null,
  recent: [],
  start: (def, simSec) =>
    set({ active: { def, startedAt: simSec, endsAt: simSec + def.durationSec } }),
  end: () =>
    set((s) =>
      s.active
        ? { active: null, recent: [...s.recent, s.active.def.id].slice(-RECENT_MAX) }
        : s,
    ),
  reset: () => set({ active: null, recent: [] }),
}))
