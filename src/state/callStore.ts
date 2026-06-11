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
  type CallerState,
} from '../engine/callerScript.ts'
import type { Scenario } from '../engine/scenario.ts'
import { haversineKm } from '../engine/geo.ts'
import { useGameStore } from './gameStore.ts'
import { useDispatchStore } from './dispatchStore.ts'
import { useEventLog } from './eventLog.ts'

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
  /** answered+ended call counters for the shift report (M8) */
  stats: { angenommen: number; aufgelegt: number; auftraege: number; zugeordnet: number }
  incoming: (scenario: Scenario) => void
  answer: (id: string) => void
  hangup: () => void
  ask: (frageId: string) => void
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
  stats: { angenommen: 0, aufgelegt: 0, auftraege: 0, zugeordnet: 0 },

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
    const simSec = useGameStore.getState().simSec
    set((s) => {
      const call = s.active
      if (!call || call.ended) return s
      const frage = frageById.get(frageId)
      const frageText =
        frageId === 'beruhigen'
          ? 'Ich bin bei Ihnen, atmen Sie ruhig durch. Wir schicken Hilfe.'
          : frageId === 'eh_anweisung'
            ? 'Ich sage Ihnen jetzt, was Sie bis zum Eintreffen tun können.'
            : (frage?.text ?? frageId)
      const updated = { ...call }
      say(updated, 'calltaker', frageText, simSec)
      const antwort = answerFor(updated.scenario, frageId, updated.callerState)
      say(updated, 'anrufer', antwort, simSec)

      // auto-capture structured answers from truth where the question reveals them
      const t = updated.scenario.truth
      const answers = { ...updated.answers }
      switch (frageId) {
        case 'personen':
          if (updated.scenario.anrufer.emotion !== 'panisch' || updated.callerState.calmed)
            answers.personen = t.personen
          break
        case 'bewusstsein':
          answers.ansprechbar = t.ansprechbar
          break
        case 'atmung':
          answers.atmet = t.atmet
          break
        case 'alter':
          answers.alter = t.alter
          break
        case 'zugang':
          answers.zugang =
            t.zugang === 'frei' ? 'frei' : t.zugang === 'versperrt' ? 'versperrt' : 'schwer'
          break
        case 'rueckruf':
          answers.rueckrufOk = true
          break
      }
      updated.answers = answers

      // early hang-up disturbance: caller drops after a few questions
      if (
        updated.scenario.stoerungen.includes('legt_frueh_auf') &&
        updated.callerState.asked.length >= 3 &&
        !updated.ended
      ) {
        say(updated, 'system', 'Anrufer hat aufgelegt!', simSec)
        updated.ended = true
      }
      return { active: updated }
    })
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
    const auftragId = useDispatchStore.getState().createAuftrag({
      categoryId,
      severity,
      personen: a.personen ?? 1,
      ort,
      merkmalskette,
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
