import { categoryById, codeByCode, codes } from '../data/index.ts'
import type { Category, HospitalCapabilities, Partner, VehicleType } from '../data/schemas.ts'

/**
 * Ausrückordnung (AO) — GAME_DATA §4: Kategorie + Klasse = Stichwort.
 * Proposal from categories.defaultCode, SoSi from codes.json, partner alerts,
 * MANV check from 6 persons up (official thresholds). Unit composition per
 * code class is a game model (estimated — ANNAHMEN.md M4).
 */

export type UnitType = VehicleType | 'HELI' | 'NKTW'

export interface UnitRequirement {
  /** acceptable unit types, in preference order; NKTW = KTW with notfallKtw */
  types: UnitType[]
  purpose: 'na' | 'transport' | 'support' | 'el'
}

export interface AoProposal {
  code: string
  sosi: boolean
  units: UnitRequirement[]
  partners: Partner[]
  lagefreigabe: boolean
  heliRecommended: boolean
  manv: boolean
}

/** Severity from the Abfrage: 'hoch' picks defaultCode, 'normal' the altCode (if any). */
export type Severity = 'hoch' | 'normal'

/** MANV code by person count (official thresholds, GAME_DATA §4). */
export function manvCodeFor(personen: number): string | null {
  if (personen < 6) return null
  const manv = codes
    .filter((c) => c.class === 'MANV')
    .find((c) => personen >= (c.personsMin ?? 0) && personen <= (c.personsMax ?? Infinity))
  return manv?.code ?? 'MANV4'
}

/** Acuity ranking so 'hoch' always picks the more acute of a code pair —
 *  the official table lists pairs in both directions (INTERN "A1/B1" vs
 *  TRAUMA "B1, schwer: A1"). */
function acuityRank(code: string): number {
  const def = codeByCode.get(code)
  if (!def) return 0
  if (def.class === 'MANV') return 5
  if (def.class === 'A') return 4
  if (def.class === 'B') return def.sosi ? 3 : 2
  return 1
}

/** Derive the Einsatzcode for a category + interview result. */
export function deriveCode(
  categoryId: string,
  opts: { personen?: number; severity?: Severity } = {},
): string {
  const category = categoryById.get(categoryId)
  if (!category) throw new Error(`unknown category ${categoryId}`)
  const personen = opts.personen ?? 1
  if (category.manvCheck || category.group === 'emergency') {
    const manv = manvCodeFor(personen)
    if (manv) return manv
  }
  if (!category.altCode) return category.defaultCode
  const pair = [category.defaultCode, category.altCode].sort(
    (a, b) => acuityRank(b) - acuityRank(a),
  )
  return (opts.severity ?? 'hoch') === 'hoch' ? pair[0]! : pair[1]!
}

const NA_SLOT: UnitRequirement = { types: ['NEF', 'NAW', 'HELI'], purpose: 'na' }
const RTW_SLOT: UnitRequirement = { types: ['RTW', 'NKTW'], purpose: 'transport' }
const KTW_SLOT: UnitRequirement = { types: ['KTW', 'RTW'], purpose: 'transport' }
const EL_SLOT: UnitRequirement = { types: ['EL', 'MTW'], purpose: 'el' }

