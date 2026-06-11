import { describe, expect, it } from 'vitest'
import { computeOutcome, type OutcomeInput } from './outcome.ts'

const base: OutcomeInput = {
  auftragId: 'E-0001',
  categoryId: 'INTERN',
  severity: 'hoch',
  createdAt: 0,
  firstArrivalSec: 8 * 60,
  naArrivalSec: 10 * 60,
  hospitalSuitable: true,
  naRequired: true,
}

/** survival rate over many id-seeds (outcome is deterministic per id) */
function survivalRate(input: Omit<OutcomeInput, 'auftragId'>, n = 400): number {
  let survived = 0
  for (let i = 0; i < n; i++) {
    if (computeOutcome({ ...input, auftragId: `E-${i}` }).survived) survived++
  }
  return survived / n
}

describe('outcome engine (M8)', () => {
  it('is deterministic per Auftrag id', () => {
    const a = computeOutcome(base)
    const b = computeOutcome(base)
    expect(a).toEqual(b)
  })

  it('fast response on severe emergencies → high survival', () => {
    const rate = survivalRate({ ...base })
    expect(rate).toBeGreaterThan(0.85)
  })

  it('REA: survival decays brutally with waiting time', () => {
    const fast = survivalRate({
      ...base,
      categoryId: 'STILL',
      firstArrivalSec: 5 * 60,
      tcpr: true,
    })
    const slow = survivalRate({
      ...base,
      categoryId: 'STILL',
      firstArrivalSec: 18 * 60,
      tcpr: false,
    })
    expect(fast).toBeGreaterThan(0.4)
    expect(slow).toBeLessThan(0.12)
    expect(fast - slow).toBeGreaterThan(0.3)
  })

  it('T-CPR bonus materially improves REA survival (GAME_MECHANICS)', () => {
    const withTcpr = survivalRate({
      ...base,
      categoryId: 'STILL',
      firstArrivalSec: 12 * 60,
      tcpr: true,
    })
    const without = survivalRate({
      ...base,
      categoryId: 'STILL',
      firstArrivalSec: 12 * 60,
      tcpr: false,
    })
    expect(withTcpr).toBeGreaterThan(without + 0.15)
  })

  it('missing T-CPR is called out as an issue', () => {
    const r = computeOutcome({ ...base, categoryId: 'STILL', tcpr: false })
    expect(r.issues.join(' ')).toContain('Telefonreanimation')
  })

  it('no NA on a severe incident lowers survival and adds an issue', () => {
    const withNa = survivalRate({ ...base })
    const withoutNa = survivalRate({ ...base, naArrivalSec: undefined })
    expect(withoutNa).toBeLessThan(withNa)
    const r = computeOutcome({ ...base, naArrivalSec: undefined })
    expect(r.issues.join(' ')).toContain('Kein Notarzt')
  })

  it('unsuitable hospital adds the Sekundärverlegung issue', () => {
    const r = computeOutcome({ ...base, hospitalSuitable: false })
    expect(r.issues.join(' ')).toContain('Sekundärverlegung')
  })

  it('no unit ever arriving is catastrophic', () => {
    const rate = survivalRate({ ...base, firstArrivalSec: undefined, naArrivalSec: undefined })
    expect(rate).toBeLessThan(0.55)
    const r = computeOutcome({ ...base, firstArrivalSec: undefined })
    expect(r.issues.join(' ')).toContain('Kein Rettungsmittel')
  })

  it('non-severe cases practically always survive', () => {
    const rate = survivalRate({
      ...base,
      severity: 'normal',
      naRequired: false,
      firstArrivalSec: 25 * 60,
    })
    expect(rate).toBeGreaterThan(0.97)
  })
})
