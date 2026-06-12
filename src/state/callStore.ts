import { create } from 'zustand'
import { places } from '../data/index.ts'
import {
  buildMerkmalskette,
  categoryFromAnswers,
  frageById,
  hauptbeschwerdeById,
  type AbfrageAnswers,
} from '../engine/abfrage.ts'
import {
  acceptsOrtungsSms,
  answerFor,
  greeting,
  initialCallerState,
  unknownReply,
  type CallerState,
} from '../engine/callerScript.ts'
import type { Scenario } from '../engine/scenario.ts'
import { haversineKm } from '../engine/geo.ts'
import { buildSystemPrompt } from '../llm/prompt.ts'
import { classifyWithDetails } from '../llm/classify.ts'
import { speakCaller } from '../llm/tts.ts'
import type { ChatMessage } from '../llm/types.ts'
import { useGameStore } from './gameStore.ts'
import { useDispatchStore } from './dispatchStore.ts'
import { useEventLog } from './eventLog.ts'
import { useLlmStore } from './llmStore.ts'

/** Calltaker state: ringing queue, active call, transcript, Abfrage answers, Ortung. */

export interface TranscriptEntry {
  from: 'anrufer' | 'calltaker' | 'system'
  text: string
  simSec: number
}

export interface AmlPoint {
  lat: number
  lon: number
  radiusM: number
  quelle: 'AML' | 'SMS' | 'Netzbetreiber'
}

export interface ActiveCall {
  id: string
  scenario: Scenario
  ringingSince: number
  answeredAt?: number
  transcript: TranscriptEntry[]
  callerState: CallerState
  answers: AbfrageAnswers
  amlPoint?: AmlPoint
  smsRequestedAt?: number
  smsResult?: 'pending' | 'ok' | 'ignored'
  netzAbfrageAt?: number
  ended: boolean
  auftragId?: string
}

interface CallStoreState {
  queue: ActiveCall[]
  active: ActiveCall | null
  /** caller is "typing" (LLM generation running) */
  generating: boolean
  /** answered+ended call counters for the shift report (M8) */
  stats: { angenommen: number; aufgelegt: number; auftraege: number; zugeordnet: number }
  reset: () => void
  incoming: (scenario: Scenario) => void
  answer: (id: string) => void
  hangup: () => void
  ask: (frageId: string) => void
  askFreeText: (text: string) => void
  setAnswer: (patch: Partial<AbfrageAnswers>) => void
  chooseHauptbeschwerde: (id: string) => void
  setAdresse: (adresse: NonNullable<AbfrageAnswers['adresse']>) => void
  requestOrtungsSms: () => void
  requestNetzbetreiber: () => void
  createAuftrag: () => string | null
  assignToExisting: (auftragId: string) => void
  /** internal: timers driven by the game loop */
  tick: (simSec: number) => void
}

let callCounter = 1

function say(call: ActiveCall, from: TranscriptEntry['from'], text: string, simSec: number) {
  call.transcript = [...call.transcript, { from, text, simSec }]
  if (from === 'anrufer') speakCaller(text)
}

/** Question text for the structured catalog incl. action buttons. */
function questionText(frageId: string): string {
  if (frageId === 'beruhigen') return 'Ich bin bei Ihnen, atmen Sie ruhig durch. Wir schicken Hilfe.'
  if (frageId === 'eh_anweisung') return 'Ich sage Ihnen jetzt, was Sie bis zum Eintreffen tun können.'
  return frageById.get(frageId)?.text ?? frageId
}

/** Capture structured interview facts revealed by a question (truth-driven). */
function captureAnswers(call: ActiveCall, frageId: string): Partial<AbfrageAnswers> {
  const t = call.scenario.truth
  switch (frageId) {
    case 'personen':
      if (call.scenario.anrufer.emotion !== 'panisch' || call.callerState.calmed)
        return { personen: t.personen }
      return {}
    case 'bewusstsein':
      return { ansprechbar: t.ansprechbar }
    case 'atmung':
      return { atmet: t.atmet }
    case 'alter':
      return { alter: t.alter }
    case 'zugang':
      return {
        zugang: t.zugang === 'frei' ? 'frei' : t.zugang === 'versperrt' ? 'versperrt' : 'schwer',
      }
    case 'rueckruf':
      return { rueckrufOk: true }
    default:
      return {}
  }
}

