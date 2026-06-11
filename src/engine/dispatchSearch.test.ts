import { describe, expect, it } from 'vitest'
import { helicopters } from '../data/index.ts'
import { findUnits, type SearchContext } from './dispatchSearch.ts'
import { unitFromHelicopter, unitFromVehicle, VehicleSim } from './vehicleSim.ts'
import type { Vehicle } from '../data/schemas.ts'

const ALWAYS = [{ days: [1, 2, 3, 4, 5, 6, 7], from: '00:00', to: '24:00' }]

function vehicle(partial: Partial<Vehicle> & Pick<Vehicle, 'funkrufname' | 'typ' | 'homeStation'>): Vehicle {
  return {
    dienstzeiten: ALWAYS,
    reserve: false,
    notfallKtw: false,
    rollstuhlgeeignet: false,
    ...partial,
  }
}

const fleet: Vehicle[] = [
  vehicle({ funkrufname: '5.20-201', typ: 'RTW', homeStation: 'stadt' }), // Salzburg
  vehicle({ funkrufname: '5.71-202', typ: 'RTW', homeStation: 'zell' }), // Zell am See
  vehicle({ funkrufname: '5.10-107', typ: 'NEF', homeStation: 'zell' }),
  vehicle({ funkrufname: '5.77-301', typ: 'KTW', homeStation: 'wald', notfallKtw: true }),
  vehicle({ funkrufname: '5.91-301', typ: 'KTW', homeStation: 'tamsweg' }),
]

function makeSim() {
  const sim = new VehicleSim(7, [
    ...fleet.map(unitFromVehicle),
    ...helicopters.map(unitFromHelicopter),
  ])
  // bring everything in service (noon, summer Monday)
  const ctx = { startWeekday: 1 as const, month: 6, season: 'summer' as const }
  for (let t = 12 * 3600; t < 12 * 3600 + 1500; t += 10) sim.tick(t, ctx)
  return sim
}

const baseCtx: SearchContext = {
  simSec: 12 * 3600 + 1500,
  weather: 'gut',
  startWeekday: 1,
  month: 6,
  season: 'summer',
}

const zellOrt = { lat: 47.32, lon: 12.8 }

describe('nearest-suitable-unit search (CLAUDE.md M4)', () => {
  it('ranks the closest matching RTW first', () => {
    const sim = makeSim()
    const result = findUnits(sim, ['RTW'], zellOrt, true, baseCtx)
    expect(result[0]!.id).toBe('5.71-202') // Zell RTW beats Stadt RTW
    expect(result.map((r) => r.id)).toContain('5.20-201')
    expect(result.map((r) => r.id)).not.toContain('5.91-301') // KTW excluded
  })

  it('NKTW accepts only Notfall-KTW', () => {
    const sim = makeSim()
    const result = findUnits(sim, ['RTW', 'NKTW'], zellOrt, true, baseCtx)
    const ids = result.map((r) => r.id)
    expect(ids).toContain('5.77-301') // N-KTW
    expect(ids).not.toContain('5.91-301') // plain KTW
  })

  it('helicopters appear in daylight + good weather, never in bad weather', () => {
    const sim = makeSim()
    const good = findUnits(sim, ['HELI'], zellOrt, true, baseCtx)
    expect(good.length).toBeGreaterThan(0)
    const bad = findUnits(sim, ['HELI'], zellOrt, true, { ...baseCtx, weather: 'schlecht' })
    expect(bad.length).toBe(0)
  })

  it('helicopters are not in service at night (sunrise–sunset, GAME_DATA §8)', () => {
    const sim = new VehicleSim(7, helicopters.map(unitFromHelicopter))
    const ctx = { startWeekday: 1 as const, month: 6, season: 'summer' as const }
    for (let t = 23 * 3600; t < 23 * 3600 + 120; t += 10) sim.tick(t, ctx)
    const night = findUnits(sim, ['HELI'], zellOrt, true, {
      ...baseCtx,
      simSec: 23 * 3600 + 120,
    })
    expect(night.length).toBe(0)
  })

  it('winter-only helicopters (Martin 10/6) are out of season in June', () => {
    const sim = makeSim()
    const ids = findUnits(sim, ['HELI'], zellOrt, true, baseCtx).map((r) => r.id)
    expect(ids).not.toContain('martin10')
    expect(ids).not.toContain('martin6')
    expect(ids).toContain('alpinheli6')
  })

  it('busy units are excluded', () => {
    const sim = makeSim()
    sim.dispatch(
      '5.71-202',
      { id: 'x', label: 'x', einsatzort: zellOrt, sosi: true, transport: false },
      baseCtx.simSec,
    )
    const result = findUnits(sim, ['RTW'], zellOrt, true, baseCtx)
    expect(result.map((r) => r.id)).not.toContain('5.71-202')
  })
})
