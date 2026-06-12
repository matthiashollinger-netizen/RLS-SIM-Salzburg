import { describe, expect, it } from 'vitest'
import { mulberry32 } from './rng.ts'
import {
  applyCategoryFactors,
  eligibleSonderlagen,
  isEligible,
  pickSonderlage,
  SONDERLAGEN,
  type SonderlageCtx,
  type SonderlageDef,
} from './sonderlage.ts'

const ctx = (over: Partial<SonderlageCtx> = {}): SonderlageCtx => ({
  month: 6,
  hour: 12,
  weather: 'gut',
  region: 'NORD',
  ...over,
})

describe('Sonderlage definitions', () => {
  it('defines 5–6 events with unique ids and sane numbers', () => {
    expect(SONDERLAGEN.length).toBeGreaterThanOrEqual(5)
    expect(SONDERLAGEN.length).toBeLessThanOrEqual(6)
    const ids = new Set(SONDERLAGEN.map((d) => d.id))
    expect(ids.size).toBe(SONDERLAGEN.length)
    for (const d of SONDERLAGEN) {
      expect(d.durationSec).toBeGreaterThan(0)
      expect(d.callRateFactor).toBeGreaterThanOrEqual(1)
      expect(d.name.length).toBeGreaterThan(0)
      expect(d.tickerText.length).toBeGreaterThan(0)
      if (d.scriptedManv) {
        expect(d.scriptedManv.personenMin).toBeGreaterThanOrEqual(6) // MANV threshold
        expect(d.scriptedManv.personenMax).toBeGreaterThanOrEqual(d.scriptedManv.personenMin)
      }
    }
  })

  it('Sturmfront forces bad weather, Busunglück scripts a traffic MANV', () => {
    const sturm = SONDERLAGEN.find((d) => d.id === 'sturmfront')!
    expect(sturm.forceWeather).toBe('schlecht')
    const bus = SONDERLAGEN.find((d) => d.id === 'manv_busunglueck')!
    expect(bus.scriptedManv?.categoryId).toBe('VERKEHR')
    expect(bus.pickWeight ?? 1).toBeLessThan(1) // rare
  })
})

describe('eligibility filtering', () => {
  it('winter morning enables Glatteis but not Festival/Hitzewelle', () => {
    const ids = eligibleSonderlagen(ctx({ month: 1, hour: 7 })).map((d) => d.id)
    expect(ids).toContain('glatteis_morgen')
    expect(ids).toContain('grippewelle')
    expect(ids).not.toContain('festival_abend')
    expect(ids).not.toContain('hitzewelle')
  })

  it('summer evening enables Festival but not Glatteis/Grippewelle', () => {
    const ids = eligibleSonderlagen(ctx({ month: 7, hour: 21 })).map((d) => d.id)
    expect(ids).toContain('festival_abend')
    expect(ids).not.toContain('glatteis_morgen')
    expect(ids).not.toContain('grippewelle')
    expect(ids).not.toContain('hitzewelle') // afternoon only
  })

  it('unconditioned events (Sturmfront, Busunglück) are always eligible', () => {
    for (const c of [ctx(), ctx({ month: 1, hour: 3 }), ctx({ region: 'SUED', hour: 23 })]) {
      const ids = eligibleSonderlagen(c).map((d) => d.id)
      expect(ids).toContain('sturmfront')
      expect(ids).toContain('manv_busunglueck')
    }
  })

  it('respects requiresWeather and regions on a synthetic definition', () => {
    const def: SonderlageDef = {
      id: 'test_lawine',
      name: 'Test',
      tickerText: 'Test',
      conditions: { requiresWeather: 'schlecht', regions: ['SUED'] },
      durationSec: 3600,
      callRateFactor: 1,
      categoryFactors: {},
    }
    expect(isEligible(def, ctx({ weather: 'schlecht', region: 'SUED' }))).toBe(true)
    expect(isEligible(def, ctx({ weather: 'gut', region: 'SUED' }))).toBe(false)
    expect(isEligible(def, ctx({ weather: 'schlecht', region: 'NORD' }))).toBe(false)
  })

  it('exclude list removes recently used events from the pool', () => {
    const all = eligibleSonderlagen(ctx()).map((d) => d.id)
    const filtered = eligibleSonderlagen(ctx({ exclude: all })).map((d) => d.id)
    expect(filtered).toEqual([])
  })
})

describe('pickSonderlage', () => {
  it('returns null when nothing is eligible', () => {
    const rng = mulberry32(1)
    const allIds = SONDERLAGEN.map((d) => d.id)
    expect(pickSonderlage(rng, ctx({ exclude: allIds }))).toBeNull()
  })

  it('is deterministic for a fixed seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const contexts = [
      ctx({ month: 1, hour: 7 }),
      ctx({ month: 7, hour: 20 }),
      ctx({ month: 10, hour: 14, region: 'SUED' }),
    ]
    for (const c of contexts) {
      for (let i = 0; i < 25; i++) {
        expect(pickSonderlage(a, c)?.id).toBe(pickSonderlage(b, c)?.id)
      }
    }
  })

  it('only ever returns eligible events', () => {
    const rng = mulberry32(9)
    const c = ctx({ month: 2, hour: 6 }) // winter morning
    for (let i = 0; i < 200; i++) {
      const d = pickSonderlage(rng, c)
      expect(d).not.toBeNull()
      expect(isEligible(d!, c)).toBe(true)
    }
  })

  it('rare events (Busunglück) are picked much less often than common ones', () => {
    const rng = mulberry32(123)
    const c = ctx({ month: 1, hour: 12 }) // eligible: sturmfront, grippewelle, busunglueck
    const counts = new Map<string, number>()
    for (let i = 0; i < 2000; i++) {
      const d = pickSonderlage(rng, c)!
      counts.set(d.id, (counts.get(d.id) ?? 0) + 1)
    }
    expect(counts.get('manv_busunglueck') ?? 0).toBeGreaterThan(0)
    expect(counts.get('manv_busunglueck')!).toBeLessThan(counts.get('grippewelle')! / 2)
    expect(counts.get('manv_busunglueck')!).toBeLessThan(counts.get('sturmfront')! / 2)
  })
})

describe('applyCategoryFactors', () => {
  const weights = [
    { cid: 'INTERN', weight: 22 },
    { cid: 'VERKEHR', weight: 8 },
    { cid: 'INTOX', weight: 4 },
  ]

  it('multiplies matching categories and leaves the rest untouched', () => {
    const out = applyCategoryFactors(weights, { VERKEHR: 2.2, INTOX: 0.5 })
    expect(out).toEqual([
      { cid: 'INTERN', weight: 22 },
      { cid: 'VERKEHR', weight: 8 * 2.2 },
      { cid: 'INTOX', weight: 2 },
    ])
  })

  it('returns an unchanged copy without factors and never mutates the input', () => {
    const out = applyCategoryFactors(weights, undefined)
    expect(out).toEqual(weights)
    expect(out).not.toBe(weights)
    applyCategoryFactors(weights, { INTERN: 0 })
    expect(weights[0]!.weight).toBe(22)
  })
})