/** Transcript → OpenAI-style messages (caller = assistant, calltaker = user). */
function toChatMessages(call: ActiveCall): ChatMessage[] {
  const msgs: ChatMessage[] = [{ role: 'system', content: buildSystemPrompt(call.scenario) }]
  for (const t of call.transcript) {
    if (t.from === 'anrufer') msgs.push({ role: 'assistant', content: t.text })
    else if (t.from === 'calltaker') msgs.push({ role: 'user', content: t.text })
  }
  return msgs
}

function maybeEarlyHangup(call: ActiveCall, simSec: number) {
  if (
    call.scenario.stoerungen.includes('legt_frueh_auf') &&
    call.callerState.asked.length >= 3 &&
    !call.ended
  ) {
    say(call, 'system', 'Anrufer hat aufgelegt!', simSec)
    call.ended = true
  }
}

type SetFn = (
  partial:
    | Partial<CallStoreState>
    | ((s: CallStoreState) => Partial<CallStoreState>),
) => void
type GetFn = () => CallStoreState

/** Shared question pipeline: scripted Tier 1 or LLM Tier 2/3 (M6). */
function sendQuestion(set: SetFn, get: GetFn, text: string, frageId: string | null) {
  const simSec = useGameStore.getState().simSec
  const call = get().active
  if (!call || call.ended || get().generating) return
  const updated = { ...call }
  say(updated, 'calltaker', text, simSec)
  if (frageId) updated.answers = { ...updated.answers, ...captureAnswers(updated, frageId) }

  const llm = useLlmStore.getState()
  const engine = llm.status === 'ready' ? llm.engine : null
  if (!engine) {
    // Tier 1: scripted dialogue tree (answerFor tracks asked/calmed itself)
    const antwort = frageId
      ? answerFor(updated.scenario, frageId, updated.callerState)
      : unknownReply(updated.scenario, updated.callerState)
    say(updated, 'anrufer', antwort, simSec)
    maybeEarlyHangup(updated, simSec)
    set({ active: updated })
    return
  }

  // Tier 2/3: the LLM verbalizes the scenario; structured capture stays truth-driven
  updated.callerState.asked.push(frageId ?? 'frei')
  if (frageId === 'beruhigen') updated.callerState.calmed = true
  set({ active: updated, generating: true })
  void engine
    .generate(toChatMessages(updated))
    .catch(() => 'Hallo?? Sind Sie noch dran? Bitte schicken Sie wen!')
    .then((antwort) => {
      const after = useGameStore.getState().simSec
      const cur = get().active
      if (!cur || cur.id !== call.id) {
        set({ generating: false })
        return
      }
      const next = { ...cur }
      say(next, 'anrufer', antwort, after)
      maybeEarlyHangup(next, after)
      set({ active: next, generating: false })
    })
}

