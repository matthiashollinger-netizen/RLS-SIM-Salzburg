import { describe, expect, it } from 'vitest'
import { mulberry32 } from './rng.ts'
import { generateScenario, type Scenario } from './scenario.ts'
import { categoryById } from '../data/index.ts'
import { hauptbeschwerdeById } from './abfrage.ts'

function generateMany(n: number, seed = 7, openIncidents: { id: string; ort: never }[] = []) {
  const rng = mulberry32(seed)
  const out: Scenario[] = []
  for (let i = 0; i < n; i++) {
    out.push(
      generateScenario(rng, {
        region: 'NORD',
        openIncidents: openIncidents as never,
      }),
    )
  }
  return out
}

describe('scenario generator distribution (Tier 1)', () => {
  const scenarios = generateMany(2000)

  it('produces a believable call-type mix (Anruf-Triage)', () => {
    const counts = new Map<string, number>()
    for (const s of scenarios) counts.set(s.callType, (counts.get(s.callType) ?? 0) + 1)
    const share = (t: string) => (counts.get(t) ?? 0) / scenarios.length
    expect(share('notfall')).toBeGreaterThan(0.4)
    expect(share('notfall')).toBeLessThan(0.7)
    expect(share('krankentransport')).toBeGreaterThan(0.15)
    expect(share('taschenwaehler')).toBeGreaterThan(0.01)
    expect(share('irrlaeufer')).toBeGreaterThan(0.02)
  })

  it('emergency categories follow the balancing weights (INTERN most common)', () => {
    const emergencies = scenarios.filter((s) => s.callType === 'notfall')
    const counts = new Map<string, number>()
    for (const s of emergencies)
      counts.set(s.truth.categoryId, (counts.get(s.truth.categoryId) ?? 0) + 1)
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
    expect(sorted[0]![0]).toBe('INTERN')
    // rare categories stay rare
    expect((counts.get('EXPLOSION') ?? 0) / emergencies.length).toBeLessThan(0.01)
  })

  it('every scenario references valid category + Hauptbeschwerde, consistent pair', () => {
    for (const s of scenarios) {
      expect(categoryById.has(s.truth.categoryId)).toBe(true)
      const hb = hauptbeschwerdeById.get(s.truth.hauptbeschwerdeId)
      expect(hb).toBeDefined()
      expect(hb!.categoryId).toBe(s.truth.categoryId)
    }
  })

  it('AML only on mobile calls, 10–30 s delay (GAME_DATA §3b)', () => {
    for (const s of scenarios) {
      if (s.amlAfterSec !== undefined) {
        expect(s.phone).toBe('handy')
        expect(s.amlAfterSec).toBeGreaterThanOrEqual(10)
        expect(s.amlAfterSec).toBeLessThanOrEqual(30)
        expect(s.amlRadiusM).toBeGreaterThan(0)
      }
      if (s.phone === 'festnetz') {
        expect(s.anschlussAdresse).toBeDefined()
      }
    }
    const handy = scenarios.filter((s) => s.phone === 'handy')
    const withAml = handy.filter((s) => s.amlAfterSec !== undefined)
    expect(withAml.length / handy.length).toBeGreaterThan(0.6) // not always!
    expect(withAml.length / handy.length).toBeLessThan(0.9)
  })

  it('reanimation scenarios are consistent: not breathing, caller not the patient', () => {
    const reas = scenarios.filter((s) => s.truth.hauptbeschwerdeId === 'reanimation')
    expect(reas.length).toBeGreaterThan(0)
    for (const s of reas) {
      expect(s.truth.atmet).toBe(false)
      expect(s.anrufer.rolle).not.toBe('selbst')
    }
  })

  it('duplicates only occur when open incidents exist', () => {
    for (const s of scenarios) expect(s.duplicateOfAuftragId).toBeUndefined()
    const rng = mulberry32(11)
    const open = [
      { id: 'E-0001', ort: { lat: 47.8, lon: 13.04, stadtteil: 'Lehen', strasse: 'Teststraße' } },
    ]
    let dups = 0
    for (let i = 0; i < 300; i++) {
      const s = generateScenario(rng, { region: 'NORD', openIncidents: open })
      if (s.duplicateOfAuftragId === 'E-0001') dups++
    }
    expect(dups).toBeGreaterThan(5)
  })
})
