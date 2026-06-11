import { mulberry32 } from './rng.ts'

/**
 * Outcome engine (GAME_MECHANICS decisions #3/#8: outcomes shown, may be hard):
 * survival = f(category severity, time-to-first-unit, time-to-NA, T-CPR bonus,
 * hospital suitability). Deterministic per Auftrag (id-seeded).
 */

export interface OutcomeInput {
  auftragId: string
  categoryId: string
  severity: 'hoch' | 'normal'
  createdAt: number
  firstArrivalSec?: number
  /** first NA unit (NEF/NAW/Heli) on scene */
  naArrivalSec?: number
  /** Telefonreanimation instructed during the call (STILL) */
  tcpr?: boolean
  hospitalSuitable: boolean
  /** NA was needed (severe emergency) */
  naRequired: boolean
}

export interface OutcomeResult {
  survived: boolean
  /** 0..1 care quality independent of survival */
  quality: number
  text: string
  issues: string[]
}

function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Base survival probability per category at instant care (estimated, tunable). */
function baseSurvival(categoryId: string, severity: 'hoch' | 'normal'): number {
  if (categoryId === 'STILL') return 0.45 // REA with immediate response
  if (severity === 'hoch') return 0.93
  return 0.998
}

export function computeOutcome(input: OutcomeInput): OutcomeResult {
  const rng = mulberry32(hashSeed(input.auftragId))
  const issues: string[] = []

  let p = baseSurvival(input.categoryId, input.severity)

  const waitedMin =
    input.firstArrivalSec !== undefined
      ? (input.firstArrivalSec - input.createdAt) / 60
      : 45 // never reached → as bad as it gets

  if (input.firstArrivalSec === undefined) {
    issues.push('Kein Rettungsmittel eingetroffen!')
  }

  if (input.categoryId === 'STILL') {
    // REA: brutal time decay ~4%/min, halved with T-CPR (GAME_MECHANICS T-CPR bonus)
    const decayPerMin = input.tcpr ? 0.02 : 0.045
    p -= waitedMin * decayPerMin
    if (input.tcpr) p += 0.12
    else issues.push('Keine Telefonreanimation angeleitet.')
  } else if (input.severity === 'hoch') {
    // severe emergency: decay beyond 10 min response
    p -= Math.max(0, waitedMin - 10) * 0.02
    if (input.naRequired) {
      if (input.naArrivalSec === undefined) {
        p -= 0.1
        issues.push('Kein Notarzt am Einsatzort.')
      } else {
        const naDelayMin = (input.naArrivalSec - input.createdAt) / 60
        if (naDelayMin > 20) {
          p -= 0.05
          issues.push(`Notarzt erst nach ${Math.round(naDelayMin)} min am Einsatzort.`)
        }
      }
    }
  } else {
    p -= Math.max(0, waitedMin - 30) * 0.005
  }

  if (!input.hospitalSuitable) {
    p -= input.severity === 'hoch' ? 0.05 : 0.01
    issues.push('Zielklinik ohne benötigte Fähigkeit — Sekundärverlegung nötig.')
  }

  p = Math.min(0.999, Math.max(0.02, p))
  const survived = rng() < p

  let quality = p
  if (!survived) quality = Math.min(quality, 0.3)

  const text = survived
    ? input.categoryId === 'STILL'
      ? input.tcpr
        ? 'Patient überlebte — Telefonreanimation war entscheidend.'
        : 'Patient überlebte knapp.'
      : input.severity === 'hoch'
        ? 'Patient stabilisiert übergeben.'
        : 'Patient versorgt und übergeben.'
    : waitedMin > 15
      ? `Patient verstorben. Zeit bis Ersteintreffen: ${Math.round(waitedMin)} min.`
      : 'Patient trotz rascher Hilfe verstorben.'

  return { survived, quality, text, issues }
}
