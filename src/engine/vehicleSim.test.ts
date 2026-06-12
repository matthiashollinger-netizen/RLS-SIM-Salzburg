import { describe, expect, it } from 'vitest'
import { unitFromVehicle, VehicleSim, type VehicleEvent } from './vehicleSim.ts'
import type { DutyContext } from './duty.ts'
import type { Vehicle } from '../data/schemas.ts'

const ctx: DutyContext = { startWeekday: 1, month: 6, season: 'summer' }

const testVehicle: Vehicle = {
  funkrufname: '5.20-201',
  typ: 'RTW',
  homeStation: 'stadt',
  dienstzeiten: [{ days: [1, 2, 3, 4, 5, 6, 7], from: '00:00', to: '24:00' }],
  reserve: false,
  notfallKtw: false,
  rollstuhlgeeignet: false,
}

const dayVehicle: Vehicle = {
  ...testVehicle,
  funkrufname: '5.20-301',
  typ: 'KTW',
  dienstzeiten: [{ days: [1, 2, 3, 4, 5], from: '07:00', to: '17:00' }],
}

function makeSim(vehicles: Vehicle[], seed = 1) {
  const sim = new VehicleSim(seed, vehicles.map(unitFromVehicle))
  const events: VehicleEvent[] = []
  sim.addEventListener((e) => events.push(e))
  return { sim, events }
}

/** Advance the sim in steps, collecting the visited statuses. */
function run(sim: VehicleSim, from: number, to: number, step = 10) {
  for (let t = from; t <= to; t += step) sim.tick(t, ctx)
}

