import { create } from 'zustand'

export interface LogEntry {
  id: number
  simSec: number
  kind: 'status' | 'funk' | 'einsatz' | 'system'
  text: string
  vehicleId?: string
  auftragId?: string
}

const MAX_ENTRIES = 500
let nextId = 1

interface EventLogState {
  entries: LogEntry[]
  append: (e: Omit<LogEntry, 'id'>) => void
  clear: () => void
}

export const useEventLog = create<EventLogState>((set) => ({
  entries: [],
  append: (e) =>
    set((s) => {
      const entries = [...s.entries, { ...e, id: nextId++ }]
      return { entries: entries.length > MAX_ENTRIES ? entries.slice(-MAX_ENTRIES) : entries }
    }),
  clear: () => set({ entries: [] }),
}))
