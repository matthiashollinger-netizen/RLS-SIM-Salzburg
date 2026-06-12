import { proposeAo, unitsForCode } from '../engine/ao.ts'
import { categoryById } from '../data/index.ts'
import { findUnits } from '../engine/dispatchSearch.ts'
import type { Scenario } from '../engine/scenario.ts'
import { mulberry32, type Rng } from '../engine/rng.ts'
import { vehicleSim } from './simulation.ts'
import { useDispatchStore } from './dispatchStore.ts'
import { useGameStore } from './gameStore.ts'
import { useEventLog } from './eventLog.ts'

/**
 * AI partners for solo play (GAME_MECHANICS §6):
 *  - AI calltaker (player = Disponent): turns generated calls into Aufträge
 *    with realistic fuzziness ("Adresse unklar, Anrufer aufgelegt").
 *  - AI dispatcher (player = Calltaker): assigns units per AO, conservative.
 */

const aiRng: Rng = mulberry32(1337)

// ---- AI Calltaker ----

interface PendingCall {
  scenario: Scenario
  dueAt: number
}

const pendingCalls: PendingCall[] = []

/** Feed a generated scenario to the AI calltaker (instead of the player queue). */
export function aiCalltakerReceive(scenario: Scenario, simSec: number) {
  if (scenario.callType !== 'notfall' && scenario.callType !== 'krankentransport') return
  // interview takes 30–90 s
  pendingCalls.push({ scenario, dueAt: simSec + 30 + aiRng() * 60 })
}

export function aiCalltakerTick(simSec: number) {
  for (let i = pendingCalls.length - 1; i >= 0; i--) {
    const p = pendingCalls[i]!
    if (simSec < p.dueAt) continue
    pendingCalls.splice(i, 1)
    const s = p.scenario
    if (s.duplicateOfAuftragId) {
      useEventLog.getState().append({
        simSec,
        kind: 'system',
        text: `KI-Calltaker: Duplizitätsanruf zu ${s.duplicateOfAuftragId} zugeordnet.`,
      })
      continue
    }
    const t = s.truth
    // fuzziness: sometimes wrong category, vague address or missing person count
    const blur: string[] = []
    let categoryId = t.categoryId
    let severity = t.severity
    let ort = { lat: t.ort.lat, lon: t.ort.lon, stadtteil: t.ort.stadtteil, strasse: t.ort.strasse }
    if (s.callType === 'notfall') {
      if (aiRng() < 0.1) {
        const cats = ['INTERN', 'TRAUMA', 'KRANK', 'NEURO']
        const wrong = cats.filter((c) => c !== t.categoryId)
        categoryId = wrong[Math.floor(aiRng() * wrong.length)]!
        blur.push('Stichwort unsicher')
      }
      if (aiRng() < 0.1) {
        severity = 'normal'
        blur.push('Schwere unklar')
      }
      if (aiRng() < 0.12) {
        ort = {
          ...ort,
          lat: ort.lat + (aiRng() - 0.5) * 0.006,
          lon: ort.lon + (aiRng() - 0.5) * 0.008,
          strasse: `${ort.strasse} (Adresse unklar)`,
        }
        blur.push('Anrufer aufgelegt, Adresse unklar')
      }
    } else {
      categoryId = s.ktKategorie ?? 'HEIM'
      severity = 'normal'
    }
    if (!categoryById.has(categoryId)) categoryId = 'SONST'
    useDispatchStore.getState().createAuftrag({
      categoryId,
      severity,
      personen: t.personen,
      ort,
      merkmalskette: ['KI-Calltaker-Abfrage', ...blur],
      truthCategoryId: s.callType === 'notfall' ? t.categoryId : undefined,
      truthSeverity: s.callType === 'notfall' ? t.severity : undefined,
    })
  }
}

export function aiCalltakerReset() {
  pendingCalls.length = 0
}

// ---- AI Dispatcher ----

const dispatchedByAi = new Set<string>()
const AI_DISPATCH_DELAY_SEC = 20

export function aiDispatcherTick(simSec: number) {
  const g = useGameStore.getState()
  const { auftraege, assignVehicle, alarmieren, togglePartner } = useDispatchStore.getState()
  for (const a of Object.values(auftraege)) {
    if (a.state !== 'offen' || dispatchedByAi.has(a.id)) continue
    if (simSec - a.createdAt < AI_DISPATCH_DELAY_SEC) continue
    dispatchedByAi.add(a.id)
    const category = categoryById.get(a.categoryId)
    const proposal = proposeAo(a.categoryId, { personen: a.personen, severity: a.severity })
    const slots = unitsForCode(a.code, category)
    const ctx = {
      simSec,
      weather: g.weather,
      startWeekday: g.startWeekday,
      month: g.month,
      season: g.season,
    }
    const used = new Set<string>()
    let stagedCount = 0
    for (const slot of slots) {
      const candidates = findUnits(vehicleSim, slot.types, a.ort, a.sosi, ctx, 6).filter(
        (c) => !used.has(c.id),
      )
      const pick = candidates[0]
      if (pick && assignVehicle(a.id, pick.id)) {
        used.add(pick.id)
        stagedCount++
      }
    }
    for (const partner of proposal.partners) {
      togglePartner(a.id, partner)
    }
    // ELS flow (Rework #8): staged units are alarmed together
    const alarmed = stagedCount > 0 && alarmieren(a.id)
    if (alarmed) {
      useEventLog.getState().append({
        simSec,
        kind: 'system',
        auftragId: a.id,
        text: `KI-Disponent: ${stagedCount} Mittel zu ${a.id} alarmiert.`,
      })
    } else {
      useEventLog.getState().append({
        simSec,
        kind: 'system',
        auftragId: a.id,
        text: `KI-Disponent: KEIN freies Mittel für ${a.id}!`,
      })
      dispatchedByAi.delete(a.id) // retry later
    }
  }
}

export function aiDispatcherReset() {
  dispatchedByAi.clear()
}
