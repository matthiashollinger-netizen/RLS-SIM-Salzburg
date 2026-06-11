import { describe, expect, it } from 'vitest'
import {
  LEITSTELLE,
  leitstelleCallsVehicle,
  needsNaNachforderung,
  needsPolizeiNachforderung,
  quickReply,
  vehicleCallsLeitstelle,
} from './funk.ts'
import { unitFromVehicle, VehicleSim } from './vehicleSim.ts'
import { shortCallSign, unitDisplayName } from '../lib/format.ts'
import type { Auftrag } from './auftrag.ts'
import type { Vehicle } from '../data/schemas.ts'

const baseAuftrag: Auftrag = {
  id: 'E-0001',
  createdAt: 0,
  code: 'A1',
  categoryId: 'STILL',
  severity: 'hoch',
  personen: 1,
  ort: { lat: 47.8, lon: 13.04, stadtteil: 'Lehen', strasse: 'Teststraße' },
  merkmalskette: [],
  sosi: true,
  partnersAlarmed: [],
  lagefreigabe: false,
  assigned: {},
  state: 'laufend',
  uebung: false,
}

describe('Funkprotokoll (GAME_DATA §10c — verbindlich)', () => {
  it('vehicle→Leitstelle uses exactly „X von Y" / „kommen" / „Verstanden"', () => {
    const lines = vehicleCallsLeitstelle('20-322', 'Laufende CPR, benötigen NEF und RTW')
    expect(lines[0]).toEqual({ speaker: '20-322', text: 'Leitstelle von 20-322' })
    expect(lines[1]).toEqual({ speaker: LEITSTELLE, text: 'kommen' })
    expect(lines[2]!.text).toBe('Laufende CPR, benötigen NEF und RTW')
    expect(lines[3]).toEqual({ speaker: LEITSTELLE, text: 'Verstanden' })
  })

  it('Leitstelle→vehicle: called party first, reply ends with Verstanden', () => {
    const lines = leitstelleCallsVehicle('71-202', 'Frage: aktueller Status?', 'Status 3.')
    expect(lines[0]!.text).toBe('71-202 von Leitstelle')
    expect(lines[1]).toEqual({ speaker: '71-202', text: 'kommen' })
    expect(lines.at(-1)!.text).toBe('Verstanden')
  })

  it('call signs are spoken WITHOUT the 5. prefix', () => {
    expect(shortCallSign('5.20-322')).toBe('20-322')
    expect(unitDisplayName({ id: '5.71-202', typ: 'RTW' })).toBe('71-202')
    expect(unitDisplayName({ id: 'c6', typ: 'HELI', nickname: 'Christophorus 6' })).toBe(
      'Christophorus 6',
    )
  })
})

describe('NA-Nachforderung trigger (GAME_DATA §10c example)', () => {
  it('fires for severe incidents without NA assigned', () => {
    expect(needsNaNachforderung(baseAuftrag, ['RTW'])).toBe(true)
  })
  it('does not fire when an NA unit is on the incident', () => {
    expect(needsNaNachforderung(baseAuftrag, ['RTW', 'NEF'])).toBe(false)
    expect(needsNaNachforderung(baseAuftrag, ['HELI'])).toBe(false)
  })
  it('does not fire for non-severe or transport codes', () => {
    expect(needsNaNachforderung({ ...baseAuftrag, severity: 'normal' }, ['RTW'])).toBe(false)
    expect(needsNaNachforderung({ ...baseAuftrag, code: 'D1' }, ['KTW'])).toBe(false)
  })
})

describe('Polizei-Nachforderung', () => {
  it('fires when category suggests POL and not alarmed yet', () => {
    expect(needsPolizeiNachforderung(baseAuftrag, true)).toBe(true)
    expect(
      needsPolizeiNachforderung({ ...baseAuftrag, partnersAlarmed: ['POL'] }, true),
    ).toBe(false)
    expect(needsPolizeiNachforderung(baseAuftrag, false)).toBe(false)
  })
})

describe('quick replies', () => {
  const vehicle: Vehicle = {
    funkrufname: '5.20-201',
    typ: 'RTW',
    homeStation: 'stadt',
    dienstzeiten: [{ days: [1, 2, 3, 4, 5, 6, 7], from: '00:00', to: '24:00' }],
    reserve: false,
    notfallKtw: false,
    rollstuhlgeeignet: false,
  }

  function readyRuntime() {
    const sim = new VehicleSim(9, [unitFromVehicle(vehicle)])
    const ctx = { startWeekday: 1 as const, month: 6, season: 'summer' as const }
    for (let t = 0; t < 1500; t += 10) sim.tick(t, ctx)
    return { sim, rt: sim.get('5.20-201')! }
  }

  it('status reply contains the current status code', () => {
    const { rt } = readyRuntime()
    expect(quickReply('status', { rt, simSec: 1500, statusLabel: 'in Dienststelle' })).toContain(
      'Status 00',
    )
  })

  it('eintreffzeit reports ETA minutes while driving', () => {
    const { sim, rt } = readyRuntime()
    sim.dispatch(
      rt.id,
      { id: 'x', label: 'x', einsatzort: { lat: 47.9, lon: 13.2 }, sosi: true, transport: false },
      1500,
    )
    const ctx = { startWeekday: 1 as const, month: 6, season: 'summer' as const }
    for (let t = 1500; t < 1620; t += 10) sim.tick(t, ctx) // through turnout into status 2
    const driving = sim.get(rt.id)!
    expect(driving.status).toBe('2')
    const reply = quickReply('eintreffzeit', { rt: driving, simSec: 1620, statusLabel: '' })
    expect(reply).toMatch(/zirka \d+ Minute/)
  })

  it('abbruch reply depends on cancel success', () => {
    const { rt } = readyRuntime()
    expect(quickReply('abbruch', { rt, simSec: 0, statusLabel: '', cancelOk: true })).toContain(
      'brechen ab',
    )
    expect(quickReply('abbruch', { rt, simSec: 0, statusLabel: '', cancelOk: false })).toContain(
      'Negativ',
    )
  })

  it('na-abkoemmlich from a non-NA unit says no NA aboard', () => {
    const { rt } = readyRuntime()
    expect(quickReply('na-abkoemmlich', { rt, simSec: 0, statusLabel: '' })).toContain(
      'kein Notarzt',
    )
  })
})
