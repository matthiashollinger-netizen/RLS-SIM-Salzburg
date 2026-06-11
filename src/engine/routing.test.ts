import { describe, expect, it } from 'vitest'
import { haversineKm } from './geo.ts'
import { routeTravelSec } from './routing.ts'

const salzburg = { lat: 47.8095, lon: 13.055 }
const zell = { lat: 47.3239, lon: 12.7981 }
const lehen = { lat: 47.815, lon: 13.025 } // city
const altstadt = { lat: 47.799, lon: 13.045 } // city

describe('routing model (CLAUDE.md §3)', () => {
  it('haversine Salzburg–Zell am See ≈ 57 km', () => {
    const d = haversineKm(salzburg, zell)
    expect(d).toBeGreaterThan(50)
    expect(d).toBeLessThan(65)
  })

  it('SoSi is ~30% faster than without', () => {
    const noSosi = routeTravelSec(salzburg, zell, { typ: 'RTW', sosi: false })
    const sosi = routeTravelSec(salzburg, zell, { typ: 'RTW', sosi: true })
    expect(sosi).toBeLessThan(noSosi)
    expect(noSosi / sosi).toBeCloseTo(1.3, 1)
  })

  it('city routes use the slower city speed', () => {
    const cityTrip = routeTravelSec(lehen, altstadt, { typ: 'RTW', sosi: false })
    const km = haversineKm(lehen, altstadt) * 1.35
    const expectedSec = (km / 35) * 3600
    expect(cityTrip).toBeCloseTo(expectedSec, 0)
  })

  it('helicopter: 220 km/h straight line + 3 min start, no detour factor', () => {
    const t = routeTravelSec(salzburg, zell, { typ: 'HELI', sosi: true })
    const km = haversineKm(salzburg, zell)
    expect(t).toBeCloseTo(180 + (km / 220) * 3600, 0)
    // Heli must beat ground RTW over this distance
    expect(t).toBeLessThan(routeTravelSec(salzburg, zell, { typ: 'RTW', sosi: true }))
  })
})
