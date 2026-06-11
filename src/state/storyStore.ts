import { create } from 'zustand'
import { mulberry32 } from '../engine/rng.ts'
import { generateScenario } from '../engine/scenario.ts'
import { dbGet, dbSet } from '../persistence/db.ts'
import { useGameStore } from './gameStore.ts'
import { useCallStore } from './callStore.ts'
import { useEventLog } from './eventLog.ts'

/**
 * Two subtle multi-shift story arcs (M10, GAME_MECHANICS §3) — flag-based,
 * persisted across shifts in IndexedDB:
 *  - "brandserie" (NORD): a series of arson fires in Lehen over 3 shifts,
 *    resolved by the police after the third.
 *  - "wanderer" (SUED): a missing hiker; found hypothermic in the following
 *    south shift.
 */

const FLAGS_KEY = 'story-flags'

export interface StoryFlags {
  brandserieCount: number
  brandserieDone: boolean
  wandererMissing: boolean
  wandererDone: boolean
}

const DEFAULT_FLAGS: StoryFlags = {
  brandserieCount: 0,
  brandserieDone: false,
  wandererMissing: false,
  wandererDone: false,
}

interface StoryState {
  flags: StoryFlags
  loaded: boolean
  /** arc call already injected this shift */
  firedThisShift: boolean
  load: () => Promise<void>
  setFlags: (patch: Partial<StoryFlags>) => void
  resetShift: () => void
}

export const useStoryStore = create<StoryState>((set, get) => ({
  flags: DEFAULT_FLAGS,
  loaded: false,
  firedThisShift: false,
  load: async () => {
    if (get().loaded) return
    const flags = (await dbGet<StoryFlags>('settings', FLAGS_KEY)) ?? DEFAULT_FLAGS
    set({ flags: { ...DEFAULT_FLAGS, ...flags }, loaded: true })
  },
  setFlags: (patch) =>
    set((s) => {
      const flags = { ...s.flags, ...patch }
      void dbSet('settings', FLAGS_KEY, flags)
      return { flags }
    }),
  resetShift: () => set({ firedThisShift: false }),
}))

const storyRng = mulberry32(20260612)

/** Called from the game loop ~4×/s; injects at most one arc call per shift. */
export function storyTick(simSec: number) {
  const story = useStoryStore.getState()
  if (!story.loaded) {
    void story.load()
    return
  }
  if (story.firedThisShift) return
  const g = useGameStore.getState()
  if (g.shiftOver || !g.callsEnabled) return
  // fire window: 30–90 min into the shift, low per-tick probability
  const intoShift = simSec - g.shiftStartSec
  if (intoShift < 1800 || intoShift > 5400) return
  if (storyRng() > 0.002) return

  const { flags } = story
  if (g.region === 'NORD' && !flags.brandserieDone) {
    story.resetShift()
    useStoryStore.setState({ firedThisShift: true })
    const s = generateScenario(storyRng, {
      region: 'NORD',
      forceType: 'notfall',
      forceHauptbeschwerde: 'brand',
    })
    const nth = flags.brandserieCount + 1
    s.truth.ort = {
      placeId: 'lehen',
      stadtteil: 'Lehen',
      strasse: 'Strubergasse',
      lat: 47.8157,
      lon: 13.0262,
    }
    s.truth.lageText =
      nth >= 3
        ? 'Schon wieder brennt eine Mülltonne direkt am Haus in der Strubergasse! Da läuft wer weg, die Polizei jagt ihn gerade!'
        : 'In Lehen brennt eine Mülltonne direkt an der Hausfassade — das ist schon der wievielte Brand hier!'
    s.anrufer.kenntAdresse = true
    s.stoerungen = []
    s.storyArc = 'brandserie'
    useCallStore.getState().incoming(s)
    useStoryStore.getState().setFlags({ brandserieCount: nth, brandserieDone: nth >= 3 })
    if (nth >= 3) {
      useEventLog.getState().append({
        simSec,
        kind: 'system',
        text: 'Polizei Salzburg: Brandstifter in Lehen festgenommen — die Serie ist beendet.',
      })
    }
  } else if (g.region === 'SUED' && !flags.wandererDone) {
    useStoryStore.setState({ firedThisShift: true })
    const s = generateScenario(storyRng, {
      region: 'SUED',
      forceType: 'notfall',
      forceHauptbeschwerde: 'alpin',
    })
    if (!flags.wandererMissing) {
      s.truth.lageText =
        'Mein Bruder ist seit Stunden vom Wandern am Hundstein überfällig, das Handy ist aus. Es wird bald dunkel!'
      s.truth.ort = {
        placeId: 'zellamsee',
        stadtteil: 'Zell am See',
        strasse: 'Hundstein-Aufstieg',
        lat: 47.36,
        lon: 12.88,
      }
      useStoryStore.getState().setFlags({ wandererMissing: true })
    } else {
      s.truth.lageText =
        'Wir haben den vermissten Wanderer vom Hundstein gefunden! Er ist stark unterkühlt, aber er redet mit uns!'
      s.truth.ort = {
        placeId: 'zellamsee',
        stadtteil: 'Zell am See',
        strasse: 'Hundstein-Ostflanke',
        lat: 47.355,
        lon: 12.885,
      }
      useStoryStore.getState().setFlags({ wandererDone: true })
      useEventLog.getState().append({
        simSec,
        kind: 'system',
        text: 'Bergrettung: Der vermisste Wanderer vom Hundstein wurde lebend gefunden.',
      })
    }
    s.anrufer.kenntAdresse = true
    s.stoerungen = []
    s.storyArc = 'wanderer'
    useCallStore.getState().incoming(s)
  }
}