describe('VehicleSim', () => {
  it('spawns vehicles when duty begins and despawns after duty ends', () => {
    const { sim, events } = makeSim([dayVehicle], 99) // seed avoiding Fahrzeugcheck on spawn
    const id = dayVehicle.funkrufname
    sim.tick(6 * 3600, ctx)
    expect(sim.get(id)!.status).toBe('AUS')
    run(sim, 7 * 3600, 7 * 3600 + 60)
    expect(['00', '92']).toContain(sim.get(id)!.status)
    expect(events.some((e) => e.type === 'spawn')).toBe(true)
    // duty ends 17:00 — vehicle disappears once idle
    run(sim, 17 * 3600, 17 * 3600 + 60)
    expect(sim.get(id)!.status).toBe('AUS')
    expect(events.some((e) => e.type === 'despawn')).toBe(true)
  })

  it('runs the exact lifecycle 00→1→2→3→4→5→6→7→00 on a transport assignment', () => {
    const { sim, events } = makeSim([testVehicle], 99)
    const id = testVehicle.funkrufname
    run(sim, 0, 60) // spawn (24h duty)
    // skip possible Fahrzeugcheck
    run(sim, 60, 1500)
    expect(sim.get(id)!.status).toBe('00')

    const ok = sim.dispatch(
      id,
      {
        id: 'a1',
        label: 'A1 INTERN Testgasse',
        einsatzort: { lat: 47.82, lon: 13.06 },
        sosi: true,
        transport: true,
        zielort: { lat: 47.8128, lon: 13.0353 },
        zielName: 'LKH',
      },
      1500,
    )
    expect(ok).toBe(true)
    expect(sim.get(id)!.status).toBe('1')

    run(sim, 1500, 1500 + 2.5 * 3600)
    expect(sim.get(id)!.status).toBe('00')

    const sequence = events
      .filter((e) => e.type === 'status' && e.simSec >= 1500)
      .map((e) => e.to)
    expect(sequence).toEqual(['1', '2', '3', '4', '5', '6', '7', '00'])
  })

  it('skips transport when assignment has none (3→6)', () => {
    const { sim, events } = makeSim([testVehicle], 99)
    const id = testVehicle.funkrufname
    run(sim, 0, 1500)
    sim.dispatch(
      id,
      {
        id: 'a2',
        label: 'B3 KRANK',
        einsatzort: { lat: 47.81, lon: 13.05 },
        sosi: false,
        transport: false,
      },
      1500,
    )
    run(sim, 1500, 1500 + 2 * 3600)
    const seq = events.filter((e) => e.type === 'status' && e.simSec >= 1500).map((e) => e.to)
    expect(seq).toEqual(['1', '2', '3', '6', '7', '00'])
  })

  it('rejects dispatch when not available', () => {
    const { sim } = makeSim([dayVehicle], 99)
    const id = dayVehicle.funkrufname
    sim.tick(3 * 3600, ctx) // off duty
    expect(
      sim.dispatch(
        id,
        { id: 'x', label: 'x', einsatzort: { lat: 47.8, lon: 13 }, sosi: true, transport: false },
        3 * 3600,
      ),
    ).toBe(false)
  })

  it('position flow: 00→88→08 at the LKH, then dispatchable from position', () => {
    const { sim, events } = makeSim([testVehicle], 99)
    const id = testVehicle.funkrufname
    run(sim, 0, 1500)
    expect(sim.sendToPosition(id, 'lkh', 1500)).toBe(true)
    expect(sim.get(id)!.status).toBe('88')
    run(sim, 1500, 1500 + 3600)
    expect(sim.get(id)!.status).toBe('08')
    const seq = events.filter((e) => e.type === 'status' && e.simSec >= 1500).map((e) => e.to)
    expect(seq).toEqual(['88', '08'])
    // direct follow-up dispatch from position
    expect(
      sim.dispatch(
        id,
        { id: 'y', label: 'y', einsatzort: { lat: 47.8, lon: 13.04 }, sosi: true, transport: false },
        1500 + 3600,
      ),
    ).toBe(true)
  })

  it('Fahrzeugcheck (92) can occur at shift start and clears to 00', () => {
    // find a seed that triggers the check deterministically
    let triggered = false
    for (let seed = 1; seed < 40 && !triggered; seed++) {
      const { sim } = makeSim([dayVehicle], seed)
      const id = dayVehicle.funkrufname
      sim.tick(7 * 3600 + 5, ctx)
      if (sim.get(id)!.status === '92') {
        triggered = true
        run(sim, 7 * 3600 + 5, 7 * 3600 + 1500)
        expect(sim.get(id)!.status).toBe('00')
      }
    }
    expect(triggered).toBe(true)
  })

  it('Sonderstatus 94 blocks and releases; reserve activation works', () => {
    const reserve: Vehicle = { ...testVehicle, funkrufname: '5.80-202', reserve: true, dienstzeiten: [] }
    const { sim } = makeSim([testVehicle, reserve], 99)
    run(sim, 0, 1500)
    expect(sim.setSonderstatus(testVehicle.funkrufname, '94', 600, 1500)).toBe(true)
    expect(sim.get(testVehicle.funkrufname)!.status).toBe('94')
    expect(
      sim.dispatch(
        testVehicle.funkrufname,
        { id: 'z', label: 'z', einsatzort: { lat: 47.8, lon: 13 }, sosi: true, transport: false },
        1510,
      ),
    ).toBe(false)
    // reserve comes into service manually
    expect(sim.get(reserve.funkrufname)!.status).toBe('AUS')
    sim.setReserveActive(reserve.funkrufname, true, 1510)
    sim.tick(1520, ctx)
    expect(sim.get(reserve.funkrufname)!.status).not.toBe('AUS')
    // block time expires
    run(sim, 1520, 2200)
    expect(sim.get(testVehicle.funkrufname)!.status).toBe('00')
  })

  it('cancelAssignment aborts before transport but not after', () => {
    const { sim } = makeSim([testVehicle], 99)
    const id = testVehicle.funkrufname
    run(sim, 0, 1500)
    sim.dispatch(
      id,
      {
        id: 'c1',
        label: 'B1 VERKEHR',
        einsatzort: { lat: 47.83, lon: 13.07 },
        sosi: true,
        transport: true,
        zielort: { lat: 47.8128, lon: 13.0353 },
      },
      1500,
    )
    run(sim, 1500, 1600) // in turnout or driving
    expect(sim.cancelAssignment(id, 1600)).toBe(true)
    expect(sim.get(id)!.status).toBe('6')
    run(sim, 1600, 1600 + 3600)
    expect(sim.get(id)!.status).toBe('00')
  })

  it('holds at the Bereitstellungsraum until releaseHold (Lagefreigabe)', () => {
    const { sim, events } = makeSim([testVehicle], 99)
    const id = testVehicle.funkrufname
    run(sim, 0, 1500)
    sim.dispatch(
      id,
      {
        id: 'pol1',
        label: 'B2 AMOK Testplatz',
        einsatzort: { lat: 47.82, lon: 13.06 },
        sosi: true,
        transport: false,
        holdAt: { lat: 47.8245, lon: 13.06 }, // staging ≈500 m north
      },
      1500,
    )
    // long run: without a release the unit must NEVER reach status 3
    run(sim, 1500, 1500 + 3600)
    const rt = sim.get(id)!
    expect(rt.status).toBe('2')
    expect(rt.held).toBe(true)
    const pos = sim.posOf(rt, 1500 + 3600)
    expect(pos.lat).toBeCloseTo(47.8245, 3)

    // Lagefreigabe → unit proceeds to the Einsatzort and completes the run
    sim.releaseHold('pol1', 1500 + 3600)
    expect(sim.get(id)!.held).toBe(false)
    run(sim, 1500 + 3600, 1500 + 3 * 3600)
    // 2 appears thrice: en route → staging arrival (note) → release (note)
    const seq = events.filter((e) => e.type === 'status' && e.simSec >= 1500).map((e) => e.to)
    expect(seq).toEqual(['1', '2', '2', '2', '3', '6', '7', '00'])
  })

  it('keeps engaged vehicles in service past duty end, despawns afterwards', () => {
    const { sim } = makeSim([dayVehicle], 99)
    const id = dayVehicle.funkrufname
    run(sim, 7 * 3600, 7 * 3600 + 1500)
    // dispatch shortly before 17:00 duty end
    const t0 = 16 * 3600 + 3300
    sim.dispatch(
      id,
      {
        id: 'late',
        label: 'D1 HEIM',
        einsatzort: { lat: 47.82, lon: 13.06 },
        sosi: false,
        transport: true,
        zielort: { lat: 47.8128, lon: 13.0353 },
      },
      t0,
    )
    run(sim, t0, t0 + 1800)
    expect(sim.get(id)!.status).not.toBe('AUS') // still finishing
    run(sim, t0 + 1800, t0 + 4 * 3600)
    expect(sim.get(id)!.status).toBe('AUS') // went home, then off duty
  })
})
