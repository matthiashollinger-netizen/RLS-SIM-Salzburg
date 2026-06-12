import { create } from 'zustand'
import { dbGet, dbSet } from '../persistence/db.ts'
import type { ShiftReport } from '../engine/scoring.ts'
import { useGameStore } from './gameStore.ts'
import { useDispatchStore } from './dispatchStore.ts'
import { useHospitalLoad, hospitalFreeSlots } from './hospitalLoadStore.ts'

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
  // ---- mid-shift unlockables (AAA pass) ----
  {
    id: 'erste-sonderlage',
    title: 'Erste Sonderlage gemeistert',
    description: 'Eine Sonderlage während laufender Schicht überstanden.',
  },
  {
    id: 'manv-koordiniert',
    title: 'MANV koordiniert',
    description: 'Einen MANV-Einsatz vollständig abgearbeitet.',
  },
  {
    id: 'blitzdispo',
    title: 'Blitzdispo',
    description: 'Einen Auftrag keine 60 Sekunden nach Anlage alarmiert.',
  },
  {
    id: 'nachtwache',
    title: 'Nachtwache',
    description: 'Um 03:00 Uhr früh noch im Dienst gewesen.',
  },
  {
    id: 'volle-huette',
    title: 'Volle Hütte',
    description: 'Eine Notaufnahme bis auf den letzten Platz belegt.',
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

// ---------------------------------------------------------------------------
// Mid-shift achievement triggers (AAA pass) — wired here at module level so
// no other store needs editing. The toast flow stays the existing unlock().
// ---------------------------------------------------------------------------

/** Load-safe unlock: never write before the persisted set has been read. */
function safeUnlock(id: string) {
  const st = useAchievementStore.getState()
  if (st.loaded) {
    st.unlock(id)
    return
  }
  void st.load().then(() => useAchievementStore.getState().unlock(id))
}

// 'blitzdispo' + 'manv-koordiniert': watch Auftrag state transitions
const auftragStates = new Map<string, string>()
useDispatchStore.subscribe((s) => {
  if (Object.keys(s.auftraege).length === 0) {
    auftragStates.clear()
    return
  }
  for (const a of Object.values(s.auftraege)) {
    const prev = auftragStates.get(a.id)
    if (prev === a.state) continue
    auftragStates.set(a.id, a.state)
    if (a.uebung) continue
    // alarmed less than 60 s after creation (offen → disponiert via alarmieren)
    if (prev === 'offen' && a.state === 'disponiert') {
      if (useGameStore.getState().simSec - a.createdAt < 60) safeUnlock('blitzdispo')
    }
    // a MANV-coded Auftrag fully worked off (GAME_DATA §3 MANV classes)
    if (a.state === 'abgeschlossen' && a.code.startsWith('MANV')) safeUnlock('manv-koordiniert')
  }
})

// 'nachtwache': the sim clock ticks across 03:00 during a running shift
useGameStore.subscribe((s, prev) => {
  if (s.simSec === prev.simSec || !s.running || s.shiftOver) return
  const THREE_AM = 3 * 3600
  const day = ((s.simSec % 86400) + 86400) % 86400
  const prevDay = ((prev.simSec % 86400) + 86400) % 86400
  // continuous-tick crossing only (≤ 30 s step) — ignores clock teleports
  if (prevDay < THREE_AM && day >= THREE_AM && day - prevDay <= 30) safeUnlock('nachtwache')
})

// 'volle-huette': a Notaufnahme hits 0 free slots (Kapazitätsnachweis)
useHospitalLoad.subscribe((s) => {
  const simSec = useGameStore.getState().simSec
  for (const [hospitalId, slots] of Object.entries(s.occupied)) {
    if (slots.length > 0 && hospitalFreeSlots(hospitalId, simSec) === 0) {
      safeUnlock('volle-huette')
      return
    }
  }
})

// 'erste-sonderlage': a Sonderlage ends while the shift is still active.
// The store lands in a concurrent workstream — import defensively.
void import('./sonderlageStore.ts')
  .then((mod) => {
    const store = (
      mod as unknown as {
        useSonderlageStore?: {
          getState: () => unknown
          subscribe: (fn: () => void) => () => void
        }
      }
    ).useSonderlageStore
    if (!store?.getState || !store.subscribe) return
    type SonderlageShape = { active?: unknown; recent?: unknown[] } | null
    const snap = () => {
      const s = store.getState() as SonderlageShape
      return { active: !!s?.active, recentLen: s?.recent?.length ?? 0 }
    }
    let prev = snap()
    store.subscribe(() => {
      const now = snap()
      // only a NATURAL end counts: end() pushes the id into `recent`,
      // while a world reset() clears `active` AND empties `recent`
      if (prev.active && !now.active && now.recentLen > prev.recentLen) {
        const g = useGameStore.getState()
        if (g.running && !g.shiftOver) safeUnlock('erste-sonderlage')
      }
      prev = now
    })
  })
  .catch(() => {
    /* Sonderlage feature not present */
  })
