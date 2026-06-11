import { describe, expect, it } from 'vitest'
import { bestHospital, matchHospitals } from './hospitalMatch.ts'

const zellOrt = { lat: 47.32, lon: 12.8 } // Zell am See area
const stadtOrt = { lat: 47.8, lon: 13.04 } // Salzburg city

describe('hospital matching — „nächstes ≠ richtiges" (GAME_DATA §9)', () => {
  it('PSYCH from Zell am See: Tauernklinikum is closest but NOT suitable', () => {
    const ranked = matchHospitals({ psych: true }, zellOrt, true)
    const first = ranked[0]!
    expect(first.hospital.id).toBe('zell') // nearest
    expect(first.suitable).toBe(false) // but wrong!
    const best = bestHospital({ psych: true }, zellOrt, true)
    expect(best?.hospital.id).toBe('ksk') // Schwarzach is the right house
  })

  it('stroke from the city goes to CDK, not LKH/UKH', () => {
    const best = bestHospital({ stroke: true }, stadtOrt, true)
    expect(best?.hospital.id).toBe('cdk')
  })

  it('severe trauma in the city: UKH or LKH (Schockraum)', () => {
    const best = bestHospital({ trauma: true, schockraum: true }, stadtOrt, true)
    expect(['ukh', 'lkh']).toContain(best?.hospital.id)
  })

  it('basic care from Zell: Tauernklinikum is fine', () => {
    const best = bestHospital({ basic: true }, zellOrt, false)
    expect(best?.hospital.id).toBe('zell')
  })

  it('missing capabilities are reported', () => {
    const ranked = matchHospitals({ paed: true }, zellOrt, true)
    const zell = ranked.find((c) => c.hospital.id === 'zell')!
    expect(zell.suitable).toBe(false)
    expect(zell.missing).toContain('paed')
  })
})
