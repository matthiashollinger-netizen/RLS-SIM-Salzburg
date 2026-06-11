import { create } from 'zustand'
import { categoryById, statusByCode } from '../data/index.ts'
import {
  LEITSTELLE,
  POLIZEI_NACHFORDERUNG_TEXT,
  QUICK_PHRASES,
  eintreffMeldung,
  leitstelleCallsVehicle,
  naNachforderungText,
  needsNaNachforderung,
  needsPolizeiNachforderung,
  quickReply,
  sprechwunschText,
  transportMeldung,
  vehicleCallsLeitstelle,
  type FunkSpruch,
  type QuickPhraseId,
} from '../engine/funk.ts'
import type { VehicleEvent } from '../engine/vehicleSim.ts'
import { unitDisplayName } from '../lib/format.ts'
import { funkQuittung, pagerGong } from '../audio/sounds.ts'
import { vehicleSim } from './simulation.ts'
import { useDispatchStore } from './dispatchStore.ts'
import { useGameStore } from './gameStore.ts'
import { useEventLog } from './eventLog.ts'
import { useLlmStore } from './llmStore.ts'

/** Bidirectional radio (M7): status-driven crew reports + active calling. */

let nextSpruchId = 1
const MAX_SPRUECHE = 150

interface FunkState {
  sprueche: FunkSpruch[]
  /** vehicle selected for active calling (from Ressourcen/map) */
  targetVehicleId: string | null
  setTarget: (id: string | null) => void
  append: (s: Omit<FunkSpruch, 'id'>) => void
  quittieren: (id: number) => void
  /** dispatcher action from a Nachforderung */
  executeAction: (spruchId: number) => void
  callVehicle: (vehicleId: string, phraseId: QuickPhraseId) => void
  callVehicleFreeText: (vehicleId: string, text: string) => void
  handleVehicleEvent: (e: VehicleEvent) => void
}

function logFunk(text: string, vehicleId?: string, auftragId?: string) {
  useEventLog.getState().append({
    simSec: useGameStore.getState().simSec,
    kind: 'funk',
    text,
    vehicleId,
    auftragId,
  })
}