/** Nearest place for locating a point without an address (AML-only). */
function nearestPlace(lat: number, lon: number) {
  let best = places[0]!
  let bestD = Infinity
  for (const p of places) {
    const d = haversineKm({ lat, lon }, p)
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  return best
}

export const useCallStore = create<CallStoreState>((set, get) => ({
  queue: [],
  active: null,
  generating: false,
  stats: { angenommen: 0, aufgelegt: 0, auftraege: 0, zugeordnet: 0 },

  reset: () =>
    set({
      queue: [],
      active: null,
      generating: false,
      stats: { angenommen: 0, aufgelegt: 0, auftraege: 0, zugeordnet: 0 },
    }),

  incoming: (scenario) => {
    const simSec = useGameStore.getState().simSec
    const call: ActiveCall = {
      id: `C-${String(callCounter++).padStart(4, '0')}`,
      scenario,
      ringingSince: simSec,
      transcript: [],
      callerState: initialCallerState(),
      answers: {},
      ended: false,
    }
    set((s) => ({ queue: [...s.queue, call] }))
    useEventLog.getState().append({
      simSec,
      kind: 'system',
      text: `Eingehender Anruf (${scenario.phone === 'handy' ? 'Mobil' : 'Festnetz'})`,
    })
  },

  answer: (id) => {
    const simSec = useGameStore.getState().simSec
    set((s) => {
      const call = s.queue.find((c) => c.id === id)
      if (!call || s.active) return s
      call.answeredAt = simSec
      say(call, 'calltaker', 'Rettungsleitstelle Salzburg, wo genau ist der Notfallort?', simSec)
      say(call, 'anrufer', greeting(call.scenario), simSec)
      // Festnetz: registered address prefilled (GAME_DATA §3b Festnetz-Datenübermittlung)
      if (call.scenario.anschlussAdresse) {
        const a = call.scenario.anschlussAdresse
        call.answers = {
          ...call.answers,
          adresse: {
            stadtteil: a.stadtteil,
            strasse: a.strasse,
            lat: a.lat,
            lon: a.lon,
            quelle: 'Festnetz-Anschlussdaten',
          },
        }
        say(call, 'system', `Festnetz: Anschlussadresse ${a.strasse}, ${a.stadtteil}`, simSec)
      }
      return {
        queue: s.queue.filter((c) => c.id !== id),
        active: { ...call },
        stats: { ...s.stats, angenommen: s.stats.angenommen + 1 },
      }
    })
  },

  hangup: () => {
    const simSec = useGameStore.getState().simSec
    set((s) => {
      if (!s.active) return s
      useEventLog.getState().append({
        simSec,
        kind: 'system',
        text: `Anruf beendet (${s.active.id})`,
      })
      return {
        active: null,
        stats: { ...s.stats, aufgelegt: s.stats.aufgelegt + 1 },
      }
    })
  },

  ask: (frageId) => {
    sendQuestion(set, get, questionText(frageId), frageId)
  },

  askFreeText: (text) => {
    // typed follow-ups also match the chosen Hauptbeschwerde's detail questions
    const hb = get().active?.answers.hauptbeschwerdeId
    const detailFragen = hb ? hauptbeschwerdeById.get(hb)?.detailFragen : undefined
    sendQuestion(set, get, text, classifyWithDetails(text, detailFragen))
  },

  setAnswer: (patch) =>
    set((s) => (s.active ? { active: { ...s.active, answers: { ...s.active.answers, ...patch } } } : s)),

  chooseHauptbeschwerde: (id) =>
    set((s) => {
      if (!s.active) return s
      const hb = hauptbeschwerdeById.get(id)
      if (!hb) return s
      return {
        active: {
          ...s.active,
          answers: { ...s.active.answers, hauptbeschwerdeId: id },
        },
      }
    }),

  setAdresse: (adresse) =>
    set((s) => (s.active ? { active: { ...s.active, answers: { ...s.active.answers, adresse } } } : s)),

  requestOrtungsSms: () => {
    const simSec = useGameStore.getState().simSec
    set((s) => {
      const call = s.active
      if (!call || call.smsResult === 'pending') return s
      const updated = { ...call, smsRequestedAt: simSec, smsResult: 'pending' as const }
      say(updated, 'calltaker', 'Ich schicke Ihnen eine SMS mit einem Link — bitte antippen!', simSec)
      say(updated, 'anrufer', answerFor(updated.scenario, 'sms_hinweis', updated.callerState), simSec)
      return { active: updated }
    })
  },

  requestNetzbetreiber: () => {
    const simSec = useGameStore.getState().simSec
    set((s) => {
      const call = s.active
      if (!call || call.netzAbfrageAt) return s
      const updated = { ...call, netzAbfrageAt: simSec }
      say(updated, 'system', 'Standortabfrage beim Netzbetreiber angefordert (dauert mehrere Minuten)…', simSec)
      return { active: updated }
    })
  },

  createAuftrag: () => {
    const s = get()
    const call = s.active
    if (!call) return null
    const a = call.answers
    const ort = a.adresse
      ? {
          lat: a.adresse.lat,
          lon: a.adresse.lon,
          stadtteil: a.adresse.stadtteil,
          strasse: a.adresse.strasse,
        }
      : call.amlPoint
        ? {
            lat: call.amlPoint.lat,
            lon: call.amlPoint.lon,
            stadtteil: nearestPlace(call.amlPoint.lat, call.amlPoint.lon).name,
            strasse: `Ortungspunkt ±${call.amlPoint.radiusM} m`,
          }
        : null
    if (!ort) return null

    // explicit KT category chosen by the calltaker wins (Anruf-Triage),
    // otherwise the emergency interview result applies
    const isKt = !!a.categoryId
    let categoryId: string
    let severity: 'hoch' | 'normal'
    if (isKt) {
      categoryId = a.categoryId!
      severity = 'normal'
    } else {
      const derived = categoryFromAnswers(a)
      categoryId = derived.categoryId
      severity = derived.severity
    }
    const merkmalskette = buildMerkmalskette(a, isKt)
    const isNotfall = call.scenario.callType === 'notfall'
    const tcpr =
      call.scenario.truth.atmet === false && call.callerState.asked.includes('eh_anweisung')
    const auftragId = useDispatchStore.getState().createAuftrag({
      categoryId,
      severity,
      personen: a.personen ?? 1,
      ort,
      merkmalskette,
      truthCategoryId: isNotfall ? call.scenario.truth.categoryId : undefined,
      truthSeverity: isNotfall ? call.scenario.truth.severity : undefined,
      tcpr,
      uebung: call.scenario.uebung ?? false,
    })
    set((st) => ({
      active: st.active ? { ...st.active, auftragId } : null,
      stats: { ...st.stats, auftraege: st.stats.auftraege + 1 },
    }))
    return auftragId
  },

  assignToExisting: (auftragId) => {
    const simSec = useGameStore.getState().simSec
    const call = get().active
    if (!call) return
    useEventLog.getState().append({
      simSec,
      kind: 'einsatz',
      auftragId,
      text: `${auftragId}: Duplizitätsanruf zugeordnet (${call.id})`,
    })
    set((s) => ({
      active: s.active ? { ...s.active, auftragId, ended: true } : null,
      stats: { ...s.stats, zugeordnet: s.stats.zugeordnet + 1 },
    }))
  },

  tick: (simSec) => {
    const s = get()
    const call = s.active
    if (!call) return
    let updated: ActiveCall | null = null
    const ensure = () => (updated ??= { ...call })

    // AML point after 10–30 s (GAME_DATA §3b)
    if (
      call.scenario.amlAfterSec !== undefined &&
      !call.amlPoint &&
      call.answeredAt !== undefined &&
      simSec >= call.answeredAt + call.scenario.amlAfterSec
    ) {
      const radius = call.scenario.amlRadiusM ?? 200
      const t = call.scenario.truth.ort
      const u = ensure()
      u.amlPoint = {
        lat: t.lat + (Math.random() - 0.5) * (radius / 111000),
        lon: t.lon + (Math.random() - 0.5) * (radius / 78000),
        radiusM: radius,
        quelle: 'AML',
      }
      say(u, 'system', `AML-Ortung eingetroffen (±${radius} m)`, simSec)
    }

    // Ortungs-SMS result after 20–60 s
    if (call.smsResult === 'pending' && call.smsRequestedAt !== undefined && simSec >= call.smsRequestedAt + 30) {
      const u = ensure()
      if (acceptsOrtungsSms(call.scenario, call.callerState, Math.random())) {
        const t = call.scenario.truth.ort
        u.amlPoint = { lat: t.lat, lon: t.lon, radiusM: 25, quelle: 'SMS' }
        u.smsResult = 'ok'
        say(u, 'system', 'SMS-Ortung erfolgreich (±25 m)', simSec)
      } else {
        u.smsResult = 'ignored'
        say(u, 'system', 'Anrufer hat den SMS-Link nicht angetippt.', simSec)
      }
    }

    // Netzbetreiber-Abfrage after 3 min, coarse radius
    if (call.netzAbfrageAt !== undefined && !call.amlPoint && simSec >= call.netzAbfrageAt + 180) {
      const t = call.scenario.truth.ort
      const u = ensure()
      u.amlPoint = {
        lat: t.lat + (Math.random() - 0.5) * 0.02,
        lon: t.lon + (Math.random() - 0.5) * 0.02,
        radiusM: 1500,
        quelle: 'Netzbetreiber',
      }
      say(u, 'system', 'Netzbetreiber: Funkzellen-Schwerpunkt (±1500 m)', simSec)
    }

    if (updated) set({ active: updated })
  },
}))
