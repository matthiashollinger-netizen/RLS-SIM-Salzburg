import { create } from 'zustand'
import { buildReport, type ShiftReport } from '../engine/scoring.ts'
import { dbGet, dbSet } from '../persistence/db.ts'
import { useDispatchStore } from './dispatchStore.ts'
import { useCallStore } from './callStore.ts'
import { useGameStore } from './gameStore.ts'

/** Shift report + persistent history (IndexedDB store 'history'). */

const HISTORY_KEY = 'shift-reports'
const MAX_HISTORY = 50

interface ShiftState {
  report: ShiftReport | null
  history: ShiftReport[]
  showReport: boolean
  finishShift: () => void
  closeReport: () => void
  loadHistory: () => Promise<void>
}

export const useShiftStore = create<ShiftState>((set) => ({
  report: null,
  history: [],
  showReport: false,

  finishShift: () => {
    const g = useGameStore.getState()
    const dispatch = useDispatchStore.getState()
    const calls = useCallStore.getState().stats
    // close every still-open Auftrag so outcomes exist
    for (const a of Object.values(dispatch.auftraege)) {
      if (a.state !== 'abgeschlossen') dispatch.closeAuftrag(a.id)
    }
    const finished = Object.values(useDispatchStore.getState().auftraege)
    const report = buildReport(
      finished,
      { angenommen: calls.angenommen, auftraege: calls.auftraege, zugeordnet: calls.zugeordnet },
      {
        region: g.region,
        durationHours: Math.round(((g.simSec - g.shiftStartSec) / 3600) * 10) / 10,
        startedAtIso: new Date().toISOString(),
      },
    )
    g.setRunning(false)
    set((s) => {
      const history = [...s.history, report].slice(-MAX_HISTORY)
      void dbSet('history', HISTORY_KEY, history)
      return { report, history, showReport: true }
    })
  },

  closeReport: () => set({ showReport: false }),

  loadHistory: async () => {
    const history = (await dbGet<ShiftReport[]>('history', HISTORY_KEY)) ?? []
    set({ history })
  },
}))

/** Check for shift end — called from the game loop. */
export function checkShiftEnd() {
  const g = useGameStore.getState()
  if (g.mode !== 'schicht' || g.shiftOver) return
  if (g.shiftEndSec !== null && g.simSec >= g.shiftEndSec) {
    g.markShiftOver()
    useShiftStore.getState().finishShift()
  }
}
