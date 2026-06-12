import { create } from 'zustand'
import { categoryById, statusByCode } from '../data/index.ts'
import {
  LEITSTELLE,
  POLIZEI_NACHFORDERUNG_TEXT,
  QUICK_PHRASES,
  eintreffMeldung,
  leitstelleCallsVehicle,
  naNachforderungText,
  naReleasable,
  needsNaNachforderung,
  needsPolizeiNachforderung,
  quickReply,
  sprechwunschText,
  type FunkSpruch,
  type QuickPhraseId,
} from '../engine/funk.ts'
import type { VehicleEvent } from '../engine/vehicleSim.ts'
import { unitDisplayName } from '../lib/format.ts'
import { alarmGong, funkQuittung, pttClick, squelchTail } from '../audio/sounds.ts'
import { vehicleSim } from './simulation.ts'
import { useDispatchStore } from './dispatchStore.ts'
import { useGameStore } from './gameStore.ts'
import { useEventLog } from './eventLog.ts'
import { useLlmStore } from './llmStore.ts'

/**
 * Bidirectional radio (M7, reworked #4/#5): incoming crew calls are
 * INTERACTIVE — the player must answer „kommen" and close with „Verstanden".
 * Only the first unit on scene reports; Nachforderungen and Sprechwünsche
 * call in; everything else is silent status traffic (MDT).
 */

let nextSpruchId = 1
const MAX_SPRUECHE = 150

