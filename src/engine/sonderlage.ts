import { pickWeighted, type Rng } from './rng.ts'

/**
 * Sonderlagen (Welt-Direktor): rare, time-limited world events that shift the
 * incident mix, call rate and weather. Pure + deterministic — all randomness
 * comes through the injected Rng; eligibility derives from the sim context
 * (month/hour/weather/region) passed in by the caller.
 *
 * Category ids in `categoryFactors` reference src/data/categories.json /
 * balancing.json categoryWeights (GAME_DATA §4 Kategorien).
 */

export type SonderlageWeather = 'gut' | 'schlecht'
export type SonderlageRegion = 'NORD' | 'SUED'

export interface SonderlageConditions {
  /** calendar months (1–12) during which the event may start */
  months?: number[]
  /** hours of day (0–23) during which the event may start */
  hours?: number[]
  /** event may only start while the weather is already bad */
  requiresWeather?: 'schlecht'
  /** restrict to one Leitstellen-Region */
  regions?: SonderlageRegion[]
}

export interface SonderlageDef {
  id: string
  name: string
  /** one-line news-ticker text shown to the player */
  tickerText: string
  conditions: SonderlageConditions
  durationSec: number
  /** multiplier on the incoming-call rate while active */
  callRateFactor: number
  /** multipliers on balancing categoryWeights while active */
  categoryFactors: Record<string, number>
  /** event forces this weather for its duration (e.g. Sturmfront) */
  forceWeather?: 'schlecht'
  /** scripted MANV: the next generated call becomes this mass-casualty event */
  scriptedManv?: { categoryId: string; personenMin: number; personenMax: number }
  /** relative pick weight among eligible events (default 1 — lower = rarer) */
  pickWeight?: number
}

export interface SonderlageCtx {
  month: number
  hour: number
  weather: SonderlageWeather
  region: SonderlageRegion
  /** event ids excluded from the pick (recently finished — avoids repeats) */
  exclude?: string[]
}

/** All dynamic world events (durations/factors: gameplay balancing, ANNAHMEN.md). */
export const SONDERLAGEN: SonderlageDef[] = [
  {
    id: 'sturmfront',
    name: 'Sturmfront',
    tickerText:
      'Orkanböen über dem Land Salzburg — umgestürzte Bäume, Stromausfälle und blockierte Straßen gemeldet.',
    conditions: {},
    durationSec: 2.5 * 3600,
    callRateFactor: 1.8,
    categoryFactors: {
      TRAUMA: 1.8,
      VERKEHR: 1.6,
      STROM: 2.5,
      EINSTURZ: 4,
      BRAND: 1.5,
    },
    forceWeather: 'schlecht',
  },
  {
    id: 'glatteis_morgen',
    name: 'Glatteis-Morgen',
    tickerText:
      'Überfrierende Nässe im ganzen Bundesland — Glatteisunfälle und Stürze häufen sich.',
    conditions: { months: [12, 1, 2, 3], hours: [5, 6, 7, 8, 9, 10] },
    durationSec: 3 * 3600,
    callRateFactor: 1.5,
    categoryFactors: { VERKEHR: 2.2, TRAUMA: 2.0 },
  },
  {
    id: 'festival_abend',
    name: 'Festival-Abend',
    tickerText:
      'Großveranstaltung in der Stadt — alkoholbedingte Notfälle und Raufhandel nehmen zu.',
    conditions: { months: [6, 7, 8], hours: [18, 19, 20, 21, 22, 23] },
    durationSec: 4 * 3600,
    callRateFactor: 1.4,
    categoryFactors: { INTOX: 2.5, GEWALT: 2.2, PSYCH: 1.5 },
  },
  {
    id: 'grippewelle',
    name: 'Grippewelle',
    tickerText:
      'Influenza-Welle: Ordinationen überlastet — vermehrt Transporte mit Atemwegsinfekten.',
    conditions: { months: [11, 12, 1, 2, 3] },
    durationSec: 8 * 3600,
    callRateFactor: 1.4,
    categoryFactors: { KRANK: 1.8, INTERN: 1.5, COVID: 3 },
  },
  {
    id: 'manv_busunglueck',
    name: 'MANV: Busunglück',
    tickerText:
      'Reisebus verunglückt — Großschadenslage mit zahlreichen Verletzten gemeldet.',
    conditions: {},
    durationSec: 1 * 3600,
    callRateFactor: 1.1,
    categoryFactors: { VERKEHR: 1.3 },
    scriptedManv: { categoryId: 'VERKEHR', personenMin: 8, personenMax: 15 },
    pickWeight: 0.15, // rare
  },
  {
    id: 'hitzewelle',
    name: 'Hitzewelle',
    tickerText:
      'Temperaturen über 35 Grad — Kreislaufkollapse und Dehydrierung häufen sich.',
    conditions: { months: [6, 7, 8], hours: [12, 13, 14, 15, 16, 17, 18] },
    durationSec: 5 * 3600,
    callRateFactor: 1.3,
    categoryFactors: { INTERN: 1.8, KRANK: 1.4, STILL: 1.3 },
  },
]

/** Pure eligibility predicate for one event definition. */
export function isEligible(def: SonderlageDef, ctx: SonderlageCtx): boolean {
  const c = def.conditions
  if (c.months && !c.months.includes(ctx.month)) return false
  if (c.hours && !c.hours.includes(ctx.hour)) return false
  if (c.requiresWeather && ctx.weather !== c.requiresWeather) return false
  if (c.regions && !c.regions.includes(ctx.region)) return false
  if (ctx.exclude && ctx.exclude.includes(def.id)) return false
  return true
}

/** All events that may start in the given context. */
export function eligibleSonderlagen(ctx: SonderlageCtx): SonderlageDef[] {
  return SONDERLAGEN.filter((d) => isEligible(d, ctx))
}

/**
 * Pick one eligible Sonderlage (weighted by rarity) or null when none fits.
 * The caller decides IF an event starts (hourly chance roll) — this only
 * answers WHICH one.
 */
export function pickSonderlage(rng: Rng, ctx: SonderlageCtx): SonderlageDef | null {
  const eligible = eligibleSonderlagen(ctx)
  if (eligible.length === 0) return null
  return pickWeighted(
    rng,
    eligible.map((d) => ({ value: d, weight: d.pickWeight ?? 1 })),
  )
}

/**
 * Multiply category weights with the active event's factors (missing ids → ×1).
 * Returns a new array; the input is not mutated.
 */
export function applyCategoryFactors(
  weights: { cid: string; weight: number }[],
  factors: Record<string, number> | undefined,
): { cid: string; weight: number }[] {
  if (!factors) return weights.slice()
  return weights.map((w) => ({ cid: w.cid, weight: w.weight * (factors[w.cid] ?? 1) }))
}
