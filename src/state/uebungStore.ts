import { create } from 'zustand'
import { placeById } from '../data/index.ts'
import type { EditorScenario } from '../engine/editorScenario.ts'
import { generateScenario, type Scenario } from '../engine/scenario.ts'
import { mulberry32 } from '../engine/rng.ts'
import { useGameStore } from './gameStore.ts'
import { useCallStore } from './callStore.ts'
import { useEventLog } from './eventLog.ts'

/** Runs editor scenarios as ÜBUNG: scripted calls at scheduled times. */

interface PendingEinsatz {
  atSimSec: number
  scenario: Scenario
}

interface UebungState {
  active: boolean
  name: string | null
  pending: PendingEinsatz[]
  start: (scenario: EditorScenario) => void
  stop: () => void
  tick: (simSec: number) => void
}

const uebungRng = mulberry32(777)

function buildCallScenario(e: EditorScenario['einsaetze'][number], region: 'NORD' | 'SUED'): Scenario {
  const s = generateScenario(uebungRng, {
    region,
    forceType: 'notfall',
    forceHauptbeschwerde: e.hauptbeschwerdeId,
  })
  const place = placeById.get(e.placeId)
  if (place) {
    s.truth.ort = {
      placeId: place.id,
      stadtteil: place.name,
      strasse: e.strasse,
      lat: place.lat + 0.002,
      lon: place.lon + 0.002,
    }
  }
  s.truth.personen = e.personen
  s.truth.severity = e.severity
  if (e.lageText) s.truth.lageText = e.lageText
  s.anrufer.emotion = e.emotion
  s.anrufer.rolle = e.rolle
  s.anrufer.kenntAdresse = true
  s.phone = e.phone
  if (e.phone === 'festnetz') s.anschlussAdresse = { ...s.truth.ort }
  s.stoerungen = []
  s.uebung = true
  return s
}

export const useUebungStore = create<UebungState>((set, get) => ({
  active: false,
  name: null,
  pending: [],

  start: (scenario) => {
    const startSec = useGameStore.getState().simSec
    const pending = scenario.einsaetze
      .map((e) => ({ atSimSec: startSec + e.atSec, scenario: buildCallScenario(e, scenario.region) }))
      .sort((a, b) => a.atSimSec - b.atSimSec)
    useGameStore.getState().setCallsEnabled(false) // only scripted calls
    set({ active: true, name: scenario.name, pending })
    useEventLog.getState().append({
      simSec: startSec,
      kind: 'system',
      text: `ÜBUNG „${scenario.name}" gestartet — ${pending.length} Einsätze geplant.`,
    })
  },

  stop: () => set({ active: false, name: null, pending: [] }),

  tick: (simSec) => {
    const s = get()
    if (!s.active || s.pending.length === 0) return
    const due = s.pending.filter((p) => p.atSimSec <= simSec)
    if (due.length === 0) return
    for (const p of due) {
      useCallStore.getState().incoming(p.scenario)
    }
    set({ pending: s.pending.filter((p) => p.atSimSec > simSec) })
  },
}))