/** Unit composition per code (game AO model, estimated — ANNAHMEN.md M4). */
export function unitsForCode(code: string, category?: Category): UnitRequirement[] {
  const def = codeByCode.get(code)
  if (!def) throw new Error(`unknown code ${code}`)

  if (def.class === 'MANV') {
    const scale: Record<string, [number, number, number]> = {
      MANV1: [1, 3, 1],
      MANV2: [2, 6, 1],
      MANV3: [3, 10, 2],
      MANV4: [4, 15, 2],
    }
    const [na, rtw, el] = scale[code] ?? [1, 3, 1]
    return [
      ...Array.from({ length: na }, () => NA_SLOT),
      ...Array.from({ length: rtw }, () => RTW_SLOT),
      ...Array.from({ length: el }, () => EL_SLOT),
    ]
  }

  switch (def.class) {
    case 'A': {
      // A2 Alpin: helicopter first (GAME_DATA §4 ALPIN +Heli/Bergrettung)
      const na: UnitRequirement =
        code === 'A2' ? { types: ['HELI', 'NEF', 'NAW'], purpose: 'na' } : NA_SLOT
      // A4 Nachforderung: RTW is already on scene
      return code === 'A4' ? [na] : [na, RTW_SLOT]
    }
    case 'B':
      return [RTW_SLOT]
    case 'C':
      switch (code) {
        case 'C1':
          return [{ types: ['NEF', 'NAW'], purpose: 'na' }, RTW_SLOT]
        case 'C2':
          return [{ types: ['HELI'], purpose: 'na' }]
        case 'C3':
        case 'C5':
          return [{ types: ['RTW', 'ITW'], purpose: 'transport' }]
        default:
          return [KTW_SLOT]
      }
    case 'D': {
      if (category?.requiresGktw) return [{ types: ['GKTW'], purpose: 'transport' }]
      switch (code) {
        case 'D1':
          return [{ types: ['KTW', 'BTW'], purpose: 'transport' }]
        case 'D2':
        case 'D3':
          return [{ types: ['KTW', 'BTW'], purpose: 'transport' }]
        case 'D4':
        case 'D6':
          return [{ types: ['BTW', 'GKTW'], purpose: 'transport' }]
        default:
          return [{ types: ['KTW', 'BTW', 'MTW'], purpose: 'transport' }]
      }
    }
    case 'E':
      switch (code) {
        case 'E1':
          return [{ types: ['EL', 'MTW'], purpose: 'support' }]
        case 'E2':
          return [{ types: ['MTW', 'EL', 'KTW'], purpose: 'support' }]
        case 'E3':
          return [{ types: ['EL', 'MTW'], purpose: 'support' }]
        case 'E4':
          return [{ types: ['MTW', 'EL'], purpose: 'support' }]
        default:
          return [] // E5/E6: no vehicle
      }
  }
}

export function proposeAo(
  categoryId: string,
  opts: { personen?: number; severity?: Severity } = {},
): AoProposal {
  const category = categoryById.get(categoryId)
  if (!category) throw new Error(`unknown category ${categoryId}`)
  const code = deriveCode(categoryId, opts)
  const def = codeByCode.get(code)!
  return {
    code,
    sosi: def.sosi,
    units: unitsForCode(code, category),
    partners: [...category.partner],
    lagefreigabe: category.lagefreigabe,
    heliRecommended: category.heliPreferred,
    manv: def.class === 'MANV',
  }
}

/** Hospital capability needs per category (GAME_DATA §9 Zielklinik-Spiellogik). */
export function hospitalNeedsFor(
  categoryId: string,
  severity: Severity = 'hoch',
): Partial<HospitalCapabilities> {
  switch (categoryId) {
    case 'NEURO':
      return severity === 'hoch' ? { stroke: true } : { basic: true }
    case 'TRAUMA':
    case 'VERKEHR':
    case 'VERKEHR_LUFT':
    case 'VERKEHR_SCHIENE':
    case 'EINSTURZ':
    case 'EXPLOSION':
    case 'VERSCHUETTUNG':
    case 'ALPIN':
    case 'HOEHLE_GRUBE':
      return severity === 'hoch' ? { trauma: true, schockraum: true } : { basic: true }
    case 'INTERN':
    case 'STILL':
      return severity === 'hoch' ? { cardiac: true } : { basic: true }
    case 'PSYCH':
      return { psych: true }
    case 'GYN':
      return { gyn: true }
    case 'BRAND':
    case 'STROM':
      return severity === 'hoch' ? { trauma: true, schockraum: true } : { basic: true }
    default:
      return { basic: true }
  }
}
