import { create } from 'zustand'
import { dbGet, dbSet } from '../persistence/db.ts'
import type { ShiftReport } from '../engine/scoring.ts'

/** Local achievements (M10), persisted in IndexedDB. */

export interface AchievementDef {
  id: string
  title: string
  description: string
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'erste-schicht', title: 'Erste Schicht', description: 'Eine Schicht abgeschlossen.' },
  {
    id: 'goldener-hoerer',
    title: 'Goldener Hörer',
    description: '100 % Stichwortgenauigkeit bei mindestens 3 abgefragten Notrufen.',
  },
  {
    id: 'telefon-lebensretter',
    title: 'Telefon-Lebensretter',
    description: 'Ein REA-Patient überlebte dank Telefonreanimation.',
  },
  {
    id: 'eiserne-hilfsfrist',
    title: 'Eiserne Hilfsfrist',
    description: 'Hilfsfristquote ≥ 95 % in einer Schicht mit mindestens 4 Notfällen.',
  },
  { id: 'nachtschwaermer', title: 'Nachtschwärmer', description: 'Eine Nachtschicht (Beginn 19:00) abgeschlossen.' },
  {
    id: 'note-eins',
    title: 'Leitstellen-Niveau',
    description: 'Eine Schicht mit Note 1 abgeschlossen.',
  },
]

const KEY = 'achievements'

interface AchievementState {
  unlocked: Record<string, string> // id → ISO date
  toast: AchievementDef | null
  loaded: boolean
  load: () => Promise<void>
  unlock: (id: string) => void
  clearToast: () => void
  evaluateReport: (report: ShiftReport, startHour: number) => void
}

export const useAchievementStore = create<AchievementState>((set, get) => ({
  unlocked: {},
  toast: null,
  loaded: false,

  load: async () => {
    if (get().loaded) return
    const unlocked = (await dbGet<Record<string, string>>('settings', KEY)) ?? {}
    set({ unlocked, loaded: true })
  },

  unlock: (id) => {
    const s = get()
    if (s.unlocked[id]) return
    const def = ACHIEVEMENTS.find((a) => a.id === id)
    if (!def) return
    const unlocked = { ...s.unlocked, [id]: new Date().toISOString() }
    void dbSet('settings', KEY, unlocked)
    set({ unlocked, toast: def })
  },

  clearToast: () => set({ toast: null }),

  evaluateReport: (report, startHour) => {
    const { unlock } = get()
    unlock('erste-schicht')
    if (report.stichwortQuote === 1 && report.auftraege.filter((a) => a.stichwortKorrekt !== undefined).length >= 3)
      unlock('goldener-hoerer')
    if (
      report.auftraege.some(
        (a) => a.survived && a.chosenCategoryId === 'STILL' && a.outcomeText?.includes('Telefonreanimation'),
      )
    )
      unlock('telefon-lebensretter')
    if (
      report.hilfsfristQuote !== null &&
      report.hilfsfristQuote >= 0.95 &&
      report.auftraege.filter((a) => a.hilfsfristApplied).length >= 4
    )
      unlock('eiserne-hilfsfrist')
    if (startHour === 19) unlock('nachtschwaermer')
    if (report.note === 1) unlock('note-eins')
  },
}))