export const useFunkStore = create<FunkState>((set, get) => ({
  sprueche: [],
  targetVehicleId: null,

  setTarget: (targetVehicleId) => set({ targetVehicleId }),

  append: (s) => {
    const spruch: FunkSpruch = { ...s, id: nextSpruchId++ }
    set((st) => {
      const sprueche = [...st.sprueche, spruch]
      return { sprueche: sprueche.length > MAX_SPRUECHE ? sprueche.slice(-MAX_SPRUECHE) : sprueche }
    })
    funkQuittung()
    const main = spruch.lines.find((l) => l.speaker !== LEITSTELLE && l.text !== 'kommen')
    if (main) logFunk(`${main.speaker}: „${main.text}"`, spruch.vehicleId, spruch.auftragId)
  },

  quittieren: (id) =>
    set((st) => ({
      sprueche: st.sprueche.map((s) => (s.id === id ? { ...s, acked: true } : s)),
    })),

  executeAction: (spruchId) => {
    const spruch = get().sprueche.find((s) => s.id === spruchId)
    if (!spruch?.action) return
    const dispatch = useDispatchStore.getState()
    const auftrag = dispatch.auftraege[spruch.action.auftragId]
    if (!auftrag) return
    if (spruch.action.type === 'a4') {
      // NA-Nachforderung durch Einsatzmittel vor Ort → A4 (GAME_DATA §4)
      dispatch.createAuftrag({
        categoryId: auftrag.categoryId,
        severity: 'hoch',
        personen: auftrag.personen,
        ort: auftrag.ort,
        merkmalskette: [`NA-Nachforderung zu ${auftrag.id}`, ...auftrag.merkmalskette],
        code: 'A4',
      })
    } else if (spruch.action.type === 'polizei') {
      if (!auftrag.partnersAlarmed.includes('POL')) dispatch.togglePartner(auftrag.id, 'POL')
    }
    set((st) => ({
      sprueche: st.sprueche.map((s) => (s.id === spruchId ? { ...s, acked: true } : s)),
    }))
  },

  callVehicle: (vehicleId, phraseId) => {
    const rt = vehicleSim.get(vehicleId)
    if (!rt || rt.status === 'AUS') return
    const simSec = useGameStore.getState().simSec
    const name = unitDisplayName(rt.unit)
    const phrase = QUICK_PHRASES.find((p) => p.id === phraseId)!

    let cancelOk: boolean | undefined
    if (phraseId === 'abbruch' && rt.assignment) {
      const auftragId = rt.assignment.id
      if (useDispatchStore.getState().auftraege[auftragId]) {
        useDispatchStore.getState().cancelVehicle(auftragId, vehicleId)
      } else {
        vehicleSim.cancelAssignment(vehicleId, simSec)
      }
      cancelOk = vehicleSim.get(vehicleId)?.assignment === undefined
    }

    const current = vehicleSim.get(vehicleId)!
    const statusLabel = statusByCode.get(current.status)?.label ?? ''
    const reply = quickReply(phraseId, { rt: current, simSec, statusLabel, cancelOk })
    get().append({
      simSec,
      kind: 'anfrage',
      vehicleId,
      auftragId: rt.assignment?.id,
      lines: leitstelleCallsVehicle(name, phrase.question, reply),
    })
  },

  callVehicleFreeText: (vehicleId, text) => {
    const rt = vehicleSim.get(vehicleId)
    if (!rt || rt.status === 'AUS' || !text.trim()) return
    const name = unitDisplayName(rt.unit)
    const llm = useLlmStore.getState()
    const statusLabel = statusByCode.get(rt.status)?.label ?? ''

    const finish = (reply: string) => {
      get().append({
        simSec: useGameStore.getState().simSec,
        kind: 'anfrage',
        vehicleId,
        auftragId: rt.assignment?.id,
        lines: leitstelleCallsVehicle(name, text, reply),
      })
    }

    if (llm.status === 'ready' && llm.engine) {
      const system = [
        `Du bist die Besatzung des Rettungsmittels ${name} (${rt.unit.typ}) der Rettung Salzburg.`,
        `Aktueller Status: ${rt.status} (${statusLabel}).`,
        rt.assignment ? `Aktueller Auftrag: ${rt.assignment.label}.` : 'Derzeit kein Auftrag.',
        'Die Leitstelle funkt dich an. Antworte in EINEM kurzen Funkspruch (max. 2 Sätze),',
        'sachlich, Funkdisziplin, keine Floskeln, keine Rollenspiel-Anmerkungen.',
        'Erfinde keine Einsatzdetails, die nicht genannt wurden.',
      ].join('\n')
      void llm.engine
        .generate([
          { role: 'system', content: system },
          { role: 'user', content: text },
        ])
        .catch(() => `Status ${rt.status}${statusLabel ? ` — ${statusLabel}` : ''}.`)
        .then(finish)
    } else {
      finish(`Status ${rt.status}${statusLabel ? ` — ${statusLabel}` : ''}. Keine weiteren Angaben.`)
    }
  },

  handleVehicleEvent: (e) => {
    if (e.type !== 'status' || !e.to) return
    const rt = vehicleSim.get(e.vehicleId)
    if (!rt) return
    const name = unitDisplayName(rt.unit)
    const dispatch = useDispatchStore.getState()
    const auftrag = e.assignmentId ? dispatch.auftraege[e.assignmentId] : undefined

    // pager gong on alarm
    if (e.to === '1') pagerGong()

    if (!auftrag) return

    if (e.to === '3') {
      // arrival report
      get().append({
        simSec: e.simSec,
        kind: 'eintreffen',
        vehicleId: e.vehicleId,
        auftragId: auftrag.id,
        lines: vehicleCallsLeitstelle(name, eintreffMeldung(rt)),
      })
      // NA-Nachforderung (GAME_DATA §10c) — transport unit arrives, no NA assigned
      const assignedTypes = Object.keys(auftrag.assigned)
        .map((id) => vehicleSim.get(id)?.unit.typ ?? '')
        .filter(Boolean)
      if (
        (rt.unit.typ === 'RTW' || rt.unit.typ === 'KTW') &&
        needsNaNachforderung(auftrag, assignedTypes)
      ) {
        get().append({
          simSec: e.simSec,
          kind: 'nachforderung-na',
          vehicleId: e.vehicleId,
          auftragId: auftrag.id,
          lines: vehicleCallsLeitstelle(name, naNachforderungText(auftrag)),
          requiresAck: true,
          action: { type: 'a4', auftragId: auftrag.id },
        })
      }
      // Polizei nach (category suggests POL, not alarmed)
      const cat = categoryById.get(auftrag.categoryId)
      if (cat && needsPolizeiNachforderung(auftrag, cat.partner.includes('POL'))) {
        get().append({
          simSec: e.simSec,
          kind: 'nachforderung-polizei',
          vehicleId: e.vehicleId,
          auftragId: auftrag.id,
          lines: vehicleCallsLeitstelle(name, POLIZEI_NACHFORDERUNG_TEXT),
          requiresAck: true,
          action: { type: 'polizei', auftragId: auftrag.id },
        })
      }
    } else if (e.to === '4') {
      get().append({
        simSec: e.simSec,
        kind: 'transport',
        vehicleId: e.vehicleId,
        auftragId: auftrag.id,
        lines: vehicleCallsLeitstelle(name, transportMeldung(rt)),
      })
    } else if (e.to === '5') {
      // Sprechwunsch (~every third unit, deterministic per id)
      if (rt.id.charCodeAt(rt.id.length - 1) % 3 === 0) {
        get().append({
          simSec: e.simSec,
          kind: 'sprechwunsch',
          vehicleId: e.vehicleId,
          auftragId: auftrag.id,
          lines: [
            { speaker: name, text: `${LEITSTELLE} von ${name} — Sprechwunsch!` },
          ],
          requiresAck: true,
        })
      }
    }
  },
}))

// wire vehicle events
vehicleSim.addEventListener((e) => useFunkStore.getState().handleVehicleEvent(e))

/** Resolve an acknowledged Sprechwunsch into its message. */
export function resolveSprechwunsch(spruchId: number) {
  const st = useFunkStore.getState()
  const spruch = st.sprueche.find((s) => s.id === spruchId)
  if (!spruch || spruch.acked || spruch.kind !== 'sprechwunsch' || !spruch.vehicleId) return
  const rt = vehicleSim.get(spruch.vehicleId)
  if (!rt) return
  const name = unitDisplayName(rt.unit)
  st.quittieren(spruchId)
  st.append({
    simSec: useGameStore.getState().simSec,
    kind: 'antwort',
    vehicleId: spruch.vehicleId,
    auftragId: spruch.auftragId,
    lines: vehicleCallsLeitstelle(name, sprechwunschText(rt)),
  })
}
