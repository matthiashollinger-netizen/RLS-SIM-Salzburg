import { describe, expect, it } from 'vitest'
import { categories } from '../data/index.ts'
import { deriveCode, hospitalNeedsFor, manvCodeFor, proposeAo, unitsForCode } from './ao.ts'

describe('AO code derivation (GAME_DATA §4)', () => {
  it('maps every emergency category to its official default code', () => {
    expect(deriveCode('STILL')).toBe('A1')
    expect(deriveCode('ALPIN')).toBe('A2')
    expect(deriveCode('INTERN')).toBe('A1') // 'hoch' = more acute of the pair
    expect(deriveCode('INTERN', { severity: 'normal' })).toBe('B1')
    expect(deriveCode('TRAUMA')).toBe('A1') // "schwer: A1" — hoch picks the upgrade
    expect(deriveCode('TRAUMA', { severity: 'normal' })).toBe('B1')
    expect(deriveCode('KRANK')).toBe('B3')
    expect(deriveCode('WASSER')).toBe('A1')
    expect(deriveCode('BEREIT')).toBe('B3')
  })

  it('every category has a resolvable default proposal', () => {
    for (const c of categories) {
      expect(() => proposeAo(c.id), c.id).not.toThrow()
    }
  })

  it('MANV thresholds are exactly the official ones', () => {
    expect(manvCodeFor(5)).toBeNull()
    expect(manvCodeFor(6)).toBe('MANV1')
    expect(manvCodeFor(10)).toBe('MANV1')
    expect(manvCodeFor(11)).toBe('MANV2')
    expect(manvCodeFor(29)).toBe('MANV2')
    expect(manvCodeFor(30)).toBe('MANV3')
    expect(manvCodeFor(49)).toBe('MANV3')
    expect(manvCodeFor(50)).toBe('MANV4')
    expect(manvCodeFor(200)).toBe('MANV4')
  })

  it('emergency with 6+ persons escalates to MANV (CLAUDE.md M4)', () => {
    expect(deriveCode('VERKEHR', { personen: 8 })).toBe('MANV1')
    expect(deriveCode('EXPLOSION', { personen: 35 })).toBe('MANV3')
    expect(deriveCode('VERKEHR', { personen: 2, severity: 'normal' })).toBe('B1')
  })

  it('partner proposals follow the official category table', () => {
    expect(proposeAo('BRAND').partners).toEqual(['FW'])
    expect(proposeAo('GEWALT').partners).toEqual(['POL'])
    expect(proposeAo('GEWALT').lagefreigabe).toBe(true)
    expect(proposeAo('WASSER').partners).toEqual(['WR'])
    expect(proposeAo('ALPIN').partners).toEqual(['BR'])
    expect(proposeAo('VERKEHR').partners).toEqual(['FW', 'POL'])
  })

  it('SoSi comes from codes.json', () => {
    expect(proposeAo('STILL').sosi).toBe(true)
    expect(proposeAo('KRANK').sosi).toBe(false) // B3 without SoSi
  })

  it('unit composition: A-codes get NA + RTW, A2 prefers the helicopter', () => {
    const a1 = unitsForCode('A1')
    expect(a1.map((u) => u.purpose)).toEqual(['na', 'transport'])
    const a2 = unitsForCode('A2')
    expect(a2[0]!.types[0]).toBe('HELI')
    const a4 = unitsForCode('A4')
    expect(a4.map((u) => u.purpose)).toEqual(['na']) // RTW already on scene
  })

  it('unit composition: MANV scales with the level', () => {
    expect(unitsForCode('MANV1').filter((u) => u.purpose === 'transport').length).toBe(3)
    expect(unitsForCode('MANV2').filter((u) => u.purpose === 'transport').length).toBe(6)
    expect(unitsForCode('MANV4').filter((u) => u.purpose === 'na').length).toBe(4)
  })

  it('SCHWER requires the G-KTW (GAME_DATA §4 D/E-Liste)', () => {
    const schwer = categories.find((c) => c.id === 'SCHWER')!
    const units = unitsForCode('D1', schwer)
    expect(units[0]!.types).toEqual(['GKTW'])
  })
})

describe('hospital needs (GAME_DATA §9)', () => {
  it('Stroke → stroke-capable house only (CDK/Schwarzach)', () => {
    expect(hospitalNeedsFor('NEURO')).toEqual({ stroke: true })
  })
  it('severe trauma needs Schockraum', () => {
    expect(hospitalNeedsFor('TRAUMA')).toEqual({ trauma: true, schockraum: true })
  })
  it('PSYCH needs psychiatry (not Tauernklinikum!)', () => {
    expect(hospitalNeedsFor('PSYCH')).toEqual({ psych: true })
  })
  it('KRANK only needs basic care', () => {
    expect(hospitalNeedsFor('KRANK')).toEqual({ basic: true })
  })
})
