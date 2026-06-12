import { describe, expect, it } from 'vitest'
import { mulberry32 } from './rng.ts'
import {
  generateScenario,
  timeWeatherFactor,
  type GenerateOpts,
  type Scenario,
} from './scenario.ts'
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

  it('caller variety: high-weight Hauptbeschwerden offer 3+ Lage-Varianten', () => {
    // INTERN/TRAUMA/KRANK/VERKEHR repeat most often — variants keep callers fresh
    const seen = new Map<string, Set<string>>()
    for (const s of scenarios) {
      const key = s.truth.hauptbeschwerdeId
      if (!seen.has(key)) seen.set(key, new Set())
      seen.get(key)!.add(s.truth.lageText)
    }
    for (const hbId of ['brustschmerz', 'sturz', 'krank', 'verkehrsunfall', 'schlaganfall']) {
      expect(seen.get(hbId)?.size ?? 0).toBeGreaterThanOrEqual(3)
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

describe('time/weather/Sonderlage modifiers (Welt-Direktor)', () => {
  function emergenciesWith(n: number, seed: number, opts: Partial<GenerateOpts>) {
    const rng = mulberry32(seed)
    const out: Scenario[] = []
    for (let i = 0; i < n; i++) {
      out.push(generateScenario(rng, { region: 'NORD', ...opts }))
    }
    return out.filter((s) => s.callType === 'notfall')
  }
  const share = (list: Scenario[], cids: string[]) =>
    list.filter((s) => cids.includes(s.truth.categoryId)).length / list.length

  it('timeWeatherFactor applies the documented multipliers exactly', () => {
    // night 22:00–03:59
    expect(timeWeatherFactor('INTOX', { hour: 23 })).toBe(2)
    expect(timeWeatherFactor('GEWALT', { hour: 2 })).toBe(2)
    expect(timeWeatherFactor('PSYCH', { hour: 22 })).toBe(2)
    expect(timeWeatherFactor('RUFHILFE', { hour: 1 })).toBe(1.5)
    expect(timeWeatherFactor('INTOX', { hour: 12 })).toBe(1)
    expect(timeWeatherFactor('INTOX', { hour: 4 })).toBe(1) // window closed
    // rush hours
    expect(timeWeatherFactor('VERKEHR', { hour: 8 })).toBe(1.8)
    expect(timeWeatherFactor('VERKEHR', { hour: 17 })).toBe(1.8)
    expect(timeWeatherFactor('VERKEHR', { hour: 12 })).toBe(1)
    expect(timeWeatherFactor('INTERN', { hour: 8 })).toBe(1)
    // winter ice (weather + season required together)
    expect(timeWeatherFactor('VERKEHR', { weather: 'schlecht', season: 'winter' })).toBe(1.6)
    expect(timeWeatherFactor('TRAUMA', { weather: 'schlecht', season: 'winter' })).toBe(1.6)
    expect(timeWeatherFactor('TRAUMA', { weather: 'schlecht', season: 'summer' })).toBe(1)
    expect(timeWeatherFactor('TRAUMA', { weather: 'gut', season: 'winter' })).toBe(1)
    // multipliers stack: rush hour + winter ice
    expect(
      timeWeatherFactor('VERKEHR', { hour: 8, weather: 'schlecht', season: 'winter' }),
    ).toBeCloseTo(1.8 * 1.6)
    // no opts → neutral (existing callers unchanged)
    expect(timeWeatherFactor('INTOX', {})).toBe(1)
  })

  it('night shifts the mix toward intox/violence/psych', () => {
    const night = emergenciesWith(2500, 21, { hour: 23 })
    const noon = emergenciesWith(2500, 21, { hour: 12 })
    const cids = ['INTOX', 'GEWALT', 'PSYCH']
    expect(share(night, cids)).toBeGreaterThan(share(noon, cids) * 1.4)
  })

  it('rush hour boosts traffic accidents', () => {
    const rush = emergenciesWith(2500, 31, { hour: 8 })
    const noon = emergenciesWith(2500, 31, { hour: 12 })
    expect(share(rush, ['VERKEHR'])).toBeGreaterThan(share(noon, ['VERKEHR']) * 1.3)
  })

  it('bad winter weather boosts traffic + falls', () => {
    const icy = emergenciesWith(2500, 41, { weather: 'schlecht', season: 'winter' })
    const dry = emergenciesWith(2500, 41, { weather: 'gut', season: 'winter' })
    expect(share(icy, ['VERKEHR', 'TRAUMA'])).toBeGreaterThan(
      share(dry, ['VERKEHR', 'TRAUMA']) * 1.2,
    )
  })

  it('Sonderlage categoryFactors reshape the distribution on top', () => {
    const boosted = emergenciesWith(2000, 51, { categoryFactors: { WASSER: 60 } })
    const normal = emergenciesWith(2000, 51, {})
    expect(share(boosted, ['WASSER'])).toBeGreaterThan(0.15)
    expect(share(normal, ['WASSER'])).toBeLessThan(0.05)
  })

  it('forceManvPersonen scripts a traffic MANV with the exact person count', () => {
    const rng = mulberry32(61)
    const s = generateScenario(rng, {
      region: 'NORD',
      forceType: 'notfall',
      forceHauptbeschwerde: 'verkehrsunfall',
      forceManvPersonen: 12,
      openIncidents: [
        { id: 'E-1', ort: { lat: 47.8, lon: 13.04, stadtteil: 'Lehen', strasse: 'Teststraße' } },
      ],
    })
    expect(s.callType).toBe('notfall')
    expect(s.truth.categoryId).toBe('VERKEHR')
    expect(s.truth.personen).toBe(12)
    // scripted MANV is always a fresh incident, never a duplicate call
    expect(s.duplicateOfAuftragId).toBeUndefined()
  })

  it('is deterministic: same seed + same opts → identical scenario (minus id)', () => {
    const opts: GenerateOpts = {
      region: 'SUED',
      hour: 23,
      weather: 'schlecht',
      season: 'winter',
      categoryFactors: { INTOX: 2.5, GEWALT: 2.2 },
    }
    const a = generateScenario(mulberry32(99), opts)
    const b = generateScenario(mulberry32(99), opts)
    expect({ ...a, id: '' }).toEqual({ ...b, id: '' })
  })
})
