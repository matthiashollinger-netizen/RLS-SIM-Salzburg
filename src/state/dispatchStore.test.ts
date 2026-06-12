import { beforeEach, describe, expect, it } from 'vitest'
import { useDispatchStore } from './dispatchStore.ts'
import { useGameStore } from './gameStore.ts'
import { vehicleSim } from './simulation.ts'

/**
 * Integration: two-stage ELS dispatch (Rework #8) + one-transporter rule
 * (Rework #6) against the real simulation singleton.
 */

function bringFleetInService() {
  // tick to noon in June (helis in service too)
  const ctx = { startWeekday: 1 as const, month: 6, season: 'summer' as const }
  for (let t = 12 * 3600; t < 12 * 3600 + 1600; t += 10) vehicleSim.tick(t, ctx)
  useGameStore.setState({ simSec: 12 * 3600 + 1600 })
}

const ORT = { lat: 47.39, lon: 12.64, stadtteil: 'Saalbach-Hinterglemm', strasse: 'Dorfstraße' }

describe('two-stage dispatch + transport roles', () => {
  beforeEach(() => {
    vehicleSim.resetAll()
    useDispatchStore.getState().reset()
    bringFleetInService()
  })

  it('assign stages only; alarmieren dispatches all staged units together', () => {
    const store = useDispatchStore.getState()
    const id = store.createAuftrag({ categoryId: 'ALPIN', severity: 'hoch', ort: ORT })

    expect(store.assignVehicle(id, '5.71-202')).toBe(true) // RTW Zell
    expect(store.assignVehicle(id, 'alpinheli6')).toBe(true) // HELI Zell

    let a = useDispatchStore.getState().auftraege[id]!
    expect(a.assigned['5.71-202']).toBe('zugeteilt')
    expect(a.state).toBe('offen')
    // staged units are NOT moving yet
    expect(vehicleSim.get('5.71-202')!.status).toBe('00')

    expect(useDispatchStore.getState().alarmieren(id)).toBe(true)
    a = useDispatchStore.getState().auftraege[id]!
    expect(a.assigned['5.71-202']).toBe('alarmiert')
    expect(a.state).toBe('disponiert')
    expect(vehicleSim.get('5.71-202')!.status).toBe('1')
    expect(vehicleSim.get('alpinheli6')!.status).toBe('1')
  })

  it('one patient → only the heli transports, the RTW supports (Rework #6)', () => {
    const store = useDispatchStore.getState()
    const id = store.createAuftrag({
      categoryId: 'ALPIN',
      severity: 'hoch',
      personen: 1,
      ort: ORT,
    })
    store.assignVehicle(id, '5.71-202')
    store.assignVehicle(id, 'alpinheli6')
    useDispatchStore.getState().alarmieren(id)

    const a = useDispatchStore.getState().auftraege[id]!
    expect(a.transporters).toEqual(['alpinheli6'])
    expect(vehicleSim.get('alpinheli6')!.assignment?.transport).toBe(true)
    expect(vehicleSim.get('5.71-202')!.assignment?.transport).toBe(false)
  })

  it('staged units can be removed before alarming', () => {
    const store = useDispatchStore.getState()
    const id = store.createAuftrag({ categoryId: 'INTERN', severity: 'hoch', ort: ORT })
    store.assignVehicle(id, '5.71-202')
    useDispatchStore.getState().removeStagedVehicle(id, '5.71-202')
    expect(useDispatchStore.getState().auftraege[id]!.assigned['5.71-202']).toBeUndefined()
    expect(useDispatchStore.getState().alarmieren(id)).toBe(false)
  })

  it('editing the Auftrag re-derives the code and keeps manual overrides', () => {
    const store = useDispatchStore.getState()
    const id = store.createAuftrag({ categoryId: 'KRANK', severity: 'normal', ort: ORT })
    expect(useDispatchStore.getState().auftraege[id]!.code).toBe('B3')

    useDispatchStore.getState().updateAuftrag(id, { categoryId: 'STILL' })
    expect(useDispatchStore.getState().auftraege[id]!.code).toBe('A1')

    useDispatchStore.getState().overrideCode(id, 'B1')
    useDispatchStore.getState().updateAuftrag(id, { personen: 2 })
    expect(useDispatchStore.getState().auftraege[id]!.code).toBe('B1') // manual override sticks
    expect(useDispatchStore.getState().auftraege[id]!.personen).toBe(2)

    useDispatchStore.getState().updateAuftrag(id, { notiz: 'Zufahrt über Feldweg' })
    expect(useDispatchStore.getState().auftraege[id]!.notiz).toBe('Zufahrt über Feldweg')
  })

  it('correcting the Ort re-routes approaching units', () => {
    const store = useDispatchStore.getState()
    const id = store.createAuftrag({ categoryId: 'INTERN', severity: 'hoch', ort: ORT })
    store.assignVehicle(id, '5.71-202')
    useDispatchStore.getState().alarmieren(id)
    const neu = { lat: 47.42, lon: 12.85, stadtteil: 'Saalfelden', strasse: 'Bahnhofstraße' }
    useDispatchStore.getState().updateAuftrag(id, { ort: neu })
    const rt = vehicleSim.get('5.71-202')!
    expect(rt.assignment?.einsatzort.lat).toBeCloseTo(47.42)
    expect(useDispatchStore.getState().auftraege[id]!.ort.stadtteil).toBe('Saalfelden')
  })
})