interface FunkState {
  sprueche: FunkSpruch[]
  /** vehicle selected for active calling (from Ressourcen/map) */
  targetVehicleId: string | null
  reset: () => void
  setTarget: (id: string | null) => void
  append: (s: Omit<FunkSpruch, 'id'>) => void
  /** player answers an incoming call — the unit then speaks its message */
  kommen: (id: number) => void
  /** player closes the dialog */
  verstanden: (id: number) => void
  /** dispatcher action from a Nachforderung (A4 / Polizei) */
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

/** which auftraege already produced their Erstmeldung */
const erstmeldungDone = new Set<string>()

/** radio frame: PTT click → quittung blips → squelch tail */
function quittungFramed() {
  pttClick()
  funkQuittung()
  squelchTail(0.2)
}

export const useFunkStore = create<FunkState>((set, get) => ({
  sprueche: [],
  targetVehicleId: null,

  reset: () => {
    erstmeldungDone.clear()
    set({ sprueche: [], targetVehicleId: null })
  },

  setTarget: (targetVehicleId) => set({ targetVehicleId }),

  append: (s) => {
    const spruch: FunkSpruch = { ...s, id: nextSpruchId++ }
    set((st) => {
      const sprueche = [...st.sprueche, spruch]
      return { sprueche: sprueche.length > MAX_SPRUECHE ? sprueche.slice(-MAX_SPRUECHE) : sprueche }
    })
    quittungFramed()
    if (spruch.stage === 'quittiert') {
      const main = spruch.lines.find((l) => l.speaker !== LEITSTELLE && l.text !== 'kommen')
      if (main) logFunk(`${main.speaker}: „${main.text}"`, spruch.vehicleId, spruch.auftragId)
    }
  },

  kommen: (id) => {
    const spruch = get().sprueche.find((s) => s.id === id)
    if (!spruch || spruch.stage !== 'ruf' || !spruch.vehicleId) return
    const rt = vehicleSim.get(spruch.vehicleId)
    const name = rt ? unitDisplayName(rt.unit) : spruch.vehicleId
    const message =
      spruch.pendingMessage ?? (rt ? sprechwunschText(rt) : '… Meldung nicht mehr aktuell.')
    quittungFramed()
    logFunk(`${name}: „${message}"`, spruch.vehicleId, spruch.auftragId)
    set((st) => ({
      sprueche: st.sprueche.map((s) =>
        s.id === id
          ? {
              ...s,
              stage: 'offen' as const,
              pendingMessage: undefined,
              lines: [
                ...s.lines,
                { speaker: LEITSTELLE, text: 'kommen' },
                { speaker: name, text: message },
              ],
            }
          : s,
      ),
    }))
  },

  verstanden: (id) => {
    const spruch = get().sprueche.find((s) => s.id === id)
    if (!spruch || spruch.stage !== 'offen') return
    quittungFramed()
    set((st) => ({
      sprueche: st.sprueche.map((s) =>
        s.id === id
          ? {
              ...s,
              stage: 'quittiert' as const,
              lines: [...s.lines, { speaker: LEITSTELLE, text: 'Verstanden' }],
            }
          : s,
      ),
    }))
  },

  executeAction: (spruchId) => {
    const spruch = get().sprueche.find((s) => s.id === spruchId)
    if (!spruch?.action || spruch.actionDone || spruch.stage === 'ruf') return
    const dispatch = useDispatchStore.getState()
    const auftrag = dispatch.auftraege[spruch.action.auftragId]
    if (!auftrag) return
    if (spruch.action.type === 'a4') {
      // NA-Nachforderung WERTET den bestehenden Auftrag auf (Rework 2):
      // Code → A4 (NA-Nachforderung durch Einsatzmittel vor Ort, GAME_DATA §4)
      dispatch.overrideCode(auftrag.id, 'A4')
      dispatch.updateAuftrag(auftrag.id, { severity: 'hoch' })
      dispatch.addInfo(auftrag.id, 'NA nachgefordert durch Mannschaft — Auftrag auf A4 aufgewertet')
      dispatch.select(auftrag.id)
    } else if (spruch.action.type === 'polizei') {
      if (!auftrag.partnersAlarmed.includes('POL')) dispatch.togglePartner(auftrag.id, 'POL')
    } else if (spruch.action.type === 'lagefreigabe') {
      dispatch.freigabeLage(auftrag.id)
      dispatch.select(auftrag.id)
    } else if (spruch.action.type === 'na-abziehen' && spruch.action.vehicleId) {
      const vid = spruch.action.vehicleId
      const rt = vehicleSim.get(vid)
      dispatch.cancelVehicle(auftrag.id, vid)
      dispatch.addInfo(
        auftrag.id,
        `${rt ? unitDisplayName(rt.unit) : vid} (NA) abgezogen — RTW übernimmt die Versorgung`,
      )
    }
    set((st) => ({
      sprueche: st.sprueche.map((s) => (s.id === spruchId ? { ...s, actionDone: true } : s)),
    }))
    if (spruch.stage === 'offen') get().verstanden(spruchId)
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
    // releasable NA → offer the "abziehen" action right on the dialog (Rework 2)
    const releasable =
      phraseId === 'na-abkoemmlich' && current.assignment && naReleasable(current, simSec)
    get().append({
      simSec,
      kind: 'anfrage',
      vehicleId,
      auftragId: rt.assignment?.id,
      stage: 'quittiert',
      lines: leitstelleCallsVehicle(name, phrase.question, reply),
      action:
        releasable && current.assignment
          ? { type: 'na-abziehen', auftragId: current.assignment.id, vehicleId }
          : undefined,
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
        stage: 'quittiert',
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

    // pager gong on alarm — variant derived from the mission (SoSi/MANV)
    if (e.to === '1') {
      alarmGong(auftrag?.code.startsWith('MANV') ? 'manv' : auftrag?.sosi ? 'sosi' : 'routine')
    }

    if (!auftrag) return

    /** incoming interactive call: only the call line — message follows on „kommen" */
    const incomingCall = (
      kind: FunkSpruch['kind'],
      message: string,
      action?: FunkSpruch['action'],
    ) =>
      get().append({
        simSec: e.simSec,
        kind,
        vehicleId: e.vehicleId,
        auftragId: auftrag.id,
        stage: 'ruf',
        pendingMessage: message,
        lines: [{ speaker: name, text: `${LEITSTELLE} von ${name}` }],
        action,
      })

    const isEmergency = !auftrag.code.startsWith('D') && !auftrag.code.startsWith('E')

    if (e.to === '3') {
      // Erstmeldung: only the FIRST unit on scene, only for emergencies (Rework 2)
      if (isEmergency && !erstmeldungDone.has(auftrag.id)) {
        erstmeldungDone.add(auftrag.id)
        incomingCall('eintreffen', eintreffMeldung(rt))
      }
      // NA-Nachforderung (GAME_DATA §10c) — transport unit arrives, no NA assigned
      const assignedTypes = Object.keys(auftrag.assigned)
        .map((id) => vehicleSim.get(id)?.unit.typ ?? '')
        .filter(Boolean)
      if (
        (rt.unit.typ === 'RTW' || rt.unit.typ === 'KTW') &&
        needsNaNachforderung(auftrag, assignedTypes)
      ) {
        incomingCall('nachforderung-na', naNachforderungText(auftrag), {
          type: 'a4',
          auftragId: auftrag.id,
        })
      }
      // Polizei nach (category suggests POL, not alarmed)
      const cat = categoryById.get(auftrag.categoryId)
      if (cat && needsPolizeiNachforderung(auftrag, cat.partner.includes('POL'))) {
        incomingCall('nachforderung-polizei', POLIZEI_NACHFORDERUNG_TEXT, {
          type: 'polizei',
          auftragId: auftrag.id,
        })
      }
    } else if (e.to === '5') {
      // Sprechwunsch: seltener (~jede 5. Einheit) und nur bei Notfällen (Rework 2)
      if (isEmergency && rt.id.charCodeAt(rt.id.length - 1) % 5 === 0) {
        incomingCall('sprechwunsch', sprechwunschText(rt))
      }
    }
  },
}))

// wire vehicle events
vehicleSim.addEventListener((e) => useFunkStore.getState().handleVehicleEvent(e))
