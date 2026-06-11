import { balancing } from '../data/index.ts'
import type { Auftrag } from './auftrag.ts'

/**
 * Shift scoring (GAME_DATA §11 score dimensions): Hilfsfrist quota,
 * Stichwort accuracy, Fehldispositionen, outcomes.
 */

export interface AuftragMetrics {
  id: string
  alarmtext: string
  hilfsfristApplied: boolean
  hilfsfristMet?: boolean
  responseMin?: number
  /** truth from the scenario (when created via call) */
  truthCategoryId?: string
  chosenCategoryId: string
  stichwortKorrekt?: boolean
  hospitalSuitable: boolean
  survived?: boolean
  outcomeText?: string
  issues: string[]
}

export interface ShiftReport {
  startedAtIso: string
  region: string
  durationHours: number
  auftraege: AuftragMetrics[]
  calls: { angenommen: number; auftraege: number; zugeordnet: number }
  hilfsfristQuote: number | null
  stichwortQuote: number | null
  fehldispoCount: number
  ueberlebt: number
  verstorben: number
  /** 1 (sehr gut) … 5 (nicht genügend) */
  note: number
  noteText: string
}

export function metricsFor(a: Auftrag): AuftragMetrics {
  const hilfsfristApplied = a.hilfsfristDeadline !== undefined && !a.uebung
  const responseMin =
    a.firstArrivalSec !== undefined ? (a.firstArrivalSec - a.createdAt) / 60 : undefined
  return {
    id: a.id,
    alarmtext: `${a.code} ${a.ort.stadtteil} ${a.ort.strasse}`,
    hilfsfristApplied,
    hilfsfristMet: hilfsfristApplied
      ? a.firstArrivalSec !== undefined && a.firstArrivalSec <= a.hilfsfristDeadline!
      : undefined,
    responseMin,
    truthCategoryId: a.truthCategoryId,
    chosenCategoryId: a.categoryId,
    stichwortKorrekt: a.truthCategoryId ? a.truthCategoryId === a.categoryId : undefined,
    hospitalSuitable: a.hospitalSuitable ?? true,
    survived: a.outcome?.survived,
    outcomeText: a.outcome?.text,
    issues: a.outcome?.issues ?? [],
  }
}

export function buildReport(
  auftraege: Auftrag[],
  calls: { angenommen: number; auftraege: number; zugeordnet: number },
  opts: { region: string; durationHours: number; startedAtIso: string },
): ShiftReport {
  const relevant = auftraege.filter((a) => !a.uebung)
  const metrics = relevant.map(metricsFor)

  const hf = metrics.filter((m) => m.hilfsfristApplied)
  const hfMet = hf.filter((m) => m.hilfsfristMet).length
  const hilfsfristQuote = hf.length > 0 ? hfMet / hf.length : null

  const sw = metrics.filter((m) => m.stichwortKorrekt !== undefined)
  const swOk = sw.filter((m) => m.stichwortKorrekt).length
  const stichwortQuote = sw.length > 0 ? swOk / sw.length : null

  const fehldispoCount = metrics.filter((m) => !m.hospitalSuitable).length

  const withOutcome = metrics.filter((m) => m.survived !== undefined)
  const ueberlebt = withOutcome.filter((m) => m.survived).length
  const verstorben = withOutcome.length - ueberlebt

  // grade: weighted score vs the 95% Hilfsfrist target (GAME_DATA §11)
  let score = 0
  let weight = 0
  if (hilfsfristQuote !== null) {
    score += Math.min(1, hilfsfristQuote / 0.95) * 0.4
    weight += 0.4
  }
  if (stichwortQuote !== null) {
    score += stichwortQuote * 0.3
    weight += 0.3
  }
  if (metrics.length > 0) {
    score += (1 - Math.min(1, fehldispoCount / Math.max(1, metrics.length))) * 0.15
    weight += 0.15
    const survQuote = withOutcome.length > 0 ? ueberlebt / withOutcome.length : 1
    score += survQuote * 0.15
    weight += 0.15
  }
  const normalized = weight > 0 ? score / weight : 1
  const note =
    normalized >= 0.92 ? 1 : normalized >= 0.8 ? 2 : normalized >= 0.65 ? 3 : normalized >= 0.5 ? 4 : 5
  const noteText =
    note === 1
      ? 'Sehr gut — Leitstellen-Niveau.'
      : note === 2
        ? 'Gut — solide Schicht.'
        : note === 3
          ? 'Befriedigend — Luft nach oben.'
          : note === 4
            ? 'Genügend — kritische Fehler ansehen!'
            : 'Nicht genügend — Debriefing dringend nötig.'

  return {
    startedAtIso: opts.startedAtIso,
    region: opts.region,
    durationHours: opts.durationHours,
    auftraege: metrics,
    calls,
    hilfsfristQuote,
    stichwortQuote,
    fehldispoCount,
    ueberlebt,
    verstorben,
    note,
    noteText,
  }
}

/** 15-min target from balancing (re-exported for UI). */
export const HILFSFRIST_MIN = balancing.hilfsfristMin
